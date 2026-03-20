# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev                          # Start local dev server (Cloudflare Workers via wrangler)

# Deployment
npm run deploy                       # Deploy to production (Cloudflare Workers)

# Database migrations
npm run db:migrate:local             # Run migrations against local D1
npm run db:migrate:remote            # Run migrations against remote D1
```

There are no automated tests in this codebase. Manually test via the local dev server and the Cloudflare dashboard.

## Architecture

**VibePub** is a web app store where developers submit GitHub-hosted apps and get them published at `slug.vibepub.dev`.

### Runtime

Everything runs on **Cloudflare Workers** (serverless edge). A single worker handles:
- API requests (`/api/*`)
- Static asset serving (the `/web` HTML/JS/CSS frontend)
- Subdomain proxying — `*.vibepub.dev` requests are intercepted and proxied to the corresponding Cloudflare Pages project

### Stack

| Layer | Technology |
|---|---|
| Backend | Hono v4 on Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) |
| Frontend | Vanilla JS + plain HTML/CSS (no framework) |
| Auth | GitHub OAuth → JWT (HS256, 7-day expiry) |
| Email | Resend API |
| Hosting | Cloudflare Workers (API) + Cloudflare Pages (submitted apps) |

### Directory Layout

```
api/src/
  index.ts          # Worker entrypoint: CORS, subdomain routing middleware, route mounting
  types.ts          # Shared types: Env, Developer, App, Submission, JwtPayload
  routes/
    auth.ts         # GitHub OAuth flow + /api/auth/me
    apps.ts         # App submission, listing, and retrieval
    search.ts       # Full-text search across apps
    build.ts        # Build trigger + status endpoints
    developers.ts   # Public developer profiles
  middleware/
    auth.ts         # JWT sign/verify + auth middleware (Web Crypto API)
  lib/
    build-pipeline.ts  # Automated validation checklist (repo checks, file limits, etc.)
    email.ts           # Resend-powered transactional emails

api/migrations/
  0001_init.sql     # Schema: developers, api_keys, apps, submissions

web/
  index.html / dashboard.html / app.html / callback.html
  js/api.js         # API client helpers
  js/auth.js        # OAuth + localStorage token management
  js/app.js         # App browsing/listing
  js/dashboard.js   # Developer submission UI
  js/detail.js      # Individual app detail page
```

### Key Flows

**App Submission → Deployment:**
1. Developer POSTs to `/api/apps` with repo URL + tag
2. Build pipeline runs asynchronously via `executionCtx.waitUntil()` (fire-and-forget)
3. `build-pipeline.ts` validates via GitHub API (no cloning): license, `index.html`, file count/size limits, no committed `node_modules`, no suspicious files
4. On approval: deploys to a Cloudflare Pages project → live at `slug.vibepub.dev`
5. Email sent to developer with approval/rejection details

**Auth Flow:**
1. Frontend redirects to `/api/auth/github`
2. GitHub OAuth callback creates/updates developer in D1
3. Worker returns JWT; frontend stores in `localStorage`
4. All authenticated requests use `Authorization: Bearer <token>`

**Subdomain Routing:**
- Worker intercepts all `*.vibepub.dev` requests before asset serving
- Proxies to corresponding Cloudflare Pages project for that app slug

### Environment / Secrets

Local secrets go in `.dev.vars` (not committed). Production secrets set via `wrangler secret put`:
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` — GitHub OAuth app
- `JWT_SECRET` — JWT signing key
- `CF_ACCOUNT_ID`, `CF_API_TOKEN` — Cloudflare API access (for Pages deployment)
- `GITHUB_PAT` — GitHub PAT for repo inspection
- `RESEND_API_KEY` — Resend email service

The `wrangler.toml` binds:
- `DB` → D1 database (`vibepub-db`)
- `ASSETS` → static files from `./web`

## Voice Replies (TTS)

每次回覆 Simon 時，先用語音講重點摘要（1-2 句廣東話），再用文字補充詳細內容。

### 使用方法

```bash
# 1. Source env vars（每個 session 開始時做一次）
source /Users/shumkwan/clawd/shared/credentials/api-keys.env
export MINIMAX_VOICE_ID="moss_audio_e39b563e-0bbd-11f0-b576-92cb5d429e3c"
export MINIMAX_MODEL="speech-2.6-turbo"
export MINIMAX_VOICE_SPEED="0.9"
export MINIMAX_VOICE_VOLUME="2.0"

# 2. 生成語音
/Users/shumkwan/clawd/shared/.venv/bin/python3 /Users/shumkwan/clawd/shared/data/skills/minimax-tts/scripts/tts.py "你嘅廣東話文字" -o reply.mp3

# 3. 播放
afplay /tmp/reply.mp3
```

### TTS 文字撰寫規則
- **用英文標點**（`, . ! ? ...`），唔好用中文標點（`，。！？`）
- **唔好用 emoji** — 會被讀出名稱
- **唔好用 markdown**（`**粗體**`、`# 標題`）
- 用逗號同句號控制節奏
- 廣東話口語，自然簡潔

### 流程
1. 做完嘢 → 寫一段簡短廣東話摘要
2. 跑 TTS script 生成 MP3
3. `afplay` 播放俾 Simon 聽
4. 再打文字補充詳細內容

## Internal Docs

`internal_docs/` 目錄（symlink，唔入 git）包含項目文件：
- `overview.md` — 項目總覽
- `architecture.md` — 技術架構
- `decisions.md` — 所有決策記錄
- `database-schema.md` — DB Schema
- `changelog.md` — 開發歷史（每次完成工作後更新）

**每次完成開發工作後，更新 `internal_docs/changelog.md`。**



Deploy 要 set CLOUDFLARE_API_TOKEN env var。Token 喺 ~/.config/cloudflare/vibepub_token。Deploy 嘅時候用：

CLOUDFLARE_API_TOKEN=$(cat ~/.config/cloudflare/vibepub_token) npm run deploy