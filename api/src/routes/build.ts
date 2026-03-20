/**
 * Build Pipeline Routes
 *
 * POST /api/build/:submissionId  — trigger build for a pending submission
 * GET  /api/build/:submissionId  — get build status + checklist
 */

import { Hono } from 'hono';
import { Env } from '../types';
import { runBuildPipeline, formatChecklist, type BuildResult } from '../lib/build-pipeline';
import { fetchReadme, generateAiContent } from '../lib/ai-content';
import { deployToR2 } from '../lib/deploy';

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

// POST /api/build/deploy/:slug — manually deploy an approved app to R2
build.post('/deploy/:slug', async (c) => {
  const slug = c.req.param('slug');

  const app = await c.env.DB.prepare(
    'SELECT id, slug, repo_url, repo_tag, status FROM apps WHERE slug = ?'
  ).bind(slug).first<{ id: string; slug: string; repo_url: string; repo_tag: string; status: string }>();

  if (!app) return c.json({ error: 'App not found' }, 404);

  const match = app.repo_url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) return c.json({ error: 'Invalid repo URL' }, 400);
  const [, owner, repo] = match;

  const deployResult = await deployToR2({
    owner,
    repo: repo.replace(/\.git$/, ''),
    tag: app.repo_tag,
    slug: app.slug,
    githubToken: c.env.GITHUB_PAT,
    appBucket: c.env.APP_BUCKET,
  });

  if (!deployResult.success) {
    return c.json({ error: deployResult.error }, 500);
  }

  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `UPDATE apps SET status = 'published', published_at = ?, homepage_url = ?, updated_at = ? WHERE id = ?`
  ).bind(now, `https://${app.slug}.vibepub.dev`, now, app.id).run();

  // Update submission too
  await c.env.DB.prepare(
    `UPDATE submissions SET status = 'completed', completed_at = ? WHERE app_id = ?`
  ).bind(now, app.id).run();

  return c.json({ message: `Deployed ${slug}`, url: `https://${slug}.vibepub.dev` });
});

// POST /api/build/generate-ai/:slug — backfill AI content for an existing app
build.post('/generate-ai/:slug', async (c) => {
  const slug = c.req.param('slug');

  const app = await c.env.DB.prepare(
    'SELECT id, slug, name, tagline, description, repo_url, repo_tag FROM apps WHERE slug = ?'
  ).bind(slug).first<{ id: string; slug: string; name: string; tagline: string; description: string; repo_url: string; repo_tag: string }>();

  if (!app) return c.json({ error: 'App not found' }, 404);

  // Parse GitHub URL
  const match = app.repo_url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) return c.json({ error: 'Invalid repo URL' }, 400);
  const [, owner, repo] = match;
  const repoName = repo.replace(/\.git$/, '');

  // Fetch README (falls back to index.html)
  const readmeRaw = await fetchReadme(owner, repoName, app.repo_tag || 'main', c.env.GITHUB_PAT);
  if (!readmeRaw) return c.json({ error: 'Could not fetch README.md or index.html' }, 404);

  // Generate AI content
  if (!c.env.AI) return c.json({ error: 'AI binding not available' }, 500);

  const aiContent = await generateAiContent(c.env.AI, app.name, app.tagline || '', app.description || '', readmeRaw);
  if (!aiContent) return c.json({ error: 'AI generation failed' }, 500);

  // Save to DB
  await c.env.DB.prepare(
    'UPDATE apps SET readme_raw = ?, ai_description = ?, ai_faq = ?, updated_at = ? WHERE id = ?'
  ).bind(
    readmeRaw.slice(0, 50000),
    aiContent.ai_description,
    JSON.stringify(aiContent.ai_faq),
    new Date().toISOString(),
    app.id
  ).run();

  return c.json({
    message: 'AI content generated',
    slug: app.slug,
    ai_description: aiContent.ai_description,
    ai_faq: aiContent.ai_faq,
  });
});

export default build;
