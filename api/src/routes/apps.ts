import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';
import { runBuildPipeline, formatChecklist } from '../lib/build-pipeline';

const apps = new Hono<{ Bindings: Env; Variables: { developerId: string } }>();

// Valid categories
const VALID_CATEGORIES = [
  'utility', 'productivity', 'game', 'education',
  'entertainment', 'social', 'finance', 'health',
  'developer', 'design', 'communication', 'other'
];

// POST /api/apps — submit new app (auth required)
apps.post('/', authMiddleware, async (c) => {
  const developerId = c.get('developerId');

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  // --- Validate required fields one by one ---
  const errors: string[] = [];

  // name
  if (!body.name || typeof body.name !== 'string' || (body.name as string).trim().length === 0) {
    errors.push('name is required');
  } else if ((body.name as string).length > 50) {
    errors.push('name must be 50 characters or less');
  }

  // slug
  if (!body.slug || typeof body.slug !== 'string') {
    errors.push('slug is required');
  } else if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(body.slug as string)) {
    errors.push('slug must be lowercase letters, numbers, and hyphens only (e.g. "my-cool-app")');
  } else if ((body.slug as string).length < 2 || (body.slug as string).length > 50) {
    errors.push('slug must be between 2 and 50 characters');
  }

  // tagline
  if (!body.tagline || typeof body.tagline !== 'string' || (body.tagline as string).trim().length === 0) {
    errors.push('tagline is required (a short one-line description)');
  } else if ((body.tagline as string).length > 100) {
    errors.push('tagline must be 100 characters or less');
  }

  // description
  if (!body.description || typeof body.description !== 'string' || (body.description as string).trim().length === 0) {
    errors.push('description is required');
  } else if ((body.description as string).length > 2000) {
    errors.push('description must be 2000 characters or less');
  }

  // repo_url
  if (!body.repo_url || typeof body.repo_url !== 'string') {
    errors.push('repo_url is required');
  } else if (!/^https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/?$/.test(body.repo_url as string)) {
    errors.push('repo_url must be a valid GitHub repository URL (e.g. "https://github.com/user/repo")');
  }

  // repo_tag
  if (!body.repo_tag || typeof body.repo_tag !== 'string' || (body.repo_tag as string).trim().length === 0) {
    errors.push('repo_tag is required (e.g. "v1.0" or a commit hash)');
  }

  // category
  if (!body.category || typeof body.category !== 'string') {
    errors.push(`category is required. Choose from: ${VALID_CATEGORIES.join(', ')}`);
  } else if (!VALID_CATEGORIES.includes(body.category as string)) {
    errors.push(`Invalid category "${body.category}". Choose from: ${VALID_CATEGORIES.join(', ')}`);
  }

  // tags (optional but validate if provided)
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) {
      errors.push('tags must be an array of strings (e.g. ["tool", "ai"])');
    } else if ((body.tags as unknown[]).length > 10) {
      errors.push('Maximum 10 tags allowed');
    } else if (!(body.tags as unknown[]).every(t => typeof t === 'string' && (t as string).length <= 30)) {
      errors.push('Each tag must be a string of 30 characters or less');
    }
  }

  // Return all errors at once
  if (errors.length > 0) {
    return c.json({
      error: 'Validation failed',
      details: errors,
      required_fields: {
        name: 'string (max 50 chars)',
        slug: 'string (lowercase, hyphens, 2-50 chars)',
        tagline: 'string (max 100 chars)',
        description: 'string (max 2000 chars)',
        repo_url: 'GitHub URL (https://github.com/user/repo)',
        repo_tag: 'string (e.g. "v1.0")',
        category: `one of: ${VALID_CATEGORIES.join(', ')}`,
      },
      optional_fields: {
        tags: 'string[] (max 10, each max 30 chars)',
      }
    }, 400);
  }

  const name = (body.name as string).trim();
  const slug = body.slug as string;
  const tagline = (body.tagline as string).trim();
  const description = (body.description as string).trim();
  const repoUrl = (body.repo_url as string).replace(/\/$/, '');
  const repoTag = (body.repo_tag as string).trim();
  const category = body.category as string;
  const tags = body.tags as string[] | undefined;

  // Check if slug is taken
  const existing = await c.env.DB.prepare(
    'SELECT id FROM apps WHERE slug = ?'
  ).bind(slug).first();

  if (existing) {
    return c.json({ error: `Slug "${slug}" is already taken. Please choose a different slug.` }, 409);
  }

  const now = new Date().toISOString();
  const appId = crypto.randomUUID();
  const submissionId = crypto.randomUUID();
  const tagsJson = tags ? JSON.stringify(tags) : null;

  // Create app record (status: pending)
  await c.env.DB.prepare(
    `INSERT INTO apps (id, developer_id, slug, name, tagline, description, category, tags, repo_url, repo_tag, homepage_url, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
  ).bind(
    appId, developerId, slug, name, tagline, description,
    category, tagsJson, repoUrl, repoTag,
    `https://${slug}.vibepub.dev`, now, now
  ).run();

  // Create submission record
  await c.env.DB.prepare(
    `INSERT INTO submissions (id, app_id, developer_id, repo_url, repo_tag, app_name, app_slug, description, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
  ).bind(
    submissionId, appId, developerId, repoUrl, repoTag,
    name, slug, description, now
  ).run();

  // Update developer app count
  await c.env.DB.prepare(
    'UPDATE developers SET app_count = app_count + 1, updated_at = ? WHERE id = ?'
  ).bind(now, developerId).run();

  // ── Auto-trigger build pipeline (async, don't block response) ──
  const buildCtx = {
    owner: repoUrl.match(/github\.com\/([^\/]+)\//)?.[1] || '',
    repo: (repoUrl.match(/github\.com\/[^\/]+\/([^\/]+)/)?.[1] || '').replace(/\.git$/, ''),
    tag: repoTag,
    slug,
    githubToken: c.env.GITHUB_PAT,
  };

  // Fire-and-forget: build runs in background via waitUntil
  const buildPromise = (async () => {
    try {
      // Mark as building
      await c.env.DB.prepare(
        "UPDATE submissions SET status = 'building' WHERE id = ?"
      ).bind(submissionId).run();

      const result = await runBuildPipeline(buildCtx);
      const completedAt = new Date().toISOString();

      if (result.success) {
        await c.env.DB.prepare(
          `UPDATE submissions SET status = 'approved', audit_result = ?, completed_at = ? WHERE id = ?`
        ).bind(JSON.stringify(result.checklist), completedAt, submissionId).run();

        await c.env.DB.prepare(
          `UPDATE apps SET status = 'approved', updated_at = ? WHERE id = ?`
        ).bind(completedAt, appId).run();
      } else {
        await c.env.DB.prepare(
          `UPDATE submissions SET status = 'rejected', audit_result = ?, reject_reason = ?, completed_at = ? WHERE id = ?`
        ).bind(
          JSON.stringify(result.checklist),
          result.error || 'Build checks failed', completedAt, submissionId
        ).run();

        await c.env.DB.prepare(
          `UPDATE apps SET status = 'rejected', updated_at = ? WHERE id = ?`
        ).bind(completedAt, appId).run();
      }
    } catch (err: any) {
      console.error('Build pipeline error:', err);
      const completedAt = new Date().toISOString();
      await c.env.DB.prepare(
        `UPDATE submissions SET status = 'rejected', reject_reason = ?, error_details = ?, completed_at = ? WHERE id = ?`
      ).bind('Pipeline crash', err.message || 'Unknown', completedAt, submissionId).run();
    }
  })();

  c.executionCtx.waitUntil(buildPromise);

  return c.json({
    message: 'App submitted! Build pipeline started automatically 🚀',
    app: {
      id: appId,
      slug,
      name,
      status: 'building',
      url: `https://${slug}.vibepub.dev`,
    },
    submission: {
      id: submissionId,
      status: 'building',
    },
    build_status: `GET /api/build/${submissionId}`,
  }, 201);
});

