# Drizzle SQLite Migration Design

**Goal:** Replace the current hardcoded startup-schema path with a formal migration system while keeping runtime behavior, IPC contracts, and user-visible functionality stable.

**Scope:** This pass standardizes SQLite schema definition, migration generation, migration execution, and repository access patterns for the Electron main-process database layer. It keeps the app on SQLite and preserves the existing `better-sqlite3` runtime model.

## Current Shape

The app already uses SQLite through `better-sqlite3`, and the main process correctly owns the database connection. That part is a good fit for Electron and should stay.

The weak spot is schema lifecycle management:

- `src/storage/migrations.ts` stores the schema as one large SQL blob array.
- `src/storage/database.ts` executes those SQL strings on startup.
- Incremental schema changes are patched in runtime code through ad hoc guards such as `ALTER TABLE ... ADD COLUMN`.
- Development reset logic is mixed into the production startup path.

This works for a fast-moving single-developer phase, but it creates avoidable risk once the schema evolves across multiple features:

- migration history is not first-class or reviewable per change
- runtime code owns schema repair logic that should live in migrations
- column and table evolution is difficult to reason about across branches
- test setup depends on hidden startup behavior rather than explicit migration state

## Decision

Adopt **Drizzle ORM + drizzle-kit** on top of the existing `better-sqlite3` driver.

This is the recommended path for this codebase because it fits all of the current constraints at once:

- keeps SQLite as an embedded local database
- keeps `better-sqlite3` as the connection driver
- supports formal migration files committed to git
- supports TypeScript-first schema definition
- allows gradual repository migration instead of a forced full rewrite

Alternative tools were considered:

- **Kysely** is a strong second option and a good fit for SQL-heavy teams, but its schema and migration workflow is less unified for this repository than Drizzle.
- **Prisma** has excellent migration tooling, but it would pull the storage layer toward a different client model and carries more migration overhead for an Electron-local SQLite app.
- **Knex/TypeORM** are viable but are no longer the best-fit modern default for a TypeScript-first SQLite desktop app that wants a lightweight runtime and gradual adoption.

## Target Architecture

The storage layer is split into four responsibilities:

1. **Schema definition**
   TypeScript schema modules define tables, columns, indexes, and relationships.

2. **Migration generation and storage**
   `drizzle-kit` generates versioned migration files under a dedicated migration directory that is committed to git.

3. **Migration execution**
   App startup runs the Drizzle migration runner against the local SQLite file before repositories are created.

4. **Repository access**
   Storage repositories continue to provide the current app-facing interface, but their implementation gradually moves from raw `better-sqlite3` statements to Drizzle queries.

The important boundary is that the rest of the app should still depend on repository contracts, not directly on Drizzle. This keeps the migration contained to the persistence layer and minimizes application-wide churn.

## File Structure

Add the following structure:

- `drizzle.config.ts`
  Drizzle Kit configuration for schema discovery, output directory, and SQLite dialect.
- `drizzle/`
  Versioned migration files and migration metadata tracked in git.
- `src/db/schema/`
  Table definitions grouped by domain, such as `books.ts`, `story-bibles.ts`, `chapters.ts`, and shared helpers.
- `src/db/client.ts`
  Creates the Drizzle database instance from the existing `better-sqlite3` connection.
- `src/db/migrate.ts`
  Runs startup migrations against the local database file.

Keep `src/storage/` in place for now. Existing repository module names and exports are already widely used in the app and tests, so preserving that boundary reduces risk. The implementation inside those modules can change without forcing a broader refactor.

## Migration Strategy

Schema evolution should move from implicit runtime patching to explicit migration files.

The new rules are:

- schema shape is authored in Drizzle schema files
- migration history is stored as generated SQL files in `drizzle/`
- startup executes only the formal migration runner
- schema repair logic no longer lives inline in production startup code

That means the following legacy patterns should be removed from the main path:

