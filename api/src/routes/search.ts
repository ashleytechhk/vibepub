import { Hono } from 'hono';
import { Env } from '../types';

const search = new Hono<{ Bindings: Env }>();

// GET /api/search?q=xxx — keyword search
search.get('/', async (c) => {
  const query = c.req.query('q');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const offset = parseInt(c.req.query('offset') || '0');

  if (!query || query.trim().length === 0) {
    return c.json({ error: 'Missing search query parameter: q' }, 400);
  }

  const searchTerm = `%${query.trim()}%`;

  const result = await c.env.DB.prepare(
    `SELECT a.id, a.slug, a.name, a.tagline, a.description, a.category, a.tags,
            a.icon_url, a.total_views, a.published_at, a.homepage_url,
            d.github_username, d.display_name as developer_name
     FROM apps a
     JOIN developers d ON a.developer_id = d.id
     WHERE a.status = 'published'
       AND (a.name LIKE ? OR a.tagline LIKE ? OR a.description LIKE ? OR a.tags LIKE ?)
     ORDER BY a.total_views DESC
     LIMIT ? OFFSET ?`
  ).bind(searchTerm, searchTerm, searchTerm, searchTerm, limit, offset).all();

  return c.json({
    query,
    results: result.results,
    count: result.results.length,
    limit,
    offset,
  });
});

export default search;
