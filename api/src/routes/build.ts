/**
 * Build Pipeline Routes
 *
 * POST /api/build/:submissionId  — trigger build for a pending submission
 * GET  /api/build/:submissionId  — get build status + checklist
 */

import { Hono } from 'hono';
import { Env } from '../types';
import { runBuildPipeline, formatChecklist, type BuildResult } from '../lib/build-pipeline';

const build = new Hono<{ Bindings: Env }>();

// POST /api/build/:submissionId — run the build pipeline
build.post('/:submissionId', async (c) => {
  const submissionId = c.req.param('submissionId');

  // Fetch submission
  const submission = await c.env.DB.prepare(
    'SELECT * FROM submissions WHERE id = ?'
  ).bind(submissionId).first();

  if (!submission) {
    return c.json({ error: 'Submission not found' }, 404);
  }

  if (submission.status !== 'pending') {
    return c.json({
      error: `Submission already processed (status: ${submission.status})`,
      checklist: submission.audit_result ? JSON.parse(submission.audit_result as string) : null,
    }, 400);
  }

  // Parse GitHub URL
  const repoUrl = submission.repo_url as string;
  const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) {
    return c.json({ error: 'Invalid repo URL' }, 400);
  }

  const [, owner, repo] = match;
  const tag = submission.repo_tag as string;
  const slug = submission.app_slug as string;

  // Update status to building
  await c.env.DB.prepare(
    "UPDATE submissions SET status = 'building' WHERE id = ?"
  ).bind(submissionId).run();

  // Run pipeline
  const result = await runBuildPipeline({
    owner,
    repo: repo.replace(/\.git$/, ''),
    tag,
    slug,
    githubToken: c.env.GITHUB_PAT,
  });

  // Update database
  const now = new Date().toISOString();

  if (result.success) {
    // ✅ Checks passed — mark as approved, deploy handled by local script
    await c.env.DB.prepare(
      `UPDATE submissions
       SET status = 'approved', audit_result = ?, completed_at = ?
       WHERE id = ?`
    ).bind(JSON.stringify(result.checklist), now, submissionId).run();

    await c.env.DB.prepare(
      `UPDATE apps SET status = 'approved', updated_at = ? WHERE id = ?`
    ).bind(now, submission.app_id).run();

    return c.json({
      message: '✅ All checks passed! Deploying...',
      status: 'approved',
      url: `https://${slug}.vibepub.dev`,
      checklist: result.checklist,
      report: formatChecklist(result.checklist),
    });
  } else {
    // ❌ Rejected
    await c.env.DB.prepare(
      `UPDATE submissions
       SET status = 'rejected', audit_result = ?, reject_reason = ?, completed_at = ?
       WHERE id = ?`
    ).bind(
      JSON.stringify(result.checklist),
      result.error || 'Build checks failed', now, submissionId
    ).run();

    await c.env.DB.prepare(
      `UPDATE apps SET status = 'rejected', updated_at = ? WHERE id = ?`
    ).bind(now, submission.app_id).run();

    return c.json({
      message: '❌ Build failed',
      status: 'rejected',
      error: result.error,
      checklist: result.checklist,
      report: formatChecklist(result.checklist),
    }, 422);
  }
});

// GET /api/build/:submissionId — check build status
build.get('/:submissionId', async (c) => {
  const submissionId = c.req.param('submissionId');

  const submission = await c.env.DB.prepare(
    'SELECT id, app_slug, status, audit_result, audit_score, reject_reason, created_at, completed_at FROM submissions WHERE id = ?'
  ).bind(submissionId).first();

  if (!submission) {
    return c.json({ error: 'Submission not found' }, 404);
  }

  const checklist = submission.audit_result
    ? JSON.parse(submission.audit_result as string)
    : null;

  return c.json({
    submission_id: submission.id,
    slug: submission.app_slug,
    status: submission.status,
    checklist,
    report: checklist ? formatChecklist(checklist) : null,
    reject_reason: submission.reject_reason,
    created_at: submission.created_at,
    completed_at: submission.completed_at,
  });
});

export default build;
