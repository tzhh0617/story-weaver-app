# DDD Domain Model Design

Date: 2026-05-01
Status: Implemented

## Goal

Apply Domain-Driven Design principles to refactor the monolithic `book-service.ts`
(1837 lines) into focused aggregates with clear boundaries. Use a pragmatic
approach: core DDD concepts (aggregates, entities, value objects, bounded
contexts) without heavy tactical patterns (event sourcing, CQRS).

## Bounded Contexts

### 1. Writing Context (Core Domain)

Manages the full book lifecycle from creation to completion.

Aggregates: Book, Outline, Chapter

### 2. Narrative Context (Supporting Domain)

Manages narrative consistency, character development, relationship networks,
and plot thread tracking. Contains Story Weaver's most unique domain knowledge.

Aggregates: NarrativeWorld, StoryPlan, Continuity

### 3. Operations Context (Generic Domain)

Manages scheduling, model configuration, settings, export, and logging.

Aggregates: Scheduler, ModelProvider, Export

### Context Map

```
Writing Context --uses--> Narrative Context
  (queries characters/threads/scenes during chapter writing)

Writing Context --uses--> Operations Context
  (acquires model, schedules execution)
```

## Aggregate Design

### Aggregate 1: Book (Root)

**Responsibility**: Book metadata, state transitions, progress tracking

**Invariants**:
- Status transitions follow:
  `creating -> building_world -> building_outline -> writing -> completed`
  with `paused` available at any point
- A book has exactly one Progress tracker

**Source tables**: `books`, `writing_progress`

**Module structure**:
```
core/aggregates/book/
  book-aggregate.ts      # create, start, pause, resume, delete, restart
  book-state.ts          # State machine + transition rules
  book.repository.ts     # Data access (existing books repo)
```

### Aggregate 2: Outline (Root)

**Responsibility**: Generate world-building, master outline, volume outlines,
chapter outlines from an IDEA

**Invariants**:
- World-building completes before outline generation
- Chapter outlines exist before chapter writing
- Each volume has at least 1 chapter plan

**Source tables**: `book_context`

**Source code**: `book-service.ts::startBook()` AI generation flow,
`ai-outline.ts`

**Module structure**:
```
core/aggregates/outline/
  outline-aggregate.ts   # generateWorld, generateOutline
  outline-builder.ts     # AI-driven outline construction (from ai-outline.ts)
  context.repository.ts  # book_context table access
```

### Aggregate 3: Chapter (Root)

**Responsibility**: Single chapter's full writing pipeline (draft -> audit ->
revision -> state extraction)

**Invariants**:
- Chapter plan must exist before writing
- Chapter content cannot be empty
- Audit failure triggers revision (max N retries)

**Source tables**: `chapters`

**Source code**: `book-service.ts::writeNextChapter()` (~400 lines, the most
complex method)

**Module structure**:
```
core/aggregates/chapter/
  chapter-aggregate.ts   # writeDraft, audit, revise, extractState
  chapter-writer.ts      # AI-driven chapter writing (existing chapterWriter)
  chapter-auditor.ts     # Quality auditing (existing chapterAuditor)
  chapter.repository.ts  # chapters table access
```

### Aggregate 4: NarrativeWorld (Root)

**Responsibility**: Story bible, character arcs, relationship networks, world
rules management and consistency

**Invariants**:
- Character arcs link to valid characters
- Relationships connect two valid characters
- World rules do not contradict each other

**Source tables**: `story_bibles`, `character_arcs`, `character_states`,
`relationship_edges`, `relationship_states`, `world_rules`

**Source code**: `narrative/` subdirectory + multiple repositories

**Module structure**:
```
core/aggregates/narrative-world/
  narrative-world-aggregate.ts  # Root
  story-bible.ts               # Story bible management
  character-arc.ts             # Character arcs
  relationship-network.ts      # Relationship networks
  world-rules.ts               # World rules
  narrative.repositories.ts    # Data access for all narrative entities
```

### Aggregate 5: StoryPlan (Root)

**Responsibility**: Volume plans, chapter cards, tension budgets

**Invariants**:
- Every planned chapter has a chapter card
- Tension budget values fall within valid ranges
- Volume plans cover all outline chapters

**Source tables**: `volume_plans`, `chapter_cards`,
`chapter_tension_budgets`, `chapter_thread_actions`,
`chapter_character_pressures`, `chapter_relationship_actions`

