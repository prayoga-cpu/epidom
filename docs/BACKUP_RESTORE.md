# Backup & Restore

How epidom's data is backed up, and the concrete steps to restore it — including
the quarterly restore drill referenced in `docs/DATABASE.md`.

---

## What's backed up, and how

Two independent layers:

1. **Neon point-in-time recovery (PITR)** — built into Neon, no setup required.
   Restores the live database to any point within the retention window (7 days
   on production, 3 on staging). This is your fast path for "someone ran a bad
   query 20 minutes ago" — see Neon's own console for this, it's not part of
   the tooling below.
2. **Nightly logical backup to Cloudflare R2** — independent of Neon and
   Vercel entirely. Covers the case Neon PITR can't: the Neon project/account
   itself being unavailable, deleted, or compromised. This is what the rest of
   this doc covers.

The nightly backup is a `pg-copy-streams` `COPY "<table>" TO STDOUT`, gzipped,
per table, uploaded to `backups/<YYYY-MM-DD>/<table>.csv.gz` in R2
(`src/lib/backup/export-tables.ts`), run by the `nightly-database-backup`
Inngest cron function (2am daily) and retained for 90 days. **Schema is not
backed up** — it's already fully reproducible from `prisma/migrations/` in
git; a restore replays those migrations onto an empty database, then this
tooling replays the data on top.

A `check-backup-freshness` cron (9am daily) emails the team if the last
successful run is more than 36 hours old — the check that catches "the backup
silently stopped working." Both jobs no-op cleanly if R2 isn't configured yet
(`R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` /
`R2_BUCKET_NAME` — see `docs/ENVIRONMENT.md`). Status and history are visible
on `/admin/capacity`.

---

## Restoring

**Never restore directly into a database you care about.** Always restore
into a fresh, empty database, verify the data, then promote/cut over manually.
`scripts/restore-from-backup.ts` refuses to run against this app's own
`DATABASE_URL`/`DIRECT_URL` as a guardrail, but that's a backstop, not a
substitute for pointing it at the right place.

```bash
# 1. Stand up a fresh target database (see "Scratch database" below for a
#    local example) and apply the schema — the backup only carries data.
DATABASE_URL=<target> pnpm prisma migrate deploy

# 2. Restore the data for a given day
pnpm restore:backup --date=2026-08-10 --target=<target-connection-string>
# (or set RESTORE_DATABASE_URL instead of --target)
```

The script lists every `backups/<date>/*.csv.gz` object in R2, restores each
via `COPY ... FROM STDIN` inside a session with
`SET session_replication_role = replica` (the same mechanism `pg_dump`'s
data-only restore relies on, so tables can be restored in any order without
fighting foreign-key constraints), and prints a per-table row count plus a
summary. It is a CLI script on purpose — restoring into the wrong database is
catastrophic, so this stays a human-run action, never a web-triggerable admin
button.

After it finishes: spot-check row counts against `/admin/capacity`'s "Largest
Tables by Disk Size" panel for the same date, open a few real records (a
recent `Order`, a `User`), and only then consider promoting.

### Scratch database (for a drill, or a local restore test)

Reuses the same Docker setup as local dev (`docs/DATABASE.md`), under a
different container name so it doesn't collide with an actual local dev DB:

```bash
docker run --name epidom-restore-drill \
  -e POSTGRES_USER=epidom \
  -e POSTGRES_PASSWORD=epidom \
  -e POSTGRES_DB=epidom_restore_drill \
  -p 5433:5432 \
  -d postgres:16

TARGET="postgresql://epidom:epidom@localhost:5433/epidom_restore_drill"
DATABASE_URL=$TARGET pnpm prisma migrate deploy
pnpm restore:backup --date=<YYYY-MM-DD> --target=$TARGET

# Tear down when done
docker rm -f epidom-restore-drill
```

---

## Quarterly restore drill (manual)

`docs/DATABASE.md` calls for this every quarter. There's no automated
enforcement — it's a calendar reminder, done by hand:

1. Pick the most recent successful backup date from `/admin/capacity`.
2. Spin up the scratch database above and restore into it.
3. Verify: table row counts roughly match production (`/admin/capacity`'s
   size panel), a handful of spot-checked records look correct, and the
   restore script reported 0 failed tables.
4. Note the drill date, backup date used, and result (pass/fail + any issues)
   wherever the team tracks ops work.
5. Tear down the scratch database.

If a drill fails, that's the signal to fix the backup/restore path — not to
skip the next drill.
