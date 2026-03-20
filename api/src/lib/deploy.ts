/**
 * Auto-deploy to Cloudflare Pages via API
 * Downloads files from GitHub, uploads to CF Pages Direct Upload
 */

interface DeployContext {
  owner: string;
  repo: string;
  tag: string;
  slug: string;
  githubToken?: string;
  cfAccountId: string;
  cfApiToken: string;
}

interface DeployResult {
  success: boolean;
  url?: string;
  error?: string;
}

const SKIP_PATHS = ['node_modules/', '.git/', '.DS_Store', 'Thumbs.db'];

export async function deployToCFPages(ctx: DeployContext): Promise<DeployResult> {
  const { owner, repo, tag, slug, githubToken, cfAccountId, cfApiToken } = ctx;

  const ghHeaders: Record<string, string> = {
    'User-Agent': 'VibePub-Deploy/1.0',
  };
  if (githubToken) ghHeaders['Authorization'] = `token ${githubToken}`;

  const cfHeaders: Record<string, string> = {
    'Authorization': `Bearer ${cfApiToken}`,
  };

  try {
    // 1. Get file tree from GitHub
    const treeResp = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${tag}?recursive=1`,
      { headers: { ...ghHeaders, Accept: 'application/vnd.github.v3+json' } }
    );
    if (!treeResp.ok) return { success: false, error: `Failed to fetch repo tree: HTTP ${treeResp.status}` };

    const treeData = await treeResp.json() as { tree: Array<{ path: string; type: string; size: number }> };
    const files = treeData.tree.filter(f =>
      f.type === 'blob' &&
      !SKIP_PATHS.some(sp => f.path.startsWith(sp) || f.path === sp)
    );

    if (files.length === 0) return { success: false, error: 'No files to deploy' };

    // 2. Ensure CF Pages project exists
    const projectCheck = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/pages/projects/${slug}`,
      { headers: cfHeaders }
    );

    if (!projectCheck.ok) {
      const createResp = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/pages/projects`,
        {
          method: 'POST',
          headers: { ...cfHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: slug, production_branch: 'main' }),
        }
      );
      if (!createResp.ok) {
        const err = await createResp.text();
        return { success: false, error: `Failed to create Pages project: ${err}` };
      }
    }

    // 3. Download files from GitHub and build manifest + FormData
    const formData = new FormData();
    const manifest: Record<string, string> = {};
    let downloadErrors = 0;

    // Download in batches of 10 to avoid overwhelming GitHub
    for (let i = 0; i < files.length; i += 10) {
      const batch = files.slice(i, i + 10);
      const results = await Promise.all(
        batch.map(async (file) => {
          const resp = await fetch(
            `https://raw.githubusercontent.com/${owner}/${repo}/${tag}/${file.path}`,
            { headers: { 'User-Agent': 'VibePub-Deploy/1.0' } }
          );
          if (!resp.ok) { downloadErrors++; return null; }
          const arrayBuffer = await resp.arrayBuffer();
          // Compute SHA-256 hash for manifest
          const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
          const hashHex = [...new Uint8Array(hashBuffer)].map(b => b.toString(16).padStart(2, '0')).join('');
          return { path: file.path, buffer: arrayBuffer, hash: hashHex };
        })
      );

      for (const result of results) {
        if (result) {
          const filePath = '/' + result.path;
          manifest[filePath] = result.hash;
          formData.append(filePath, new Blob([result.buffer]), result.path);
        }
      }
    }

    if (downloadErrors > files.length / 2) {
      return { success: false, error: `Too many download errors: ${downloadErrors}/${files.length}` };
    }

    // Add manifest as JSON string
    formData.append('manifest', JSON.stringify(manifest));

    // 4. Deploy to CF Pages via Direct Upload
    const deployResp = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/pages/projects/${slug}/deployments`,
      {
        method: 'POST',
        headers: cfHeaders,
        body: formData,
      }
    );

    if (!deployResp.ok) {
      const err = await deployResp.text();
      return { success: false, error: `CF Pages deploy failed: ${err}` };
    }

    const pagesUrl = `https://${slug}.pages.dev`;

    return { success: true, url: pagesUrl };
  } catch (e: any) {
    return { success: false, error: e.message || 'Deploy error' };
  }
}