**Source code**: Batch-save logic after outline generation in `book-service.ts`

**Module structure**:
```
core/aggregates/story-plan/
  story-plan-aggregate.ts   # planVolumes, planChapters, assignTension
  story-plan.repositories.ts
```

### Aggregate 6: Continuity (Root)

**Responsibility**: Post-chapter state extraction and tracking (plot threads,
scene records, character states, relationship states)

**Invariants**:
- Plot thread status only transitions active -> resolved
- Character state snapshots correspond to specific chapters
- Scene records do not span multiple chapters

**Source tables**: `narrative_threads`, `scene_records`, `character_states`,
`relationship_states`, `narrative_checkpoints`

**Source code**: `consistency.ts`, post-chapter extractors

**Module structure**:
```
core/aggregates/continuity/
  continuity-aggregate.ts    # updateFromChapter, extractContinuity, trackThread
  continuity.repositories.ts
```

## Application Service (Orchestrator)

The existing `BookService` becomes a thin `BookOrchestrator` that coordinates
aggregates without containing business logic:

```typescript
class BookOrchestrator {
  async startBook(bookId: string): Promise<void> {
    await bookAggregate.transition(bookId, 'building_world')
    const world = await outlineAggregate.generateWorld(bookId)
    await narrativeWorld.loadFromWorld(bookId, world)
    const outline = await outlineAggregate.generateOutline(bookId)
    await storyPlan.createFromOutline(bookId, outline)
    await bookAggregate.transition(bookId, 'writing')
  }

  async writeNextChapter(bookId: string): Promise<void> {
    const plan = await storyPlan.getNextChapter(bookId)
    const context = await continuity.buildContext(bookId, plan)
    const chapter = await chapterAggregate.write(bookId, plan, context)
    await continuity.updateFromChapter(bookId, chapter)
  }
}
```

## Directory Structure

After refactoring, `packages/backend/src/core/`:

```
core/
  aggregates/
    book/
      book-aggregate.ts
      book-state.ts
      book.repository.ts
    outline/
      outline-aggregate.ts
      outline-builder.ts
      context.repository.ts
    chapter/
      chapter-aggregate.ts
      chapter-writer.ts
      chapter-auditor.ts
      chapter.repository.ts
    narrative-world/
      narrative-world-aggregate.ts
      story-bible.ts
      character-arc.ts
      relationship-network.ts
      world-rules.ts
      narrative.repositories.ts
    story-plan/
      story-plan-aggregate.ts
      story-plan.repositories.ts
    continuity/
      continuity-aggregate.ts
      continuity.repositories.ts
  orchestrator.ts                 # Replaces book-service.ts
  scheduler.ts                    # Kept as-is (operations context)
```

## Migration Strategy

Incremental extraction from `book-service.ts`. Each step is independently
deployable:

1. **Extract Book aggregate** — Move state machine + lifecycle methods.
   Highest confidence, lowest risk. The state machine (`engine.ts`) and status
   transitions are self-contained.
2. **Extract Outline aggregate** — Move world-building and outline generation.
   Depends on AI service abstractions remaining stable.
3. **Extract Chapter aggregate** — Move writing pipeline.
   The most complex extraction; the 400-line `writeNextChapter()` needs careful
   decomposition into writeDraft/audit/revise/extractState.
4. **Extract NarrativeWorld + StoryPlan** — Move narrative entities.
   These are primarily data management; extraction is straightforward.
5. **Extract Continuity aggregate** — Move post-chapter state tracking.
   Depends on Chapter aggregate being stable.
6. **Create Orchestrator** — Wire aggregates together.
   The final step replaces `book-service.ts` with the thin coordinator.

Each step includes:
- Move code to new aggregate module
- Update imports in `book-service.ts` to delegate to aggregate
- Run existing tests to verify no regression
- Add aggregate-specific unit tests

## What Stays Unchanged

- `packages/frontend/` — No changes; API contract unchanged
- `packages/shared/` — No changes; types remain the same
- `electron/` — No changes
- `packages/backend/src/routes/` — Routes delegate to orchestrator instead of
  book-service; same API shape
- `packages/backend/src/storage/` — Repository implementations stay; aggregates
  consume them via injection
- `packages/backend/src/core/narrative/` — Types, prompts, and audit logic are
  consumed by aggregates; not relocated in this refactor
