import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';

const apps = new Hono<{ Bindings: Env; Variables: { developerId: string } }>();

// POST /api/apps — submit new app (auth required)
apps.post('/', authMiddleware, async (c) => {
  const developerId = c.get('developerId');
  const body = await c.req.json<{
    repo_url: string;
    repo_tag: string;
    name: string;
    slug: string;
    description?: string;
    category?: string;
    tags?: string[];
    tagline?: string;
  }>();

  // Validate required fields
  if (!body.repo_url || !body.repo_tag || !body.name || !body.slug) {
    return c.json({ error: 'Missing required fields: repo_url, repo_tag, name, slug' }, 400);
  }

  // Validate slug format (lowercase, alphanumeric, hyphens)
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(body.slug) && !/^[a-z0-9]$/.test(body.slug)) {
    return c.json({ error: 'Invalid slug format. Use lowercase letters, numbers, and hyphens.' }, 400);
  }

  // Check if slug is taken
  const existing = await c.env.DB.prepare(
    'SELECT id FROM apps WHERE slug = ?'
  ).bind(body.slug).first();

  if (existing) {
    return c.json({ error: 'Slug already taken' }, 409);
  }

  const now = new Date().toISOString();
  const appId = crypto.randomUUID();
  const submissionId = crypto.randomUUID();
  const tagsJson = body.tags ? JSON.stringify(body.tags) : null;

  // Create app record (status: pending)
  await c.env.DB.prepare(
    `INSERT INTO apps (id, developer_id, slug, name, tagline, description, category, tags, repo_url, repo_tag, homepage_url, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
  ).bind(
    appId,
    developerId,
    body.slug,
    body.name,
    body.tagline || null,
    body.description || null,
    body.category || null,
    tagsJson,
    body.repo_url,
    body.repo_tag,
    `https://${body.slug}.vibepub.dev`,
    now,
    now
  ).run();

  // Create submission record
  await c.env.DB.prepare(
    `INSERT INTO submissions (id, app_id, developer_id, repo_url, repo_tag, app_name, app_slug, description, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
  ).bind(
    submissionId,
    appId,
    developerId,
    body.repo_url,
    body.repo_tag,
    body.name,
    body.slug,
    body.description || null,
    now
  ).run();

  // Update developer app count
  await c.env.DB.prepare(
    'UPDATE developers SET app_count = app_count + 1, updated_at = ? WHERE id = ?'
  ).bind(now, developerId).run();

  return c.json({
    message: 'App submitted successfully! Review in progress.',
    app: {
      id: appId,
      slug: body.slug,
      status: 'pending',
      url: `https://${body.slug}.vibepub.dev`,
    },
    submission: {
      id: submissionId,
      status: 'pending',
    },
  }, 201);
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
