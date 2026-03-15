# Contributing to VibePub

Thanks for your interest in contributing to VibePub! 🍺

## How to Contribute

### Reporting Bugs

- Search [existing issues](https://github.com/ashleytechhk/vibepub/issues) first
- Include steps to reproduce, expected vs actual behavior
- Screenshots or logs help a lot

### Suggesting Features

- Open a [discussion](https://github.com/ashleytechhk/vibepub/discussions) first
- Describe the problem you're trying to solve
- We'll discuss before you start coding

### Pull Requests

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Write/update tests if applicable
5. Commit with clear messages
6. Push and open a PR

### Code Style

- TypeScript for all new code
- Follow existing patterns and conventions
- Run linting before submitting

## Project Structure

```
vibepub/
├── apps/
│   └── web/          # Platform website (Astro/Next.js)
├── api/              # Backend API (Hono on CF Workers)
├── packages/
│   ├── db/           # D1 database schema + migrations
│   └── shared/       # Shared types and utilities
├── cli/              # CLI tool
└── docs/             # Documentation
```

## Development Setup

```bash
git clone https://github.com/ashleytechhk/vibepub.git
cd vibepub
npm install
npm run dev
```

## Governance

VibePub follows a **BDFL (Benevolent Dictator For Life)** model. The project maintainer has final say on all decisions. Community input is valued and encouraged, but the maintainer makes the call.

## Code of Conduct

Be respectful, inclusive, and constructive. We're building something for everyone.

---

Questions? Open an issue or join the discussion. Welcome aboard! 🚀
