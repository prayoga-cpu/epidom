# Documentation

Welcome to the Epidom docs. Start here if you're new.

---

## Read these first

| Doc | When you read it |
|---|---|
| [`/AGENTS.md`](../AGENTS.md) | You're an AI coding agent (Claude Code, Cursor, etc.). Read every time. |
| [`STRATEGY.md`](./STRATEGY.md) | You want to understand what Epidom is, who it serves, and why we made the bets we made. |
| [`roadmap.md`](./roadmap.md) | You want to know what we're building next and the dependencies between phases. |
| [`PHASE_0_CLEANUP.md`](./PHASE_0_CLEANUP.md) | You're starting work today. This is the active task list. |

---

## Build, run, deploy

| Doc | Purpose |
|---|---|
| [`INSTALLATION.md`](./INSTALLATION.md) | Local dev environment setup |
| [`ENVIRONMENT.md`](./ENVIRONMENT.md) | Required environment variables, service accounts, and how to get them |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | How we deploy to staging and production |
| [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) | Common errors and fixes |

---

## Architecture and code

| Doc | Purpose |
|---|---|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | High-level architecture decisions, route groups, providers |
| [`DATABASE.md`](./DATABASE.md) | Prisma schema, models, migrations, scoping rules |
| [`AUTH.md`](./AUTH.md) | Better Auth setup, session handling, plan-gating |
| [`API.md`](./API.md) | Public and private API conventions |
| [`I18N.md`](./I18N.md) | Internationalization, locale strategy |
| [`SECURITY.md`](./SECURITY.md) | Threat model, auth surface, payment security |
| [`ERROR_HANDLING.md`](./ERROR_HANDLING.md) | Error patterns, logging, user-facing fallbacks |

---

## Product and business

| Doc | Purpose |
|---|---|
| [`STRATEGY.md`](./STRATEGY.md) | Positioning, market, competitors |
| [`FEATURES.md`](./FEATURES.md) | What ships in each tier |
| [`BILLING.md`](./BILLING.md) | Pricing tiers, Stripe products, Xendit fees |

---

## Process

| Doc | Purpose |
|---|---|
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | How to make changes, branch naming, PR template |
| [`TESTING.md`](./TESTING.md) | Test strategy, what to cover, how to run |
| [`CHANGELOG.md`](./CHANGELOG.md) | Major changes, by date |

---

## How this docs folder is organized

- **Strategic docs** (`STRATEGY.md`, `roadmap.md`, `PHASE_X_*.md`) drive the product direction. They are the source of truth for "what" and "why."
- **Technical docs** (`ARCHITECTURE.md`, `DATABASE.md`, `AUTH.md`, etc.) describe how things are built. Source of truth for "how."
- **Process docs** (`CONTRIBUTING.md`, `TESTING.md`) describe how we work together.

When a doc disagrees with code, fix the doc first, then the code. Stale docs are worse than no docs.

---

## Conventions

- Headings are in sentence case, not title case
- File names: `kebab-case.md` for new docs, except for legacy `UPPER_SNAKE.md` files we inherited
- Lead with a visual (table, list, diagram), follow with prose
- One paragraph at the top of every doc states what it's for and when to read it
- Update the Changelog when you make a significant change to any doc here
