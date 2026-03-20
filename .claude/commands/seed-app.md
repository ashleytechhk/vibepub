# Seed App — Add an open source app to VibePub

Given a GitHub repo URL, fetch all info, generate high-quality AI content, and deploy to VibePub in one step.

## Input

$ARGUMENTS — A GitHub repository URL (e.g. https://github.com/user/repo)

## Steps

### 1. Fetch Repo Info from GitHub

Use `gh api` to get:
- Repo name, description, topics, license, default branch
- Latest tag (if any, otherwise use default branch)
- README.md content

### 2. Generate AI Content (using Claude — YOU)

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

### 3. Submit to VibePub

Call the admin seed API:

```bash
curl -s -X POST "https://vibepub.dev/api/apps/admin/seed" \
  -H "Authorization: Bearer $VIBEPUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d @/tmp/vibepub-seed.json
```

The JWT token should be retrieved from the user if not available. Ask: "我需要你嘅 JWT token。喺 vibepub.dev login 後，browser console 打 `localStorage.getItem('vibepub_token')` 攞。"

### 4. Verify

After submission, verify the app is live by checking:
- `https://{slug}.vibepub.dev/` returns 200
- Footer bar is injected correctly

### 5. Report

Output a summary:
- App name + URL
- AI description preview (first 100 chars)
- Number of FAQ items
- Deploy status

## Important Notes

- Do NOT use Cloudflare Workers AI (Llama) — use YOUR OWN intelligence (Claude) to generate content
- Quality matters: the AI content should be professional, SEO-optimized, and genuinely useful
- If the repo has no tags, use the default branch (usually `main`)
- Always write the full JSON to `/tmp/vibepub-seed.json` before sending so it can be reviewed
- Update `internal_docs/changelog.md` after successful seeding
