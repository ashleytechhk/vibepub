import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './types';
import auth from './routes/auth';
import apps from './routes/apps';
import search from './routes/search';
import developers from './routes/developers';
import build from './routes/build';

const app = new Hono<{ Bindings: Env }>();

// MIME type mapping for R2-served files
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.map': 'application/json',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.wasm': 'application/wasm',
};

function getMimeType(path: string): string {
  const ext = path.substring(path.lastIndexOf('.')).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

// Subdomain routing — serve app files from R2 bucket
app.use('*', async (c, next) => {
  const hostname = new URL(c.req.url).hostname;

  // Check if this is a subdomain request (e.g. qr-generator.vibepub.dev)
  if (hostname.endsWith('.vibepub.dev') && hostname !== 'vibepub.dev') {
    const subdomain = hostname.replace('.vibepub.dev', '');
    let pathname = new URL(c.req.url).pathname;

    // Default to index.html
    if (pathname === '/' || pathname === '') {
      pathname = '/index.html';
    }

    // R2 key: apps/{slug}/{path}
    const r2Key = `apps/${subdomain}${pathname}`;

    try {
      let object = await c.env.APP_BUCKET.get(r2Key);

      // If not found and no extension, try with /index.html (directory-style)
      if (!object && !pathname.includes('.')) {
        const dirKey = `apps/${subdomain}${pathname.replace(/\/$/, '')}/index.html`;
        object = await c.env.APP_BUCKET.get(dirKey);
      }

      if (!object) {
        return c.json({ error: `File not found: ${pathname}` }, 404);
      }

      const contentType = getMimeType(pathname);

      // Inject VibePub frame + SEO into HTML responses
      if (contentType.includes('text/html')) {
        const html = await object.text();

        // Look up app + developer info from D1
        const appData = await c.env.DB.prepare(`
          SELECT a.name, a.tagline, a.description, a.tags, a.repo_url, a.category,
                 a.ai_description, a.ai_faq, a.homepage_url, a.slug,
                 d.display_name AS developer_name, d.github_username, d.avatar_url AS developer_avatar
          FROM apps a LEFT JOIN developers d ON a.developer_id = d.id
          WHERE a.slug = ? AND a.status IN ('published', 'approved')
        `).bind(subdomain).first<{
          name: string; tagline: string; description: string; tags: string;
          repo_url: string; category: string; ai_description: string; ai_faq: string;
          homepage_url: string; slug: string; developer_name: string;
          github_username: string; developer_avatar: string;
        }>();

        const injectedHtml = injectVibePubFrame(html, subdomain, appData);
        return new Response(injectedHtml, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }

      // Non-HTML: serve directly from R2
      return new Response(object.body, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
          'ETag': object.httpEtag,
        },
      });
    } catch (err) {
      return c.json({ error: `App "${subdomain}" not found or unavailable` }, 502);
    }
  }

  await next();
});

function escHtml(str: string): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function injectVibePubFrame(
  html: string,
  subdomain: string,
  appData: {
    name: string; tagline: string; description: string; tags: string;
    repo_url: string; category: string; ai_description: string; ai_faq: string;
    homepage_url: string; slug: string; developer_name: string;
    github_username: string; developer_avatar: string;
  } | null
): string {
  const appName = appData?.name || subdomain;
  const appDesc = appData?.ai_description || appData?.description || appData?.tagline || '';
  const repoUrl = appData?.repo_url || '';
  // Extract original repo owner from repo_url (e.g. "pandao" from "https://github.com/pandao/editor.md")
  const repoOwner = repoUrl ? (repoUrl.match(/github\.com\/([^\/]+)/)?.[1] || '') : '';
  const devName = repoOwner || appData?.developer_name || appData?.github_username || '';
  const ghUsername = repoOwner || appData?.github_username || '';
  const tags = appData?.tags ? (() => { try { return JSON.parse(appData.tags) as string[]; } catch { return []; } })() : [];
  const faq = appData?.ai_faq ? (() => { try { return JSON.parse(appData.ai_faq) as { q: string; a: string }[]; } catch { return []; } })() : [];

  // --- GA4 ---
  const ga4 = `<script async src="https://www.googletagmanager.com/gtag/js?id=G-58GRDE9E88"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-58GRDE9E88',{page_title:'${subdomain}',content_group:'app'});</script>`;

  // --- SEO meta tags ---
  const seoTitle = `${escHtml(appName)} — Free Online Tool | VibePub`;
  const seoDesc = escHtml(appDesc.slice(0, 160)) || `Use ${escHtml(appName)} for free online. No signup, no download. Open source.`;
  const canonicalUrl = `https://${subdomain}.vibepub.dev`;
  const seoMeta = `<title>${seoTitle}</title>
<meta name="description" content="${seoDesc}">
<link rel="canonical" href="${canonicalUrl}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escHtml(appName)} — VibePub">
<meta property="og:description" content="${seoDesc}">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:site_name" content="VibePub">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escHtml(appName)} — VibePub">
<meta name="twitter:description" content="${seoDesc}">`;

  // --- Schema.org JSON-LD ---
  const schemaApp: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: appName,
    description: appDesc || `Free online ${appName}`,
    url: canonicalUrl,
    applicationCategory: appData?.category || 'Utility',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    isAccessibleForFree: true,
  };
  if (tags.length) schemaApp.keywords = tags.join(', ');
  if (devName) {
    schemaApp.author = { '@type': 'Person', name: devName, ...(ghUsername ? { url: `https://github.com/${ghUsername}` } : {}) };
  }
  let schemaLd = `<script type="application/ld+json">${JSON.stringify(schemaApp)}</script>`;

  // FAQ schema
  if (faq.length > 0) {
    const faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map(item => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    };
    schemaLd += `\n<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>`;
  }

  // --- Footer bar ---
  const devLink = devName ? `<a href="https://github.com/${escHtml(ghUsername)}" target="_blank" style="color:#656d76;text-decoration:none;">${escHtml(devName)}</a>` : 'Unknown';
  const repoLink = repoUrl ? `<a href="${escHtml(repoUrl)}" target="_blank" style="color:#656d76;text-decoration:none;">${escHtml(repoUrl)}</a>` : '';
  const footerBar = `<div id="vibepub-footer" style="position:fixed;bottom:0;left:0;right:0;z-index:999999;background:#fff;border-top:1px solid #e5e5e5;padding:6px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;color:#656d76;display:flex;align-items:center;justify-content:center;gap:0;letter-spacing:0.01em;">
Hosted by <a href="https://vibepub.dev" style="color:#656d76;text-decoration:none;margin-left:4px;">VibePub.dev</a>${repoLink ? `&nbsp; - &nbsp;GitHub Repo at&nbsp;${repoLink}` : ''}&nbsp; - &nbsp;Developed by&nbsp;${devLink}
</div>`;

  // --- Inject into HTML ---
  const headContent = `\n<!-- VibePub SEO + Analytics -->\n${ga4}\n${seoMeta}\n${schemaLd}\n`;
  let result = html;

  // Replace existing <title> if present, inject SEO into <head>
  if (result.includes('<head>')) {
    result = result.replace('<head>', '<head>' + headContent);
  } else if (result.includes('<HEAD>')) {
    result = result.replace('<HEAD>', '<HEAD>' + headContent);
  } else {
    result = headContent + result;
  }

  // Inject footer bar before </body>
  if (result.includes('</body>')) {
    result = result.replace('</body>', footerBar + '</body>');
  } else if (result.includes('</BODY>')) {
    result = result.replace('</BODY>', footerBar + '</BODY>');
  } else {
    result = result + footerBar;
  }

  return result;
}

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
