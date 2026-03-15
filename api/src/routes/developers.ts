import { Hono } from 'hono';
import { Env } from '../types';

const developers = new Hono<{ Bindings: Env }>();

// GET /api/developers/:id — public developer profile
developers.get('/:id', async (c) => {
  const id = c.req.param('id');

  const developer = await c.env.DB.prepare(
    'SELECT id, github_username, display_name, avatar_url, bio, website, app_count, created_at FROM developers WHERE id = ? AND status = ?'
  ).bind(id, 'active').first();

  if (!developer) {
    return c.json({ error: 'Developer not found' }, 404);
  }

  // Get developer's published apps
  const apps = await c.env.DB.prepare(
    `SELECT id, slug, name, tagline, icon_url, category, total_views, published_at
     FROM apps WHERE developer_id = ? AND status = 'published'
     ORDER BY published_at DESC`
  ).bind(id).all();

  return c.json({
    developer,
    apps: apps.results,
  });
});

export default developers;
