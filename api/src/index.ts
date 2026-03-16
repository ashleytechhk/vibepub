import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './types';
import auth from './routes/auth';
import apps from './routes/apps';
import search from './routes/search';
import developers from './routes/developers';
import build from './routes/build';

const app = new Hono<{ Bindings: Env }>();

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
