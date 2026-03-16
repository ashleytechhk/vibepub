/**
 * VibePub Build Pipeline
 *
 * Flow: Submit → Checklist → Fetch Files → Deploy CF Pages → Publish
 * AI security scan is Phase 2 — this is the basic structural checklist.
 */

// ── Types ──────────────────────────────────────────────

export interface CheckItem {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  message: string;
}

export interface BuildResult {
  success: boolean;
  checklist: CheckItem[];
  pagesUrl?: string;
  error?: string;
}

interface RepoFile {
  path: string;
  size: number;
  sha: string;
  type: 'blob' | 'tree';
}

interface BuildContext {
  owner: string;
  repo: string;
  tag: string;
  slug: string;
  githubToken?: string;
}

// ── Constants ──────────────────────────────────────────

const MAX_FILE_SIZE = 50 * 1024 * 1024;     // 50 MB total
const MAX_SINGLE_FILE = 25 * 1024 * 1024;   // 25 MB per file
const MAX_FILE_COUNT = 1000;
const GITHUB_UA = 'VibePub-Build/1.0';

const SUSPICIOUS_EXTENSIONS = [
  '.exe', '.dll', '.bat', '.cmd', '.msi', '.scr', '.pif',
  '.com', '.vbs', '.wsf', '.ps1',
];

const SKIP_PATHS = [
  'node_modules/',
  '.git/',
  '.DS_Store',
  'Thumbs.db',
];

// ── Main Pipeline ──────────────────────────────────────

export async function runBuildPipeline(ctx: BuildContext): Promise<BuildResult> {
  const checklist: CheckItem[] = [];
  const { owner, repo, tag, slug, githubToken } = ctx;

  const ghHeaders: Record<string, string> = {
    'User-Agent': GITHUB_UA,
    Accept: 'application/vnd.github.v3+json',
  };
  if (githubToken) {
    ghHeaders.Authorization = `token ${githubToken}`;
  }

  try {
    // ── 1. Repo accessible ────────────────────────────
    const repoResp = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: ghHeaders });
    const repoOk = repoResp.ok;
    const repoData = repoOk ? (await repoResp.json()) as Record<string, unknown> : null;

    checklist.push({
      id: 'repo_accessible',
      name: 'Repository accessible',
      status: repoOk ? 'pass' : 'fail',
      message: repoOk ? `${owner}/${repo} ✓` : `HTTP ${repoResp.status} — repo not found or private`,
    });
    if (!repoOk) return fail(checklist, 'Repository not accessible');

    // ── 2. License check ──────────────────────────────
    const license = (repoData as any)?.license;
    checklist.push({
      id: 'license_exists',
      name: 'License file',
      status: license ? 'pass' : 'warn',
      message: license ? `${license.spdx_id} license detected` : 'No license detected — consider adding one',
    });

    // ── 3. Tag / ref exists ───────────────────────────
    const treeResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${tag}?recursive=1`, { headers: ghHeaders });
    const treeOk = treeResp.ok;

    checklist.push({
      id: 'tag_exists',
      name: 'Tag / ref exists',
      status: treeOk ? 'pass' : 'fail',
      message: treeOk ? `"${tag}" found` : `"${tag}" not found — check tag name`,
    });
    if (!treeOk) return fail(checklist, `Tag "${tag}" not found`);

    const treeData = (await treeResp.json()) as { tree: RepoFile[] };
    const allFiles = treeData.tree.filter(f => f.type === 'blob');
    const files = allFiles.filter(f => !SKIP_PATHS.some(sp => f.path.startsWith(sp) || f.path === sp));

    // ── 4. Has index.html ─────────────────────────────
    const hasIndex = files.some(f => f.path === 'index.html');
    const hasNestedIndex = !hasIndex && files.some(f => f.path.endsWith('/index.html'));

    checklist.push({
      id: 'has_index_html',
      name: 'Has index.html',
      status: hasIndex ? 'pass' : hasNestedIndex ? 'warn' : 'fail',
      message: hasIndex
        ? 'Root index.html found'
        : hasNestedIndex
          ? 'index.html found in subdirectory (may need build step)'
          : 'No index.html — pure HTML apps need one at root',
    });
    if (!hasIndex && !hasNestedIndex) return fail(checklist, 'No index.html found');

    // ── 5. File count ─────────────────────────────────
    checklist.push({
      id: 'file_count',
      name: 'File count',
      status: files.length <= MAX_FILE_COUNT ? 'pass' : 'fail',
      message: `${files.length} files${files.length > MAX_FILE_COUNT ? ` (limit: ${MAX_FILE_COUNT})` : ''}`,
    });
    if (files.length > MAX_FILE_COUNT) return fail(checklist, 'Too many files');

    // ── 6. Total size ─────────────────────────────────
    const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);
    const sizeMB = (totalSize / 1024 / 1024).toFixed(2);

    checklist.push({
      id: 'size_check',
      name: 'Total size',
      status: totalSize <= MAX_FILE_SIZE ? 'pass' : 'fail',
      message: `${sizeMB} MB${totalSize > MAX_FILE_SIZE ? ' (limit: 50 MB)' : ''}`,
    });
    if (totalSize > MAX_FILE_SIZE) return fail(checklist, 'Exceeds 50 MB size limit');

    // ── 7. No suspicious files ────────────────────────
    const suspicious = files.filter(f =>
      SUSPICIOUS_EXTENSIONS.some(ext => f.path.toLowerCase().endsWith(ext))
    );

    checklist.push({
      id: 'no_suspicious',
      name: 'No suspicious files',
      status: suspicious.length === 0 ? 'pass' : 'warn',
      message: suspicious.length === 0
        ? 'No suspicious file types'
        : `Found: ${suspicious.map(f => f.path).join(', ')}`,
    });

    // ── 8. No node_modules committed ──────────────────
    const hasNodeModules = allFiles.some(f => f.path.startsWith('node_modules/'));

    checklist.push({
      id: 'no_node_modules',
      name: 'No node_modules',
      status: hasNodeModules ? 'warn' : 'pass',
      message: hasNodeModules ? 'node_modules should not be committed' : 'Clean repo',
    });

    // ── All checks passed! ─────────────────────────────
    // Deployment is handled by a local script using `wrangler pages deploy`.
    // The Worker marks the submission as 'approved' and the deploy script
    // picks it up, clones the repo, deploys to CF Pages, and updates the DB.
    return { success: true, checklist };

  } catch (err: any) {
    checklist.push({
      id: 'unexpected_error',
      name: 'Pipeline error',
      status: 'fail',
      message: err.message || 'Unknown error',
    });
    return fail(checklist, err.message || 'Unexpected pipeline error');
  }
}

// ── Helpers ────────────────────────────────────────────

function fail(checklist: CheckItem[], error: string): BuildResult {
  return { success: false, checklist, error };
}

/** Format checklist as a readable report */
export function formatChecklist(checklist: CheckItem[]): string {
  const icons: Record<CheckItem['status'], string> = { pass: '✅', fail: '❌', warn: '⚠️', skip: '⏭️' };
  return checklist
    .map(c => `${icons[c.status]} ${c.name}: ${c.message}`)
    .join('\n');
}
