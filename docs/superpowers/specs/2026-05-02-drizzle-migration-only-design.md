# Database Schema: Drizzle Migration Only

**Date:** 2026-05-02
**Status:** Approved

## Problem

Database schema operations are spread across three mechanisms:

1. `migrations.ts` — inline SQL array with 22 CREATE TABLE + 4 CREATE INDEX
2. `database.ts` — 5 `ensureXxx()` runtime ALTER TABLE / table rebuild functions
3. `progress.ts` — runtime ALTER TABLE for `step_label` column

The `drizzle/` directory contains only a placeholder baseline (`SELECT 1;`) and is unused.

## Decision

Consolidate all schema management into Drizzle Kit migrations. No backward compatibility needed — this is a clean cut.

## Changes

### Delete

| File / Code | What to remove |
|---|---|
| `packages/backend/src/storage/migrations.ts` | Entire file — inline SQL migration array |
| `packages/backend/src/storage/database.ts` | 5 `ensureXxx` functions and their calls in `runMigrations()` |
| `packages/backend/src/storage/progress.ts` | `PRAGMA table_info` + `ALTER TABLE` for `step_label` |
| `drizzle/0000_runtime_migration_baseline.sql` | Placeholder baseline, replaced by real migration |

### Generate

Run `drizzle-kit generate` from `schema.ts` to produce a complete initial migration in `drizzle/` (e.g. `0000_initial_schema.sql`).

### Add

- npm script: `"db:generate": "drizzle-kit generate"`

### Update

| File | Change |
|---|---|
| `packages/backend/src/storage/database.ts` | Simplify `runMigrations()` to: pragmas → backup → `migrateDatabase()` (Drizzle migrator only). Remove import of `migrations.ts`. Remove all `ensureXxx` calls. |
| `packages/backend/src/storage/progress.ts` | Remove ALTER TABLE logic. The `step_label` column is already defined in `schema.ts` and will be created by the generated migration. |
| `tests/storage/migrate.test.ts` | Update to verify Drizzle migration flow instead of inline SQL |
| `tests/storage/database.test.ts` | Remove tests for deleted `ensureXxx` functions |

### Do NOT change

- `schema.ts` — already the correct single source of truth for table definitions
- `migrate.ts` — generic backup and Drizzle migrator utilities
- `drizzle.config.ts` — current config is sufficient (`db:generate` does not need a live DB)

## Startup flow (after)

```
createDatabase()
  → pragmas (WAL, foreign_keys, busy_timeout)
  → backupDatabaseBeforeMigration()   // file-based DBs only
  → migrateDatabase()                 // Drizzle migrator reads drizzle/
```

## Future schema change workflow

1. Edit `packages/backend/src/storage/schema.ts`
2. Run `pnpm run db:generate`
3. Review the generated SQL in `drizzle/`
4. Commit the migration file