// GET /api/apps/mine — list current developer's apps (auth required)
apps.get('/mine', authMiddleware, async (c) => {
  const developerId = c.get('developerId');

  const result = await c.env.DB.prepare(
    `SELECT id, slug, name, tagline, category, status, homepage_url, created_at, updated_at, published_at
     FROM apps WHERE developer_id = ? ORDER BY created_at DESC`
  ).bind(developerId).all();

  return c.json({ apps: result.results });
});

// GET /api/apps — list published apps
apps.get('/', async (c) => {
  const sort = c.req.query('sort') || 'newest';
  const category = c.req.query('category');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const offset = parseInt(c.req.query('offset') || '0');

  let query = 'SELECT a.*, d.github_username, d.display_name as developer_name, d.avatar_url as developer_avatar FROM apps a JOIN developers d ON a.developer_id = d.id WHERE a.status = ?';
  const params: string[] = ['published'];

  if (category) {
    if (!VALID_CATEGORIES.includes(category)) {
      return c.json({ error: `Invalid category. Choose from: ${VALID_CATEGORIES.join(', ')}` }, 400);
    }
    query += ' AND a.category = ?';
    params.push(category);
  }

  switch (sort) {
    case 'popular':
      query += ' ORDER BY a.total_views DESC';
      break;
    case 'newest':
    default:
      query += ' ORDER BY a.published_at DESC';
      break;
  }

  query += ' LIMIT ? OFFSET ?';

  const stmt = c.env.DB.prepare(query);
  const result = await stmt.bind(...params, limit, offset).all();

  // Get total count
  let countQuery = 'SELECT COUNT(*) as total FROM apps WHERE status = ?';
  const countParams: string[] = ['published'];
  if (category) {
    countQuery += ' AND category = ?';
    countParams.push(category);
  }
  const countResult = await c.env.DB.prepare(countQuery).bind(...countParams).first<{ total: number }>();

  return c.json({
    apps: result.results,
    total: countResult?.total || 0,
    limit,
    offset,
    categories: VALID_CATEGORIES,
  });
});

// GET /api/apps/:slug — get single app
apps.get('/:slug', async (c) => {
  const slug = c.req.param('slug');

  const app = await c.env.DB.prepare(
    `SELECT a.*, d.github_username, d.display_name as developer_name, d.avatar_url as developer_avatar
     FROM apps a JOIN developers d ON a.developer_id = d.id
     WHERE a.slug = ?`
  ).bind(slug).first();

  if (!app) {
    return c.json({ error: 'App not found' }, 404);
  }

  return c.json({ app });
});

export default apps;
