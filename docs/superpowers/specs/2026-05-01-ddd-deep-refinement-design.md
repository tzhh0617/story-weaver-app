# DDD Deep Refinement Design

Date: 2026-05-01
Status: Implemented (Phase 1 complete; this spec covers Phase 2)

## Goal

Further decompose the remaining complexity hotspots identified after the initial
aggregate extraction: the Chapter aggregate's 560-line `writeNext` god method,
the narrative subsystem's unclear sub-domain boundaries, and the 658-line
runtime services factory.

## Context

Phase 1 (completed) extracted 6 aggregates + 1 orchestrator from book-service.ts.
The remaining hotspots are:

1. **Chapter aggregate `writeNext`** — 1,111 lines total, 560-line god method
2. **Narrative subsystem** — 2,048 lines across 11 files, rich domain with
   no explicit sub-domain grouping
3. **Runtime services factory** — 658 lines, mixes logging/execution/wiring

## Step 1: Decompose `writeNext` into Sub-Process Functions

### Current State

`writeNext()` in `chapter-aggregate.ts` (lines 545-1106) is a 560-line method
that handles 9 distinct phases sequentially.

### Target State

Extract each phase into a named function within the same module. The public
API (`writeNext`) becomes a ~50-line coordinator that calls sub-functions.

**Sub-functions:**

```
findNextChapter(bookId) → { book, chapter, card, outline, title }
buildWriteContext(book, chapter, card, outline) → { prompt, modelId, ... }
writeDraft(bookId, prompt, modelId) → { content, usage }
auditAndRevise(bookId, content, card, prompt, modelId) → { content, audit }
extractAndSaveContinuity(bookId, chapter, content) → ChapterUpdate
extractNarrativeState(bookId, content) → void
runCheckpoint(bookId, chapterIndex) → void
```

**Rules:**
- Sub-functions are module-level (not exported), called only by `writeNext`
- Each sub-function receives only the data it needs (not the full deps)
- The deps object stays on the module level; sub-functions close over it
- No new files created — all functions stay in `chapter-aggregate.ts`
- Tests for `writeNext` continue to pass unchanged (public API preserved)

### Invariants

- `writeNext` remains the only exported method
- All sub-functions are private to the module
- Streaming events and pause/delete checks remain in `writeNext` proper
- The function signature and return type of `writeNext` do not change

## Step 2: Narrative Sub-Domain Barrel Exports

### Current State

`packages/backend/src/core/narrative/` has 11 files with no internal grouping.
Consumers import from scattered paths.

### Target State

Add barrel `index.ts` files that group related modules into 4 sub-domains:

```
narrative/
  story-bible/
    index.ts    — re-exports: types (bible types), validation (bible fns),
                  viral-story-protocol
  chapter-planning/
    index.ts    — re-exports: types (plan types), validation (plan fns),
                  prompts (planning prompt builders)
  writing/
    index.ts    — re-exports: prompts (draft prompts), context, text-policy,
                  json
  quality/
    index.ts    — re-exports: audit, checkpoint, state, opening-retention
  types.ts      — stays at root (shared by all sub-domains)
```

**Rules:**
- No files are moved — only barrel index.ts files are added
- Existing imports continue to work (backward compatible)
- The barrel exports are opt-in; consumers can still import from specific files
- No behavior changes — purely structural

### Sub-domain Assignment

**Story Bible:** Character arcs, relationships, world rules, narrative threads,
viral story protocol, bible validation functions.

**Chapter Planning:** Volume plans, chapter cards, tension budgets, planning
validation functions, planning prompt builders.

**Writing:** Draft prompt builders, narrative command context, text generation
policies, JSON parsing utilities.

**Quality:** Audit decision logic, tension checkpoint analysis, state
normalization, opening retention protocol, audit prompt builders.

## Step 3: Extract Runtime Services Sub-Modules

### Current State

`create-runtime-services.ts` (658 lines) contains logging infrastructure,
book execution logic, error handling, and the public API facade all in one
function.

### Target State

Extract two focused modules:

```
runtime/
  create-logging-service.ts   — ~120 lines
  create-book-runner.ts       — ~80 lines
  create-runtime-services.ts  — ~460 lines (wiring + public API)
```

**`create-logging-service.ts`:**
- `createExecutionLogStream()` setup
- `getBookSnapshot()`
- `logExecution()`
- `classifyProgressEvent()`
- `logGenerationEvent()`
- Returns: `{ subscribeExecutionLogs, ... }`

**`create-book-runner.ts`:**
- `markBookErrored()`
- `runBook()`
- `continueBook()`
- `registerBackgroundRunner()`
- Returns: `{ runBook, continueBook, ... }`

**Rules:**
- `create-runtime-services.ts` imports and uses the sub-modules
- Public API (`RuntimeServices`) does not change
- Tests continue to pass unchanged

## Migration Strategy

Three independent steps, each deployable alone:

1. **Step 1** (chapter decomposition) — highest impact, lowest risk
2. **Step 2** (narrative barrels) — zero risk, purely additive
3. **Step 3** (runtime extraction) — medium impact, low risk

Each step: implement → run tests → commit.

## What Stays Unchanged

- All aggregate modules (`aggregates/`)
- The orchestrator (`orchestrator.ts`)
- Routes (`routes/`)
- Storage (`storage/`)
- Frontend, shared, electron packages
- Public API of `writeNext`, `createRuntimeServices`, and all narrative modules
