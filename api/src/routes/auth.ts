import { Hono } from 'hono';
import { Env } from '../types';
import { signJwt } from '../middleware/auth';

const auth = new Hono<{ Bindings: Env }>();

// GET /api/auth/github — redirect to GitHub OAuth
auth.get('/github', (c) => {
  const clientId = c.env.GITHUB_CLIENT_ID;
  const redirectUri = new URL('/api/auth/github/callback', c.req.url).toString();
  const scope = 'read:user user:email';

  const githubUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;

  return c.redirect(githubUrl);
});

// GET /api/auth/github/callback — handle OAuth callback
auth.get('/github/callback', async (c) => {
  const code = c.req.query('code');
  if (!code) {
    return c.json({ error: 'Missing code parameter' }, 400);
  }

  // Exchange code for access token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      client_id: c.env.GITHUB_CLIENT_ID,
      client_secret: c.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
  if (!tokenData.access_token) {
    return c.json({ error: 'Failed to get access token', details: tokenData.error }, 400);
  }

  // Get GitHub user info
  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'User-Agent': 'VibePub',
    },
  });

  const githubUser = await userRes.json() as {
    id: number;
    login: string;
    email: string | null;
    name: string | null;
    avatar_url: string;
    bio: string | null;
    blog: string | null;
  };

  // Get email if not public
  let email = githubUser.email;
  if (!email) {
    const emailRes = await fetch('https://api.github.com/user/emails', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'User-Agent': 'VibePub',
      },
    });
    const emails = await emailRes.json() as Array<{ email: string; primary: boolean }>;
    email = emails.find(e => e.primary)?.email || emails[0]?.email || '';
  }

  const now = new Date().toISOString();
  const githubId = String(githubUser.id);

  // Find or create developer
  let developer = await c.env.DB.prepare(
    'SELECT * FROM developers WHERE github_id = ?'
  ).bind(githubId).first();

  if (!developer) {
    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO developers (id, github_id, github_username, email, display_name, avatar_url, bio, website, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      githubId,
      githubUser.login,
      email,
      githubUser.name || githubUser.login,
      githubUser.avatar_url,
      githubUser.bio,
      githubUser.blog,
      now,
      now
    ).run();

    developer = { id, github_username: githubUser.login };
  } else {
    // Update existing developer info
    await c.env.DB.prepare(
      `UPDATE developers SET github_username = ?, email = ?, display_name = ?, avatar_url = ?, bio = ?, website = ?, updated_at = ? WHERE github_id = ?`
    ).bind(
      githubUser.login,
      email,
      githubUser.name || githubUser.login,
      githubUser.avatar_url,
      githubUser.bio,
      githubUser.blog,
      now,
      githubId
    ).run();
  }

  // Generate JWT
  const jwt = await signJwt(
    {
      sub: developer.id as string,
      github_username: (developer.github_username || githubUser.login) as string,
    },
    c.env.JWT_SECRET
  );

  // Redirect to frontend callback page with token
  const baseUrl = new URL(c.req.url).origin;
  return c.redirect(`${baseUrl}/callback.html?token=${encodeURIComponent(jwt)}`);
});

// GET /api/auth/me — get current developer
auth.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const { verifyJwt } = await import('../middleware/auth');
  const token = authHeader.slice(7);
  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  const developer = await c.env.DB.prepare(
    'SELECT id, github_id, github_username, email, display_name, avatar_url, bio, website, app_count, status, created_at FROM developers WHERE id = ?'
  ).bind(payload.sub).first();

  if (!developer) {
    return c.json({ error: 'Developer not found' }, 404);
  }

  return c.json({ developer });
});

export default auth;
