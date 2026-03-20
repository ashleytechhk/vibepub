/**
 * Auto-deploy to R2 Object Storage
 * Downloads files from GitHub, uploads to R2 bucket under apps/{slug}/
 */

interface DeployContext {
  owner: string;
  repo: string;
  tag: string;
  slug: string;
  githubToken?: string;
  appBucket: R2Bucket;
}

interface DeployResult {
  success: boolean;
  url?: string;
  error?: string;
}

const SKIP_PATHS = ['node_modules/', '.git/', '.github/', '.DS_Store', 'Thumbs.db'];
const SKIP_FILES = ['LICENSE', 'README.md', 'package.json', 'package-lock.json', '.gitignore'];

export async function deployToR2(ctx: DeployContext): Promise<DeployResult> {
  const { owner, repo, tag, slug, githubToken, appBucket } = ctx;

  const ghHeaders: Record<string, string> = {
    'User-Agent': 'VibePub-Deploy/1.0',
  };
  if (githubToken) ghHeaders['Authorization'] = `token ${githubToken}`;

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
      !SKIP_PATHS.some(sp => f.path.startsWith(sp) || f.path === sp) &&
      !SKIP_FILES.includes(f.path)
    );

    if (files.length === 0) return { success: false, error: 'No files to deploy' };

    // 2. Download files from GitHub and upload to R2
    let uploadErrors = 0;

    // Process in batches of 10 to avoid overwhelming GitHub
    for (let i = 0; i < files.length; i += 10) {
      const batch = files.slice(i, i + 10);
      const results = await Promise.all(
        batch.map(async (file) => {
          try {
            const resp = await fetch(
              `https://raw.githubusercontent.com/${owner}/${repo}/${tag}/${file.path}`,
              { headers: { 'User-Agent': 'VibePub-Deploy/1.0' } }
            );
            if (!resp.ok) { uploadErrors++; return; }
            const arrayBuffer = await resp.arrayBuffer();

            // Upload to R2: apps/{slug}/{path}
            const r2Key = `apps/${slug}/${file.path}`;
            await appBucket.put(r2Key, arrayBuffer);
          } catch {
            uploadErrors++;
          }
        })
      );
    }

    if (uploadErrors > files.length / 2) {
      return { success: false, error: `Too many upload errors: ${uploadErrors}/${files.length}` };
    }

    return { success: true, url: `https://${slug}.vibepub.dev` };
  } catch (e: any) {
    return { success: false, error: e.message || 'Deploy error' };
  }
}

/** Delete all R2 objects for an app slug */
export async function deleteFromR2(appBucket: R2Bucket, slug: string): Promise<void> {
  const prefix = `apps/${slug}/`;
  let cursor: string | undefined;

  do {
    const listed = await appBucket.list({ prefix, cursor });
    if (listed.objects.length > 0) {
      await appBucket.delete(listed.objects.map(o => o.key));
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
}
