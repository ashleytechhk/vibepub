import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './types';
import auth from './routes/auth';
import apps from './routes/apps';
import search from './routes/search';
import developers from './routes/developers';
import build from './routes/build';

const app = new Hono<{ Bindings: Env }>();

// Subdomain routing — proxy *.vibepub.dev to corresponding CF Pages project
app.use('*', async (c, next) => {
  const hostname = new URL(c.req.url).hostname;

  // Check if this is a subdomain request (e.g. hello-vibepub.vibepub.dev)
  if (hostname.endsWith('.vibepub.dev') && hostname !== 'vibepub.dev') {
    const subdomain = hostname.replace('.vibepub.dev', '');

    // Proxy to the corresponding CF Pages project
    const pagesUrl = `https://${subdomain}.pages.dev${new URL(c.req.url).pathname}`;
    try {
      const resp = await fetch(pagesUrl, {
        method: c.req.method,
        headers: c.req.raw.headers,
      });

      return new Response(resp.body, {
        status: resp.status,
        headers: resp.headers,
      });
    } catch {
      return c.json({ error: `App "${subdomain}" not found or unavailable` }, 502);
    }
  }

  await next();
});

// CORS
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// API index / health check
app.get('/api', (c) => {
  return c.json({
    name: 'VibePub API',
    version: '0.1.0',
    endpoints: {
      auth: {
        'GET /api/auth/github': 'Start GitHub OAuth login',
        'GET /api/auth/github/callback': 'OAuth callback',
        'GET /api/auth/me': 'Get current developer (requires JWT)',
      },
      apps: {
        'POST /api/apps': 'Submit new app (requires JWT)',
        'GET /api/apps': 'List published apps (?sort=newest|popular&category=xxx)',
        'GET /api/apps/:slug': 'Get app by slug',
      },
      search: {
        'GET /api/search?q=xxx': 'Search apps by keyword',
      },
      build: {
        'POST /api/build/:submissionId': 'Trigger build pipeline for a submission',
        'GET /api/build/:submissionId': 'Get build status + checklist',
      },
      developers: {
        'GET /api/developers/:id': 'Get developer profile',
      },
    },
  });
});

// Mount routes
app.route('/api/auth', auth);
app.route('/api/apps', apps);
app.route('/api/search', search);
app.route('/api/developers', developers);
app.route('/api/build', build);

// Serve static assets for main domain (non-API routes)
app.get('*', async (c) => {
  try {
    const response = await c.env.ASSETS.fetch(c.req.raw);
    if (response.status !== 404) {
      return response;
    }
  } catch {
    // fall through to 404
  }
  return c.json({ error: 'Not found' }, 404);
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