- manual `ensure...Column()` guards in startup code
- catch-all startup `ALTER TABLE` patches
- destructive development reset logic mixed into normal app boot

If development reset remains useful, it should move into a dedicated script or test helper rather than living in the normal runtime path.

## Compatibility Strategy

The migration must be as non-breaking as possible.

To preserve behavior:

- keep existing table names unless there is a hard technical reason not to
- keep existing column names unless a mismatch blocks Drizzle modeling
- keep JSON payload storage as `TEXT` columns serialized by repositories
- keep existing repository return shapes and input contracts stable
- keep Electron runtime ownership of the database connection stable
- keep IPC channels and service contracts unchanged

This deliberately avoids an app-wide “ORM rewrite” even though the storage implementation is being modernized.

## Repository Migration Plan

Repository migration should be gradual, not all-at-once.

### Phase 1: Infrastructure

Introduce Drizzle and formal migrations without changing the rest of the app’s behavior:

- add `drizzle-orm` and `drizzle-kit`
- define current schema in Drizzle modules
- generate baseline migrations
- switch startup from `db.exec(migrations)` to Drizzle migration execution
- keep current repository public APIs intact

At the end of this phase, the app should already stop depending on the monolithic hardcoded migration array.

### Phase 2: Low-risk repositories

Migrate the smallest and least-coupled repositories first:

- settings
- model configs
- books

This validates Drizzle usage patterns with minimal blast radius.

### Phase 3: Narrative repositories

Migrate the remaining structured domain repositories:

- story bibles
- character arcs and character states
- relationship edges and relationship states
- world rules
- narrative threads
- volume plans
- chapter cards and chapter-related tables
- scene records and checkpoints

This phase should preserve repository interfaces so the service layer does not need semantic rewrites.

### Phase 4: Cleanup

After all repositories are running on Drizzle:

- remove `src/storage/migrations.ts`
- remove startup schema patch helpers
- remove or isolate development-only reset logic
- simplify database bootstrapping around a single migration path

## Runtime Flow

The runtime should follow this sequence:

1. Open the SQLite database through `better-sqlite3`.
2. Apply required pragmas such as WAL mode and foreign key enforcement.
3. Create the Drizzle wrapper from the open connection.
4. Run pending migrations from the migration directory.
5. Build repository instances.
6. Continue normal runtime/service boot.

This preserves the app’s current startup model while making schema evolution explicit and repeatable.

## Testing Strategy

The migration is only acceptable if it proves stability through tests.

Coverage should include:

- storage schema tests that verify expected tables and critical columns after migration
- migration execution tests against fresh SQLite files
- migration execution tests against representative existing databases when possible
- existing repository tests adapted to the new persistence implementation
- service tests that prove repository behavior is unchanged
- runtime smoke tests that confirm startup still succeeds in mock and normal flows

Test helpers should continue to support `:memory:` databases or provide an equivalent temporary-file setup if Drizzle migration execution requires it.

## Risks

The main risks are:

- accidental schema drift while translating the existing SQL blob into Drizzle schema files
- behavior changes hidden inside repository rewrites, especially JSON serialization and row mapping
- test setup differences between `:memory:` databases and file-backed migration execution
- migration conflicts if old runtime repair logic and new formal migrations both exist temporarily

These are controlled by doing infrastructure first, preserving repository contracts, and deleting the old repair path as soon as the formal migration path is proven.

## Non-Goals

This pass does not:

- change the app’s database engine away from SQLite
- move database access into the renderer
- redesign IPC payloads or service APIs
- re-model the domain schema for new product features
- replace every custom repository with direct ORM usage in the rest of the app

The goal is disciplined persistence evolution, not a broad architecture rewrite.

## Success Criteria

This design is successful when:

- schema changes are represented by versioned migration files, not startup hardcoding
- startup applies migrations through a single formal path
- current features continue to behave the same from the service and UI perspective
- repository code is consistently moving onto one storage abstraction
- adding a new table or column no longer requires hand-editing runtime schema repair code
