# Documentation

Welcome to the Epidom docs. Start here if you're new.

---

## Read these first

| Doc                            | When you read it                                                                        |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| [`/AGENTS.md`](../AGENTS.md)   | You're an AI coding agent (Claude Code, Cursor, etc.). Read every time.                 |
| [`STRATEGY.md`](./STRATEGY.md) | You want to understand what Epidom is, who it serves, and why we made the bets we made. |
| [`roadmap.md`](./roadmap.md)   | You want to know what we're building next and the dependencies between phases.          |
| [`/STATUS.md`](../STATUS.md)   | You want the current state of the work and what's open.                                 |

---

## Build, run, deploy

| Doc                                        | Purpose                                                               |
| ------------------------------------------ | --------------------------------------------------------------------- |
| [`ENVIRONMENT.md`](./ENVIRONMENT.md)       | Required environment variables, service accounts, and how to get them |
| [`BACKUP_RESTORE.md`](./BACKUP_RESTORE.md) | How data is backed up, and the steps to restore it (incl. the drill)  |

---

## Architecture and code

| Doc                                    | Purpose                                                          |
| -------------------------------------- | ---------------------------------------------------------------- |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | High-level architecture decisions, route groups, providers       |
| [`DATABASE.md`](./DATABASE.md)         | Prisma schema, models, migrations, scoping rules                 |
| [`OFFLINE_POS.md`](./OFFLINE_POS.md)   | How the POS keeps selling offline, what it promises, what's next |

---

## Product and business

| Doc                            | Purpose                                     |
| ------------------------------ | ------------------------------------------- |
| [`STRATEGY.md`](./STRATEGY.md) | Positioning, market, competitors            |
| [`FEATURES.md`](./FEATURES.md) | What ships in each tier                     |
| [`BILLING.md`](./BILLING.md)   | Pricing tiers, Stripe products, Xendit fees |

---

## Process and history

| Doc                                    | Purpose                                       |
| -------------------------------------- | --------------------------------------------- |
| [`/CHANGELOG.md`](../CHANGELOG.md)     | Major changes, by version                     |
| [`/STATUS.md`](../STATUS.md)           | Current state of the work                     |
| [`status-archive/`](./status-archive/) | Older STATUS.md snapshots, kept for reference |

---

## Design records (shipped)

Finished plans, kept at their path because source-code comments cite them.

| Doc                                                | Purpose                                       |
| -------------------------------------------------- | --------------------------------------------- |
| [`AUDIT_LOG_PLAN.md`](./AUDIT_LOG_PLAN.md)         | Audit log design (activity, action log, undo) |
| [`dashboard-revamp.md`](./dashboard-revamp.md)     | Dashboard revamp                              |
| [`back-office-revamp.md`](./back-office-revamp.md) | Back Office revamp                            |
| [`website-redesign.md`](./website-redesign.md)     | Marketing website redesign                    |

---

## How this docs folder is organized

- **Strategic docs** (`STRATEGY.md`, `roadmap.md`) drive the product direction. They are the source of truth for "what" and "why."
- **Technical docs** (`ARCHITECTURE.md`, `DATABASE.md`, `OFFLINE_POS.md`, etc.) describe how things are built. Source of truth for "how."
- **Design records** (see above) are finished plans, kept for the reasoning behind shipped work.

When a doc disagrees with code, fix the doc first, then the code. Stale docs are worse than no docs.

---

## Conventions

- Headings are in sentence case, not title case
- File names: `kebab-case.md` for new docs, except for legacy `UPPER_SNAKE.md` files we inherited
- Lead with a visual (table, list, diagram), follow with prose
- One paragraph at the top of every doc states what it's for and when to read it
- Update the root `CHANGELOG.md` when you make a significant change
