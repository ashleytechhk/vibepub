# Seed App — Add an open source app to VibePub

Given a GitHub repo URL, fetch all info, validate it, generate high-quality AI content, and deploy to VibePub in one step.

## Input

$ARGUMENTS — A GitHub repository URL (e.g. https://github.com/user/repo)

## Steps

### 1. Fetch Repo Info from GitHub

Use `gh api` to get:
- Repo name, description, topics, license, default branch
- Latest tag (if any, otherwise use default branch)
- README.md content
- File tree (for validation)

### 2. Pre-flight Checks (MUST PASS before proceeding)

#### Check 1: License allows redistribution
Fetch the repo license via `gh api repos/{owner}/{repo} --jq '.license.spdx_id'`.

**Allowed licenses:** MIT, BSD-2-Clause, BSD-3-Clause, Apache-2.0, ISC, Unlicense, MPL-2.0, 0BSD, CC0-1.0, WTFPL, Zlib

**If no license or non-allowed license:** STOP and report to user:
> "This repo has license: {license}. We can only redistribute apps with permissive open source licenses (MIT, BSD, Apache 2.0, etc.). Skipping."

#### Check 2: Pure static — no build step required
Fetch file tree via `gh api repos/{owner}/{repo}/git/trees/{branch}?recursive=1`.

**Must have:** `index.html` at the root level.

**Must NOT have any of these (indicates build required):**
- Build config files: `webpack.config.js`, `webpack.config.ts`, `vite.config.js`, `vite.config.ts`, `rollup.config.js`, `rollup.config.mjs`, `tsconfig.json`, `.babelrc`, `babel.config.js`, `Gruntfile.js`, `Gulpfile.js`, `next.config.js`, `next.config.mjs`, `nuxt.config.js`, `nuxt.config.ts`, `svelte.config.js`, `angular.json`, `astro.config.mjs`
- Source files that need compilation: any `.ts`, `.tsx`, `.jsx`, `.vue`, `.svelte` files
- `package.json` with a `build` script (fetch raw `package.json` and check `scripts.build`)

**Note:** `package.json` alone is OK if it has no `build` script (some static repos use it for metadata only). CSS preprocessors like `.scss`/`.less` also indicate a build step.

**If build required:** STOP and report to user:
> "This repo requires a build step ({reason}). We only support pure static apps that can be deployed as-is. Skipping."

### 3. Generate AI Content (using Claude — YOU)

Based on the README and repo info, generate:

**`ai_description`** (120-160 words):
- SEO-optimized, natural language that AI assistants would cite
- Start with "{App Name} is..."
- Explain what it does, who it's for, key benefits
- Include keywords: "free", "online", "open source", "no signup", "no download"
- Mention it runs in the browser (client-side)

**`ai_faq`** (5-8 Q&A pairs):
- Match what users or AI models would ask
- Always include: "What does X do?", "Is X free?", "How do I use X?"
- Add use-case specific questions
- Keep answers 1-2 sentences

**`slug`**: URL-friendly name (lowercase, hyphens only, max 50 chars). Should be short and SEO-friendly (e.g. "json-formatter" not "json-formatter-online-tool-v2").

**`name`**: Clean, title-case app name.

**`tagline`**: One sentence, max 100 chars.

**`description`**: 1-2 paragraph plain text description.

**`tags`**: Array of relevant tags (max 10). Pick from high-value keywords: calculator, json, markdown, regex, color, timer, password, converter, editor, diff, qr-code, css, base64, jwt, word-counter, resume, invoice, kanban, whiteboard, pixel-art, typing, pomodoro, etc.

**`category`**: One of: utility, productivity, game, education, entertainment, developer, design, communication, finance, health, other.

### 4. Submit to VibePub

Write the full JSON to `/tmp/vibepub-seed.json`, then call the admin seed API:

```bash
curl -s -X POST "https://vibepub.dev/api/apps/admin/seed" \
  -H "Authorization: Bearer $VIBEPUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d @/tmp/vibepub-seed.json
```

The JWT token should be retrieved from the user if not available. Ask: "我需要你嘅 JWT token。喺 vibepub.dev login 後，browser console 打 `localStorage.getItem('vibepub_token')` 攞。"

### 5. Verify

After submission, verify the app is live by checking:
- `https://{slug}.vibepub.dev/` returns 200
- Footer bar is injected correctly

### 6. Report

Output a summary:
- App name + URL
- License
- File count
- AI description preview (first 100 chars)
- Number of FAQ items
- Deploy status (new or updated)

## Important Notes

- Do NOT use Cloudflare Workers AI (Llama) — use YOUR OWN intelligence (Claude) to generate content
- Quality matters: the AI content should be professional, SEO-optimized, and genuinely useful
- If the repo has no tags, use the default branch (usually `main` or `master`)
- Always write the full JSON to `/tmp/vibepub-seed.json` before sending so it can be reviewed
- If slug already exists on VibePub, the API will update instead of creating a new entry
- Update `internal_docs/changelog.md` after successful seeding
