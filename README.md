<p align="center">
  <h1 align="center">🍺 VibePub</h1>
  <p align="center"><strong>Vibe it. Pub it.</strong></p>
  <p align="center">The open web app store for the AI generation.</p>
</p>

<p align="center">
  <a href="https://vibepub.dev">Website</a> ·
  <a href="#what-is-vibepub">What is VibePub?</a> ·
  <a href="#for-developers">For Developers</a> ·
  <a href="#roadmap">Roadmap</a> ·
  <a href="#contributing">Contributing</a>
</p>

---

## What is VibePub?

**VibePub** is an open-source web app marketplace where anyone can publish browser-based apps — no app store fees, no approval queues, no corporate gatekeepers.

Built for the AI era, where millions of developers are creating apps with tools like Cursor, Bolt, Claude, and more. You vibe-code an app → you pub it → the world can use it. That simple.

### The Problem

- **App stores are broken** — 30% fees, weeks-long reviews, strict rules, corporate control
- **AI is creating a developer explosion** — millions of new creators need somewhere to ship
- **Publishing a web app is still too hard** — domains, hosting, CI/CD, SSL... too many steps for a simple idea
- **In some regions (e.g. China), it's nearly impossible** — business licenses, ICP filing, copyright registration, content review — individual developers simply can't publish

### The Solution

VibePub gives every developer — from a high school student to a seasoned pro — a place to publish web apps in minutes:

```
You build an app (with AI or by hand)
    → Push to GitHub
    → VibePub builds, audits, and hosts it
    → Live at yourapp.vibepub.dev 🚀
```

**Zero cost. Zero gatekeepers. Open source everything.**

## Core Principles

### 🔓 Open Source First
Every app on VibePub must have its frontend source code publicly available. This enables:
- Community code review and trust
- AI-powered security auditing
- Transparency by default

### 🤖 AI-Native
- Developers deploy via API or CLI — AI agents can publish apps autonomously
- Users discover apps through semantic search — your AI can find and recommend apps
- AI-powered security scanning on every submission

### 🌍 For Everyone
- No business license required
- No app store fees
- No approval queues
- Works in any browser, any device, any country

### 📦 API-First
The REST API is the core product. Everything else — the website, CLI, integrations — is just a wrapper.

```
REST API          ← the one true interface
  ├── Web UI      ← for humans
  ├── CLI         ← for terminals
  └── AI agents   ← for the future
```

## For Developers

### How It Works

1. **Build** your web app (React, Vue, Svelte, plain HTML — anything that compiles to static files)
2. **Push** your code to a public GitHub repo
3. **Submit** via CLI or API: `vibepub publish --repo your/repo --tag v1.0`
4. **VibePub** clones your code → runs AI security audit → builds → deploys
5. **Live** at `yourapp.vibepub.dev` within minutes

### What You Can Publish

| App Type | Build |
|----------|-------|
| Pure HTML/CSS/JS | No build needed, hosted directly |
| React / Vue / Svelte | `npm run build` → static output |
| Next.js (static export) | `next export` → static |
| Astro | `astro build` → static |

### Frontend + Backend Apps

- VibePub hosts your **frontend** (static files)
- Your **backend** stays on your own server
- Frontend calls your backend API (standard CORS)
- Frontend is open source; backend can be closed source

### Trust Levels

| Level | Description |
|-------|-------------|
| 🟢 **Fully Open** | Frontend open source, no backend (pure client-side) |
| 🔵 **Open Frontend** | Frontend open source, connects to external backend |
| 🟡 **Audited** | Frontend audited, backend API security checked |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **API** | Hono (TypeScript) on Cloudflare Workers |
| **Database** | Cloudflare D1 (SQLite) |
| **Website** | Astro / Next.js |
| **App Hosting** | Cloudflare Pages |
| **Search** | Embedding-based semantic search |
| **Security** | Static analysis + LLM code review |
| **Build** | Sandboxed containers |

## Roadmap

### Phase 1 — MVP 🏗️
- [ ] REST API design + OpenAPI spec
- [ ] Basic website (app listing, search, app detail pages)
- [ ] Build pipeline (git clone → build → deploy to Cloudflare Pages)
- [ ] AI security scanning (basic)
- [ ] CLI tool (`vibepub publish / search / info`)
- [ ] 20-30 seed apps
- [ ] Launch on Hacker News + Reddit

### Phase 2 — Traction 📈
- [ ] AI semantic search
- [ ] Developer profiles + dashboard
- [ ] Ratings and reviews
- [ ] Cursor / Bolt integration
- [ ] Weekly featured newsletter
- [ ] Discord community
- [ ] Custom domain support

### Phase 3 — Growth 🌱
- [ ] Simplified Chinese localization
- [ ] Deep AI security auditing
- [ ] Trust level system
- [ ] Media coverage
- [ ] Developer stories series

### Phase 4 — Ecosystem 🌐
- [ ] Monetization features
- [ ] Enterprise edition
- [ ] Core team expansion
- [ ] Internationalization
- [ ] More AI tool integrations

## Contributing

VibePub is open source and community-driven. We welcome contributions!

- 🐛 Found a bug? [Open an issue](https://github.com/ashleytechhk/vibepub/issues)
- 💡 Have an idea? [Start a discussion](https://github.com/ashleytechhk/vibepub/discussions)
- 🔧 Want to contribute code? See [CONTRIBUTING.md](CONTRIBUTING.md)

### Development

```bash
# Clone the repo
git clone https://github.com/ashleytechhk/vibepub.git
cd vibepub

# Install dependencies
npm install

# Start dev server
npm run dev
```

## License

[MIT](LICENSE) — free to use, modify, and distribute.

---

<p align="center">
  <strong>VibePub</strong> — Vibe it. Pub it. 🍺
  <br />
  <a href="https://vibepub.dev">vibepub.dev</a>
  <br /><br />
  Made with ☕ by <a href="https://github.com/ashleytechhk">Ashley Technology</a>
</p>
