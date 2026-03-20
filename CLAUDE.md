# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ MANDATORY: Voice Reply（每次都要做，唔准 Skip！）

每次完成任務回覆 Simon 時，**必須**先用語音講重點，再打文字。唔准 skip，唔准「下次先做」。

```bash
# One-liner — 直接用，唔使 source 任何嘢
MINIMAX_GROUP_ID=$(grep MINIMAX_GROUP_ID /Users/shumkwan/clawd/shared/credentials/api-keys.env | cut -d= -f2 | tr -d '"') \
MINIMAX_API_KEY=$(grep MINIMAX_API_KEY /Users/shumkwan/clawd/shared/credentials/api-keys.env | cut -d= -f2 | tr -d '"') \
MINIMAX_VOICE_ID="moss_audio_e39b563e-0bbd-11f0-b576-92cb5d429e3c" \
MINIMAX_MODEL="speech-2.6-turbo" \
MINIMAX_VOICE_SPEED="0.9" \
MINIMAX_VOICE_VOLUME="2.0" \
/Users/shumkwan/clawd/shared/.venv/bin/python3 /Users/shumkwan/clawd/shared/data/skills/minimax-tts/scripts/tts.py "你嘅廣東話摘要" -o reply.mp3 && afplay /tmp/reply.mp3
```

### 規則
- **每次完成任務都要做** — 冇例外
- **廣東話口語** — 1-2 句，自然簡潔
- **英文標點**（`, . ! ? ...`）— 唔好用中文標點（`，。！？`）
- **唔好用 emoji / markdown** — 會被讀出嚟
- **如果 TTS fail** — retry 一次。仍然 fail 就講「語音生成失敗」然後繼續文字回覆，唔好靜靜雞 skip
- **Deploy 之後都要講** — 「搞掂喇, 已經 deploy 咗」

## ⭐ 當前策略：Phase 1b — Self-Seed（2026-03-20 起）

### 方向
**自己手動加 app 上嚟攞流量先，Skip 所有用戶註冊相關功能。**

### 點解
- 用戶註冊有大量 edge case（spam、驗證、error handling）
- 自己加 = 質量可控，唔 work 就刪
- 淨用簡單 pure HTML/CSS/JS app（static files）
- 先有 SEO 排名 + 流量，之後先開放用戶註冊

### 而家要做嘅嘢
1. **寫個 Admin Script** — 方便手動加 app 入 D1（唔使人手跑 SQL）
   - 輸入：GitHub repo URL
   - 自動：clone → 部署到 CF Pages → 寫入 D1 → SEO 優化
2. **SEO/GEO 優化每個 App Page** — title、description、Schema.org JSON-LD、FAQ、Open Graph
3. **揀 20-30 個高搜尋量 pure HTML open source app** — 參考 `internal_docs/keyword-research.md`
4. **手動 Deploy 上 Cloudflare Pages** — `wrangler pages deploy`

### 唔使做（延後到 Phase 2）
- ❌ 用戶註冊 / login 改善
- ❌ GitHub repo owner 驗證
- ❌ Rate limiting / anti-spam
- ❌ Claim App 功能
- ❌ Build pipeline 自動化（手動就得）
- ❌ Email 通知

### 參考文件
- `internal_docs/seed-strategy.md` — 完整 seed 策略 + Phase 0 定義
- `internal_docs/keyword-research.md` — 關鍵字研究 + Top 20 seed app 推薦
- `internal_docs/ai-recommendation-research.md` — AI 推薦場景分析
- `internal_docs/changelog.md` — 開發歷史 + TODO list

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