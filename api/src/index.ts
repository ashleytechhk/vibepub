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

      // Inject GA4 into HTML responses
      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        const html = await resp.text();
        const ga4Snippet = `<!-- VibePub Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-58GRDE9E88"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-58GRDE9E88',{page_title:'${subdomain}',content_group:'app'});</script>`;
        const injected = html.includes('<head>')
          ? html.replace('<head>', '<head>\n' + ga4Snippet)
          : ga4Snippet + html;
        const newHeaders = new Headers(resp.headers);
        newHeaders.delete('content-length');
        return new Response(injected, { status: resp.status, headers: newHeaders });
      }

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

// /llms.txt — platform-level AI index for GEO (Generative Engine Optimization)
// Compact index with links to per-tag pages for scalability
app.get('/llms.txt', async (c) => {
  const countResult = await c.env.DB.prepare(
    "SELECT COUNT(*) as total FROM apps WHERE status = 'published'"
  ).first<{ total: number }>();
  const total = countResult?.total || 0;

  // Get all published apps to extract tag counts
  const allApps = await c.env.DB.prepare(
    "SELECT tags FROM apps WHERE status = 'published'"
  ).all<{ tags: string }>();

  const tagCounts: Record<string, number> = {};
  for (const app of allApps.results) {
    if (!app.tags) continue;
    try {
      const tags = JSON.parse(app.tags) as string[];
      for (const t of tags) tagCounts[t] = (tagCounts[t] || 0) + 1;
    } catch {}
  }
  const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);

  // Get top 50 apps (most popular) for the main index
  const result = await c.env.DB.prepare(
    `SELECT slug, name, tagline, tags, homepage_url
     FROM apps WHERE status = 'published' ORDER BY total_views DESC, published_at DESC LIMIT 50`
  ).all<{ slug: string; name: string; tagline: string; tags: string; homepage_url: string }>();

  const lines: string[] = [
    '# VibePub — Open Web App Store',
    `# ${total} published apps available at slug.vibepub.dev`,
    '# API: https://vibepub.dev/api',
    '# Search: https://vibepub.dev/api/search?q=QUERY',
    '# Filter by tag: https://vibepub.dev/api/apps?tag=TAG',
    '# App detail: https://vibepub.dev/api/apps/SLUG',
    '',
    '## Tags',
    ...sortedTags.map(([tag, count]) =>
      `- ${tag} (${count} apps): https://vibepub.dev/llms-tag.txt?t=${encodeURIComponent(tag)}`
    ),
    '',
    '## Top Apps',
  ];

  for (const app of result.results) {
    const tags = app.tags ? (() => { try { return JSON.parse(app.tags).join(', '); } catch { return ''; } })() : '';
    lines.push(`- ${app.name}: ${app.tagline || ''}${tags ? ` [${tags}]` : ''} | ${app.homepage_url || `https://${app.slug}.vibepub.dev`}`);
  }

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
});

// /llms-tag.txt?t=game — per-tag AI index with full descriptions
app.get('/llms-tag.txt', async (c) => {
  const tag = c.req.query('t');
  if (!tag) return new Response('Missing ?t= parameter', { status: 400 });

  const result = await c.env.DB.prepare(
    `SELECT slug, name, tagline, ai_description, tags, homepage_url
     FROM apps WHERE status = 'published' AND tags LIKE ? ORDER BY total_views DESC, published_at DESC LIMIT 100`
  ).bind(`%"${tag}"%`).all<{ slug: string; name: string; tagline: string; ai_description: string; tags: string; homepage_url: string }>();

  const lines: string[] = [
    `# VibePub — "${tag}" apps`,
    `# ${result.results.length} apps with this tag`,
    '',
  ];

  for (const app of result.results) {
    lines.push(`## ${app.name}`);
    lines.push(`URL: ${app.homepage_url || `https://${app.slug}.vibepub.dev`}`);
    if (app.tagline) lines.push(`Tagline: ${app.tagline}`);
    if (app.ai_description) lines.push(`Description: ${app.ai_description}`);
    if (app.tags) {
      try {
        const tags = JSON.parse(app.tags);
        if (tags.length) lines.push(`Tags: ${tags.join(', ')}`);
      } catch {}
    }
    lines.push('');
  }

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
});

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
