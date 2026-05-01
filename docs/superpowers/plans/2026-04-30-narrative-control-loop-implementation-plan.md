# Narrative Control Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the loose outline-driven generation flow with a structured narrative control loop: story bible, character arcs, relationship edges, world rules, narrative threads, chapter cards, draft audit, revision, state extraction, and checkpoint replanning.

**Architecture:** Add a focused narrative domain under `src/core/narrative`, replace the development database schema with structured narrative tables, then adapt `book-service` so generation flows through bible planning, chapter cards, audit, revision, and state extraction. Keep renderer compatibility by mapping the new structured records back into the existing `BookDetail` shape until the UI gets its own narrative views.

**Tech Stack:** TypeScript, Vitest, better-sqlite3, existing Vercel AI SDK provider wrappers, Electron IPC contracts, existing mock story services.

---

## Scope Note

This plan implements the backend generation redesign from [2026-04-30-narrative-control-loop-design.md](/Users/admin/Works/story-weaver-app/docs/superpowers/specs/2026-04-30-narrative-control-loop-design.md). It deliberately keeps the renderer mostly compatible and defers graph-style visualizations. The database can be changed directly because the current development data does not need migration preservation.

## File Structure

- Create `src/core/narrative/types.ts`: shared narrative domain types and literal unions.
- Create `src/core/narrative/validation.ts`: deterministic validation and normalization for bible, volume plans, chapter cards, audits, and state deltas.
- Create `src/core/narrative/json.ts`: code-fence stripping, JSON parsing, and repair-prompt helpers.
- Create `src/core/narrative/prompts.ts`: story bible, volume plan, chapter card, draft, audit, revision, checkpoint, and replanning prompts.
- Create `src/core/narrative/context.ts`: write-before narrative command context builder with budgeted trimming.
- Create `src/core/narrative/audit.ts`: audit decision scoring and accept/revise/rewrite logic.
- Create `src/core/narrative/state.ts`: post-chapter state delta normalization.
- Create `src/core/narrative/checkpoint.ts`: checkpoint threshold helpers and future-card replanning selection.
- Modify `src/core/types.ts`: expose the new structured outline bundle shape while keeping old callers compiling during transition.
- Modify `src/core/prompt-builder.ts`: keep legacy exports, delegate new narrative prompts to `src/core/narrative/prompts.ts`.
- Modify `src/core/ai-outline.ts`: generate and validate story bible, volume plans, and chapter cards.
- Modify `src/core/ai-post-chapter.ts`: add narrative audit and state extraction services.
- Modify `src/core/book-service.ts`: orchestrate bible planning, chapter-card writing, audit, revision, extraction, and checkpoint review.
- Modify `src/core/consistency.ts`: preserve current API but delegate new chapter context to narrative context builder.
- Modify `src/mock/story-services.ts`: produce deterministic Chinese story bible, chapter cards, audits, and state deltas.
- Modify `src/storage/migrations.ts`: replace old story tables with the new narrative schema.
- Create `src/storage/story-bibles.ts`
- Create `src/storage/character-arcs.ts`
- Create `src/storage/relationship-edges.ts`
- Create `src/storage/world-rules.ts`
- Create `src/storage/narrative-threads.ts`
- Create `src/storage/volume-plans.ts`
- Create `src/storage/chapter-cards.ts`
- Create `src/storage/chapter-audits.ts`
- Create `src/storage/relationship-states.ts`
- Create `src/storage/narrative-checkpoints.ts`
- Modify `src/storage/chapters.ts`: remove outline ownership and store final content plus audit metadata.
- Modify `src/storage/database.ts`: instantiate and export the new repositories.
- Modify `src/shared/contracts.ts`: extend book detail payload with optional narrative records while retaining existing fields.
- Modify `renderer/pages/BookDetail.tsx`: render compatible existing tabs from mapped data, and optionally show audit score in chapter metadata.
- Add tests under `tests/core` and `tests/storage` as listed per task.

## Task 1: Narrative Types and Validation

**Files:**
- Create: `src/core/narrative/types.ts`
- Create: `src/core/narrative/validation.ts`
- Test: `tests/core/narrative-validation.test.ts`

- [ ] **Step 1: Write failing validation tests**

Add `tests/core/narrative-validation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  validateChapterCards,
  validateNarrativeBible,
  validateVolumePlans,
} from '../../src/core/narrative/validation';
import type {
  ChapterCard,
  NarrativeBible,
  VolumePlan,
} from '../../src/core/narrative/types';

function validBible(): NarrativeBible {
  return {
    premise: '被剥夺记忆的档案修复师追查天命账簿。',
    genreContract: '东方幻想长篇，升级、悬疑、权谋并重。',
    targetReaderExperience: '持续获得真相推进、关系反转和规则代价。',
    themeQuestion: '人能否摆脱被记录好的命运？',
    themeAnswerDirection: '自由不是删除命运，而是承担改写命运的代价。',
    centralDramaticQuestion: '主角能否改写天命账簿而不成为新的审判者？',
    endingState: {
      protagonistWins: '夺回选择权。',
      protagonistLoses: '失去被世界遗忘的安全。',
      worldChange: '命运记录权从宗门垄断变成公开审议。',
      relationshipOutcome: '师徒信任重建但再无从属。',
      themeAnswer: '自由需要公开承受代价。',
    },
    voiceGuide: '中文网文节奏，冲突清楚，悬念持续。',
    characterArcs: [
      {
        id: 'lin-mu',
        name: '林牧',
        roleType: 'protagonist',
        desire: '查清家族被抹除的真相。',
        fear: '再次被所有人遗忘。',
        flaw: '遇到失控时会独自承担。',
        misbelief: '只要掌握记录权就能保护所有人。',
        wound: '幼年亲历族谱空白。',
        externalGoal: '找到天命账簿原本。',
        internalNeed: '学会与他人共享风险。',
        arcDirection: 'growth',
        decisionLogic: '优先保护弱者，但会隐瞒危险。',
        lineWillNotCross: '不主动抹除无辜者记忆。',
        lineMayEventuallyCross: '公开自己的禁忌身份。',
        currentArcPhase: 'denial',
      },
    ],
    relationshipEdges: [],
    worldRules: [
      {
        id: 'record-cost',
        category: 'power',
        ruleText: '改写命簿会交换等量记忆。',
        cost: '失去一段真实经历。',
        whoBenefits: '掌簿宗门',
        whoSuffers: '无名散修',
        taboo: '不可改写死人命格',
        violationConsequence: '改写者被命簿反噬',
        allowedException: '以自愿记忆为祭',
        currentStatus: 'active',
      },
    ],
    narrativeThreads: [
      {
        id: 'main-ledger-truth',
        type: 'main',
        promise: '天命账簿为何抹除林家。',
        plantedAt: 1,
        expectedPayoff: 20,
        resolvedAt: null,
        currentState: 'open',
        importance: 'critical',
        payoffMustChange: 'world',
        ownerCharacterId: 'lin-mu',
        relatedRelationshipId: null,
        notes: null,
      },
    ],
  };
}

describe('validateNarrativeBible', () => {
  it('accepts a bible with a protagonist, costly world rule, and critical thread', () => {
    const result = validateNarrativeBible(validBible(), { targetChapters: 30 });

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('rejects a protagonist without desire and a world rule without cost', () => {
    const bible = validBible();
    bible.characterArcs[0] = { ...bible.characterArcs[0], desire: '' };
    bible.worldRules[0] = { ...bible.worldRules[0], cost: '' };

    const result = validateNarrativeBible(bible, { targetChapters: 30 });

    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Character lin-mu must include desire.');
    expect(result.issues).toContain('World rule record-cost must include cost.');
  });
});

describe('validateVolumePlans', () => {
  it('requires continuous chapter coverage', () => {
    const volumes: VolumePlan[] = [
      {
        volumeIndex: 1,
        title: '命簿初鸣',
        chapterStart: 1,
        chapterEnd: 5,
        roleInStory: '建立追查目标。',
        mainPressure: '宗门追捕。',
        promisedPayoff: '发现账簿碎页。',
        characterArcMovement: '林牧开始信任同伴。',
        relationshipMovement: '师徒裂痕出现。',
        worldExpansion: '展示命簿代价。',
        endingTurn: '碎页指向师父。',
      },
      {
        volumeIndex: 2,
        title: '旧案反噬',
        chapterStart: 7,
        chapterEnd: 10,
        roleInStory: '扩大真相。',
        mainPressure: '各方夺页。',
        promisedPayoff: '确认林家并非叛徒。',
        characterArcMovement: '林牧承认自己也想掌控别人。',
        relationshipMovement: '同伴发现他隐瞒代价。',
        worldExpansion: '命簿影响凡人日常。',
        endingTurn: '旧盟友背叛。',
      },
    ];

    const result = validateVolumePlans(volumes, { targetChapters: 10 });

    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Volume 2 must start at chapter 6.');
  });
});

describe('validateChapterCards', () => {
  it('rejects cards without mustChange and without conflict', () => {
    const cards: ChapterCard[] = [
      {
        bookId: 'book-1',
        volumeIndex: 1,
        chapterIndex: 1,
        title: '旧页',
        plotFunction: '开局。',
        povCharacterId: 'lin-mu',
        externalConflict: '',
        internalConflict: '林牧想保密却需要求助。',
        relationshipChange: '林牧欠下同伴人情。',
        worldRuleUsedOrTested: 'record-cost',
        informationReveal: '命簿会吞记忆。',
        readerReward: 'truth',
        endingHook: '碎页浮现林家姓名。',
        mustChange: '',
        forbiddenMoves: [],
      },
    ];

    const result = validateChapterCards(cards, { targetChapters: 1 });

    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Chapter 1 must include externalConflict.');
    expect(result.issues).toContain('Chapter 1 must include mustChange.');
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
pnpm exec vitest run tests/core/narrative-validation.test.ts --reporter=dot
```

Expected: FAIL because `src/core/narrative/validation.ts` does not exist.

- [ ] **Step 3: Add narrative types**

Create `src/core/narrative/types.ts`:

```ts
export type CharacterRoleType =
  | 'protagonist'
  | 'deuteragonist'
  | 'supporting'
  | 'antagonist'
  | 'minor';

export type ArcDirection =
  | 'growth'
  | 'fall'
  | 'corruption'
  | 'recovery'
  | 'flat';

export type WorldRuleCategory =
  | 'power'
  | 'society'
  | 'resource'
  | 'taboo'
  | 'law'
  | 'daily_life'
  | 'history';

export type NarrativeThreadType =
  | 'main'
  | 'subplot'
  | 'relationship'
  | 'mystery'
  | 'theme'
  | 'antagonist'
  | 'world';

export type NarrativeThreadState =
  | 'open'
  | 'advanced'
  | 'twisted'
  | 'paid_off'
  | 'abandoned';

export type ThreadImportance = 'critical' | 'normal' | 'minor';
export type PayoffChangeTarget =
  | 'plot'
  | 'relationship'
  | 'world'
  | 'character'
  | 'theme';

export type ReaderReward =
  | 'reversal'
  | 'breakthrough'
  | 'failure'
  | 'truth'
  | 'upgrade'
  | 'confession'
  | 'dread'
  | 'relief';

export type ThreadAction = 'plant' | 'advance' | 'misdirect' | 'payoff';
export type RelationshipAction =
  | 'strain'
  | 'repair'
  | 'betray'
  | 'reveal'
  | 'deepen'
  | 'reverse';

export type AuditIssueType =
  | 'character_logic'
  | 'relationship_static'
  | 'world_rule_violation'
  | 'mainline_stall'
  | 'thread_leak'
  | 'pacing_problem'
  | 'theme_drift'
  | 'chapter_too_empty'
  | 'forbidden_move'
  | 'missing_reader_reward';

export type AuditSeverity = 'blocker' | 'major' | 'minor';
export type AuditDecision = 'accept' | 'revise' | 'rewrite';

export type CharacterArc = {
  id: string;
  name: string;
  roleType: CharacterRoleType;
  desire: string;
  fear: string;
  flaw: string;
  misbelief: string;
  wound: string | null;
  externalGoal: string;
  internalNeed: string;
  arcDirection: ArcDirection;
  decisionLogic: string;
  lineWillNotCross: string | null;
  lineMayEventuallyCross: string | null;
  currentArcPhase: string;
};

export type RelationshipEdge = {
  id: string;
  fromCharacterId: string;
  toCharacterId: string;
  visibleLabel: string;
  hiddenTruth: string | null;
  dependency: string | null;
  debt: string | null;
  misunderstanding: string | null;
  affection: string | null;
  harmPattern: string | null;
  sharedGoal: string | null;
  valueConflict: string | null;
  trustLevel: number;
  tensionLevel: number;
  currentState: string;
  plannedTurns: Array<{ chapterRange: string; change: string }>;
};

export type WorldRule = {
  id: string;
  category: WorldRuleCategory;
  ruleText: string;
  cost: string;
  whoBenefits: string | null;
  whoSuffers: string | null;
  taboo: string | null;
  violationConsequence: string | null;
  allowedException: string | null;
  currentStatus: string;
};

export type NarrativeThread = {
  id: string;
  type: NarrativeThreadType;
  promise: string;
  plantedAt: number;
  expectedPayoff: number | null;
  resolvedAt: number | null;
  currentState: NarrativeThreadState;
  importance: ThreadImportance;
  payoffMustChange: PayoffChangeTarget;
  ownerCharacterId: string | null;
  relatedRelationshipId: string | null;
  notes: string | null;
};

export type NarrativeBible = {
  premise: string;
  genreContract: string;
  targetReaderExperience: string;
  themeQuestion: string;
  themeAnswerDirection: string;
  centralDramaticQuestion: string;
  endingState: {
    protagonistWins: string;
    protagonistLoses: string;
    worldChange: string;
    relationshipOutcome: string;
    themeAnswer: string;
  };
  voiceGuide: string;
  characterArcs: CharacterArc[];
  relationshipEdges: RelationshipEdge[];
  worldRules: WorldRule[];
  narrativeThreads: NarrativeThread[];
};

export type VolumePlan = {
  volumeIndex: number;
  title: string;
  chapterStart: number;
  chapterEnd: number;
  roleInStory: string;
  mainPressure: string;
  promisedPayoff: string;
  characterArcMovement: string;
  relationshipMovement: string;
  worldExpansion: string;
  endingTurn: string;
};

export type ChapterCard = {
  bookId: string;
  volumeIndex: number;
  chapterIndex: number;
  title: string;
  plotFunction: string;
  povCharacterId: string | null;
  externalConflict: string;
  internalConflict: string;
  relationshipChange: string;
  worldRuleUsedOrTested: string;
  informationReveal: string;
  readerReward: ReaderReward;
  endingHook: string;
  mustChange: string;
  forbiddenMoves: string[];
};

export type ChapterThreadAction = {
  bookId: string;
  volumeIndex: number;
  chapterIndex: number;
  threadId: string;
  action: ThreadAction;
  requiredEffect: string;
};

export type ChapterCharacterPressure = {
  bookId: string;
  volumeIndex: number;
  chapterIndex: number;
  characterId: string;
  desirePressure: string;
  fearPressure: string;
  flawTrigger: string;
  expectedChoice: string;
};

export type ChapterRelationshipAction = {
  bookId: string;
  volumeIndex: number;
  chapterIndex: number;
  relationshipId: string;
  action: RelationshipAction;
  requiredChange: string;
};

export type NarrativeAudit = {
  passed: boolean;
  score: number;
  decision: AuditDecision;
  issues: Array<{
    type: AuditIssueType;
    severity: AuditSeverity;
    evidence: string;
    fixInstruction: string;
  }>;
  scoring: {
    characterLogic: number;
    mainlineProgress: number;
    relationshipChange: number;
    conflictDepth: number;
    worldRuleCost: number;
    threadManagement: number;
    pacingReward: number;
    themeAlignment: number;
  };
  stateUpdates: {
    characterArcUpdates: string[];
    relationshipUpdates: string[];
    threadUpdates: string[];
    worldKnowledgeUpdates: string[];
    themeUpdate: string;
  };
};

export type ValidationResult = {
  valid: boolean;
  issues: string[];
};
```

- [ ] **Step 4: Add validation implementation**

Create `src/core/narrative/validation.ts`:

```ts
import type {
  ChapterCard,
  NarrativeBible,
  ValidationResult,
  VolumePlan,
} from './types.js';

function isBlank(value: string | null | undefined) {
  return !value || value.trim().length === 0;
}

function result(issues: string[]): ValidationResult {
  return {
    valid: issues.length === 0,
    issues,
  };
}

export function validateNarrativeBible(
  bible: NarrativeBible,
  input: { targetChapters: number }
): ValidationResult {
  const issues: string[] = [];
  const characterIds = new Set(bible.characterArcs.map((character) => character.id));
  const relationshipIds = new Set(bible.relationshipEdges.map((relationship) => relationship.id));

  if (!bible.characterArcs.some((character) => character.roleType === 'protagonist')) {
    issues.push('Narrative bible must include a protagonist.');
  }

  if (isBlank(bible.themeQuestion)) {
    issues.push('Narrative bible must include themeQuestion.');
  }

  if (isBlank(bible.themeAnswerDirection)) {
    issues.push('Narrative bible must include themeAnswerDirection.');
  }

  for (const character of bible.characterArcs) {
    if (isBlank(character.desire)) issues.push(`Character ${character.id} must include desire.`);
    if (isBlank(character.fear)) issues.push(`Character ${character.id} must include fear.`);
    if (isBlank(character.flaw)) issues.push(`Character ${character.id} must include flaw.`);
    if (isBlank(character.decisionLogic)) {
      issues.push(`Character ${character.id} must include decisionLogic.`);
    }
  }

  for (const relationship of bible.relationshipEdges) {
    if (!characterIds.has(relationship.fromCharacterId)) {
      issues.push(`Relationship ${relationship.id} references missing fromCharacterId ${relationship.fromCharacterId}.`);
    }
    if (!characterIds.has(relationship.toCharacterId)) {
      issues.push(`Relationship ${relationship.id} references missing toCharacterId ${relationship.toCharacterId}.`);
    }
  }

  for (const rule of bible.worldRules) {
    if (isBlank(rule.cost)) issues.push(`World rule ${rule.id} must include cost.`);
  }

  if (!bible.narrativeThreads.some((thread) => thread.type === 'main')) {
    issues.push('Narrative bible must include a main thread.');
  }

  for (const thread of bible.narrativeThreads) {
    if (thread.expectedPayoff !== null && thread.expectedPayoff > input.targetChapters) {
      issues.push(`Thread ${thread.id} expectedPayoff exceeds target chapters.`);
    }
    if (thread.ownerCharacterId && !characterIds.has(thread.ownerCharacterId)) {
      issues.push(`Thread ${thread.id} references missing ownerCharacterId ${thread.ownerCharacterId}.`);
    }
    if (thread.relatedRelationshipId && !relationshipIds.has(thread.relatedRelationshipId)) {
      issues.push(`Thread ${thread.id} references missing relatedRelationshipId ${thread.relatedRelationshipId}.`);
    }
  }

  return result(issues);
}

export function validateVolumePlans(
  volumePlans: VolumePlan[],
  input: { targetChapters: number }
): ValidationResult {
  const issues: string[] = [];
  let expectedStart = 1;

  for (const volume of [...volumePlans].sort((left, right) => left.volumeIndex - right.volumeIndex)) {
    if (volume.chapterStart !== expectedStart) {
      issues.push(`Volume ${volume.volumeIndex} must start at chapter ${expectedStart}.`);
    }
    if (volume.chapterEnd < volume.chapterStart) {
      issues.push(`Volume ${volume.volumeIndex} chapterEnd must be greater than or equal to chapterStart.`);
    }
    if (isBlank(volume.promisedPayoff)) {
      issues.push(`Volume ${volume.volumeIndex} must include promisedPayoff.`);
    }
    if (isBlank(volume.endingTurn)) {
      issues.push(`Volume ${volume.volumeIndex} must include endingTurn.`);
    }
    expectedStart = volume.chapterEnd + 1;
  }

  if (expectedStart !== input.targetChapters + 1) {
    issues.push(`Volume plans must end at chapter ${input.targetChapters}.`);
  }

  return result(issues);
}

export function validateChapterCards(
  cards: ChapterCard[],
  input: { targetChapters: number }
): ValidationResult {
  const issues: string[] = [];
  const sorted = [...cards].sort((left, right) => left.chapterIndex - right.chapterIndex);

  for (let index = 0; index < input.targetChapters; index += 1) {
    const expectedChapter = index + 1;
    const card = sorted[index];
    if (!card || card.chapterIndex !== expectedChapter) {
      issues.push(`Chapter card ${expectedChapter} must exist.`);
      continue;
    }
    if (isBlank(card.externalConflict)) issues.push(`Chapter ${expectedChapter} must include externalConflict.`);
    if (isBlank(card.internalConflict)) issues.push(`Chapter ${expectedChapter} must include internalConflict.`);
    if (isBlank(card.relationshipChange)) issues.push(`Chapter ${expectedChapter} must include relationshipChange.`);
    if (isBlank(card.mustChange)) issues.push(`Chapter ${expectedChapter} must include mustChange.`);
    if (isBlank(card.endingHook)) issues.push(`Chapter ${expectedChapter} must include endingHook.`);
  }

  return result(issues);
}
```

- [ ] **Step 5: Run validation tests**

Run:

```bash
pnpm exec vitest run tests/core/narrative-validation.test.ts --reporter=dot
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/narrative/types.ts src/core/narrative/validation.ts tests/core/narrative-validation.test.ts
git commit -m "feat: add narrative domain validation"
```

## Task 2: Replace Development Schema with Narrative Tables

**Files:**
- Modify: `src/storage/migrations.ts`
- Test: `tests/storage/database.test.ts`
- Test: `tests/storage/narrative-schema.test.ts`

- [ ] **Step 1: Add failing schema test**

Create `tests/storage/narrative-schema.test.ts`:

```ts
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { runMigrations } from '../../src/storage/database';

let tempDir: string | null = null;

function createDb() {
  tempDir = mkdtempSync(join(tmpdir(), 'story-weaver-schema-'));
  const db = new Database(join(tempDir, 'test.sqlite'));
  runMigrations(db);
  return db;
}

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = null;
});

describe('narrative schema', () => {
  it('creates structured narrative planning and audit tables', () => {
    const db = createDb();
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tables).toEqual(
      expect.arrayContaining([
        'story_bibles',
        'character_arcs',
        'relationship_edges',
        'world_rules',
        'narrative_threads',
        'volume_plans',
        'chapter_cards',
        'chapter_thread_actions',
        'chapter_character_pressures',
        'chapter_relationship_actions',
        'chapter_generation_audits',
        'relationship_states',
        'narrative_checkpoints',
      ])
    );
  });

  it('stores audit metadata on chapters', () => {
    const db = createDb();
    const columns = db
      .prepare('PRAGMA table_info(chapters)')
      .all()
      .map((row) => (row as { name: string }).name);

    expect(columns).toEqual(expect.arrayContaining(['audit_score', 'draft_attempts', 'updated_at']));
    expect(columns).not.toContain('outline');
  });
});
```

- [ ] **Step 2: Run the failing schema test**

Run:

```bash
pnpm exec vitest run tests/storage/narrative-schema.test.ts --reporter=dot
```

Expected: FAIL because the narrative tables do not exist and `chapters.outline` still exists.

- [ ] **Step 3: Replace migration SQL**

Modify `src/storage/migrations.ts` by replacing the migration string with the schema from the spec. Include all tables from Task 2 test and keep existing operational tables: `books`, `writing_progress`, `api_logs`, `model_configs`, `settings`, and `execution_logs` if present in the current file after rebasing.

Use these exact chapter and action table definitions for compatibility with later tasks:

```sql
CREATE TABLE IF NOT EXISTS chapters (
  book_id TEXT NOT NULL,
  volume_index INTEGER NOT NULL,
  chapter_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  summary TEXT,
  word_count INTEGER NOT NULL DEFAULT 0,
  audit_score INTEGER,
  draft_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT,
  updated_at TEXT,
  PRIMARY KEY (book_id, volume_index, chapter_index),
  FOREIGN KEY (book_id) REFERENCES books(id)
);

CREATE TABLE IF NOT EXISTS chapter_cards (
  book_id TEXT NOT NULL,
  volume_index INTEGER NOT NULL,
  chapter_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  plot_function TEXT NOT NULL,
  pov_character_id TEXT,
  external_conflict TEXT NOT NULL,
  internal_conflict TEXT NOT NULL,
  relationship_change TEXT NOT NULL,
  world_rule_used_or_tested TEXT NOT NULL,
  information_reveal TEXT NOT NULL,
  reader_reward TEXT NOT NULL,
  ending_hook TEXT NOT NULL,
  must_change TEXT NOT NULL,
  forbidden_moves_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'planned',
  revision INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (book_id, volume_index, chapter_index),
  FOREIGN KEY (book_id) REFERENCES books(id),
  FOREIGN KEY (pov_character_id) REFERENCES character_arcs(id)
);
```

- [ ] **Step 4: Update existing database expectations**

Run:

```bash
pnpm exec vitest run tests/storage/database.test.ts --reporter=dot
```

If an existing assertion expects old tables such as `book_context`, `characters`, or `plot_threads`, update it to expect `story_bibles`, `character_arcs`, and `narrative_threads`. Keep assertions for `books`, `chapters`, `writing_progress`, `model_configs`, and `settings`.

- [ ] **Step 5: Run storage schema tests**

Run:

```bash
pnpm exec vitest run tests/storage/database.test.ts tests/storage/narrative-schema.test.ts --reporter=dot
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/storage/migrations.ts tests/storage/database.test.ts tests/storage/narrative-schema.test.ts
git commit -m "feat: replace story schema with narrative tables"
```

## Task 3: Narrative Repositories

**Files:**
- Create: `src/storage/story-bibles.ts`
- Create: `src/storage/character-arcs.ts`
- Create: `src/storage/relationship-edges.ts`
- Create: `src/storage/world-rules.ts`
- Create: `src/storage/narrative-threads.ts`
- Create: `src/storage/volume-plans.ts`
- Create: `src/storage/chapter-cards.ts`
- Create: `src/storage/chapter-audits.ts`
- Create: `src/storage/relationship-states.ts`
- Create: `src/storage/narrative-checkpoints.ts`
- Modify: `src/storage/database.ts`
- Test: `tests/storage/narrative-repositories.test.ts`

- [ ] **Step 1: Write failing repository tests**

Create `tests/storage/narrative-repositories.test.ts` with a test database helper matching existing storage tests. Add this minimum coverage:

```ts
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { createRepositories, runMigrations } from '../../src/storage/database';
import type {
  ChapterCard,
  NarrativeAudit,
  NarrativeBible,
  VolumePlan,
} from '../../src/core/narrative/types';

let tempDir: string | null = null;

function openRepositories() {
  tempDir = mkdtempSync(join(tmpdir(), 'story-weaver-narrative-repos-'));
  const db = new Database(join(tempDir, 'test.sqlite'));
  runMigrations(db);
  return createRepositories(db);
}

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = null;
});

function bible(): NarrativeBible {
  return {
    premise: '命簿修复师追查旧案。',
    genreContract: '东方幻想。',
    targetReaderExperience: '真相、反转、代价。',
    themeQuestion: '能否摆脱命运？',
    themeAnswerDirection: '自由来自承担代价。',
    centralDramaticQuestion: '能否改写命簿？',
    endingState: {
      protagonistWins: '夺回选择。',
      protagonistLoses: '失去匿名安全。',
      worldChange: '命簿公开。',
      relationshipOutcome: '师徒重建边界。',
      themeAnswer: '自由需要责任。',
    },
    voiceGuide: '中文网文。',
    characterArcs: [
      {
        id: 'lin-mu',
        name: '林牧',
        roleType: 'protagonist',
        desire: '查清真相。',
        fear: '被遗忘。',
        flaw: '独自承担。',
        misbelief: '掌控记录才能保护别人。',
        wound: '家族被抹除。',
        externalGoal: '寻找命簿。',
        internalNeed: '学会共享风险。',
        arcDirection: 'growth',
        decisionLogic: '保护弱者但隐瞒危险。',
        lineWillNotCross: '不抹除无辜者。',
        lineMayEventuallyCross: '公开身份。',
        currentArcPhase: 'denial',
      },
    ],
    relationshipEdges: [],
    worldRules: [
      {
        id: 'record-cost',
        category: 'power',
        ruleText: '改写命簿会交换记忆。',
        cost: '失去经历。',
        whoBenefits: '掌簿宗门',
        whoSuffers: '散修',
        taboo: '不可改死人命格',
        violationConsequence: '反噬',
        allowedException: '自愿献祭',
        currentStatus: 'active',
      },
    ],
    narrativeThreads: [
      {
        id: 'main-ledger-truth',
        type: 'main',
        promise: '查清林家旧案。',
        plantedAt: 1,
        expectedPayoff: 20,
        resolvedAt: null,
        currentState: 'open',
        importance: 'critical',
        payoffMustChange: 'world',
        ownerCharacterId: 'lin-mu',
        relatedRelationshipId: null,
        notes: null,
      },
    ],
  };
}

describe('narrative repositories', () => {
  it('saves and reads a story bible graph', () => {
    const repos = openRepositories();
    repos.books.create({
      id: 'book-1',
      title: '新作品',
      idea: '命簿',
      targetChapters: 30,
      wordsPerChapter: 2000,
    });

    repos.storyBibles.saveGraph('book-1', bible());

    expect(repos.storyBibles.getByBook('book-1')?.themeQuestion).toBe('能否摆脱命运？');
    expect(repos.characterArcs.listByBook('book-1')).toHaveLength(1);
    expect(repos.worldRules.listByBook('book-1')[0].cost).toBe('失去经历。');
    expect(repos.narrativeThreads.listByBook('book-1')[0].type).toBe('main');
  });

  it('saves chapter cards and thread actions', () => {
    const repos = openRepositories();
    repos.books.create({
      id: 'book-1',
      title: '新作品',
      idea: '命簿',
      targetChapters: 1,
      wordsPerChapter: 2000,
    });
    repos.storyBibles.saveGraph('book-1', bible());

    const card: ChapterCard = {
      bookId: 'book-1',
      volumeIndex: 1,
      chapterIndex: 1,
      title: '旧页初鸣',
      plotFunction: '建立旧案目标。',
      povCharacterId: 'lin-mu',
      externalConflict: '宗门执事搜查旧页。',
      internalConflict: '林牧想隐瞒却必须求助。',
      relationshipChange: '林牧欠下同伴人情。',
      worldRuleUsedOrTested: 'record-cost',
      informationReveal: '命簿会吞记忆。',
      readerReward: 'truth',
      endingHook: '旧页浮现林家姓名。',
      mustChange: '林牧从逃避变成主动追查。',
      forbiddenMoves: ['不能揭示幕后主使。'],
    };

    repos.chapterCards.upsert(card);
    repos.chapterCards.upsertThreadActions('book-1', 1, 1, [
      {
        bookId: 'book-1',
        volumeIndex: 1,
        chapterIndex: 1,
        threadId: 'main-ledger-truth',
        action: 'advance',
        requiredEffect: '确认旧案和命簿有关。',
      },
    ]);

    expect(repos.chapterCards.listByBook('book-1')[0].mustChange).toContain('主动追查');
    expect(repos.chapterCards.listThreadActions('book-1', 1, 1)[0].action).toBe('advance');
  });

  it('stores audits and latest relationship states', () => {
    const repos = openRepositories();
    repos.books.create({
      id: 'book-1',
      title: '新作品',
      idea: '命簿',
      targetChapters: 1,
      wordsPerChapter: 2000,
    });

    const audit: NarrativeAudit = {
      passed: true,
      score: 88,
      decision: 'accept',
      issues: [],
      scoring: {
        characterLogic: 18,
        mainlineProgress: 13,
        relationshipChange: 13,
        conflictDepth: 14,
        worldRuleCost: 9,
        threadManagement: 8,
        pacingReward: 9,
        themeAlignment: 4,
      },
      stateUpdates: {
        characterArcUpdates: ['林牧开始主动追查。'],
        relationshipUpdates: [],
        threadUpdates: [],
        worldKnowledgeUpdates: [],
        themeUpdate: '自由开始意味着承担代价。',
      },
    };

    repos.chapterAudits.save({
      bookId: 'book-1',
      volumeIndex: 1,
      chapterIndex: 1,
      attempt: 1,
      audit,
    });

    expect(repos.chapterAudits.listByChapter('book-1', 1, 1)[0].score).toBe(88);
  });
});
```

- [ ] **Step 2: Run failing repository tests**

Run:

```bash
pnpm exec vitest run tests/storage/narrative-repositories.test.ts --reporter=dot
```

Expected: FAIL because `createRepositories` does not expose narrative repositories.

- [ ] **Step 3: Implement repositories**

Implement each repository with the existing `better-sqlite3` style. Use JSON serialization only for fields declared as JSON in schema: `ending_state_json`, `planned_turns_json`, `forbidden_moves_json`, `issues_json`, `state_updates_json`, checkpoint report JSON fields, and `characters_present`.

Each repository must expose these methods:

```ts
// story-bibles.ts
saveGraph(bookId: string, bible: NarrativeBible): void;
getByBook(bookId: string): Omit<NarrativeBible, 'characterArcs' | 'relationshipEdges' | 'worldRules' | 'narrativeThreads'> | null;

// character-arcs.ts
upsertMany(bookId: string, arcs: CharacterArc[]): void;
listByBook(bookId: string): CharacterArc[];
saveState(input: CharacterStateInput): void;
listLatestStatesByBook(bookId: string): CharacterStateOutput[];

// relationship-edges.ts
upsertMany(bookId: string, edges: RelationshipEdge[]): void;
listByBook(bookId: string): RelationshipEdge[];

// world-rules.ts
upsertMany(bookId: string, rules: WorldRule[]): void;
listByBook(bookId: string): WorldRule[];

// narrative-threads.ts
upsertMany(bookId: string, threads: NarrativeThread[]): void;
upsertThread(bookId: string, thread: NarrativeThread): void;
resolveThread(bookId: string, threadId: string, resolvedAt: number): void;
listByBook(bookId: string): NarrativeThread[];

// volume-plans.ts
upsertMany(bookId: string, plans: VolumePlan[]): void;
listByBook(bookId: string): VolumePlan[];

// chapter-cards.ts
upsert(card: ChapterCard): void;
upsertMany(cards: ChapterCard[]): void;
listByBook(bookId: string): ChapterCard[];
getNextUnwritten(bookId: string): ChapterCard | null;
upsertThreadActions(bookId: string, volumeIndex: number, chapterIndex: number, actions: ChapterThreadAction[]): void;
listThreadActions(bookId: string, volumeIndex: number, chapterIndex: number): ChapterThreadAction[];
upsertCharacterPressures(bookId: string, volumeIndex: number, chapterIndex: number, pressures: ChapterCharacterPressure[]): void;
listCharacterPressures(bookId: string, volumeIndex: number, chapterIndex: number): ChapterCharacterPressure[];
upsertRelationshipActions(bookId: string, volumeIndex: number, chapterIndex: number, actions: ChapterRelationshipAction[]): void;
listRelationshipActions(bookId: string, volumeIndex: number, chapterIndex: number): ChapterRelationshipAction[];

// chapter-audits.ts
save(input: { bookId: string; volumeIndex: number; chapterIndex: number; attempt: number; audit: NarrativeAudit }): void;
listByChapter(bookId: string, volumeIndex: number, chapterIndex: number): Array<NarrativeAudit & { attempt: number; createdAt: string }>;
```

- [ ] **Step 4: Export repositories from database**

Modify `src/storage/database.ts` so `createRepositories(db)` returns the new repositories:

```ts
return {
  books: createBookRepository(db),
  chapters: createChapterRepository(db),
  storyBibles: createStoryBibleRepository(db, {
    characterArcs: createCharacterArcRepository(db),
    relationshipEdges: createRelationshipEdgeRepository(db),
    worldRules: createWorldRuleRepository(db),
    narrativeThreads: createNarrativeThreadRepository(db),
  }),
  characterArcs: createCharacterArcRepository(db),
  relationshipEdges: createRelationshipEdgeRepository(db),
  worldRules: createWorldRuleRepository(db),
  narrativeThreads: createNarrativeThreadRepository(db),
  volumePlans: createVolumePlanRepository(db),
  chapterCards: createChapterCardRepository(db),
  chapterAudits: createChapterAuditRepository(db),
  relationshipStates: createRelationshipStateRepository(db),
  narrativeCheckpoints: createNarrativeCheckpointRepository(db),
  sceneRecords: createSceneRecordRepository(db),
  progress: createProgressRepository(db),
  settings: createSettingsRepository(db),
  modelConfigs: createModelConfigRepository(db),
  logs: createLogRepository(db),
};
```

If constructing a repository twice creates no state, this is acceptable. If TypeScript complains about duplicate local constants, create local variables first and reuse them.

- [ ] **Step 5: Run repository tests**

Run:

```bash
pnpm exec vitest run tests/storage/narrative-repositories.test.ts --reporter=dot
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/storage src/core/narrative/types.ts tests/storage/narrative-repositories.test.ts
git commit -m "feat: add narrative repositories"
```

## Task 4: Narrative JSON and Prompt Contracts

**Files:**
- Create: `src/core/narrative/json.ts`
- Create: `src/core/narrative/prompts.ts`
- Modify: `src/core/prompt-builder.ts`
- Test: `tests/core/narrative-prompts.test.ts`

- [ ] **Step 1: Write failing prompt tests**

Create `tests/core/narrative-prompts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildChapterAuditPrompt,
  buildChapterCardPrompt,
  buildNarrativeBiblePrompt,
  buildNarrativeDraftPrompt,
  buildRevisionPrompt,
  parseJsonObject,
} from '../../src/core/narrative/prompts';

describe('narrative prompts', () => {
  it('requires costly world rules and character arc anchors in bible prompt', () => {
    const prompt = buildNarrativeBiblePrompt({
      idea: '一个修复命簿的人发现自己的家族被命运删除。',
      targetChapters: 80,
      wordsPerChapter: 2200,
    });

    expect(prompt).toContain('Return valid JSON only');
    expect(prompt).toContain('desire');
    expect(prompt).toContain('fear');
    expect(prompt).toContain('flaw');
    expect(prompt).toContain('cost');
    expect(prompt).toContain('themeAnswerDirection');
  });

  it('requires chapter cards to include mustChange and readerReward', () => {
    const prompt = buildChapterCardPrompt({
      bookId: 'book-1',
      targetChapters: 3,
      bibleSummary: '主题：自由的代价。',
      volumePlansText: '第一卷：旧页初鸣，1-3章。',
    });

    expect(prompt).toContain('mustChange');
    expect(prompt).toContain('readerReward');
    expect(prompt).toContain('forbiddenMoves');
  });

  it('draft prompt includes command context and forbids explanation', () => {
    const prompt = buildNarrativeDraftPrompt({
      idea: '命簿',
      wordsPerChapter: 2000,
      commandContext: 'Chapter Mission: 林牧必须主动追查。',
    });

    expect(prompt).toContain('Return only the final chapter prose');
    expect(prompt).toContain('Chapter Mission');
    expect(prompt).toContain('approximately 2000 Chinese characters');
  });

  it('audit and revision prompts carry issues back into the fix request', () => {
    expect(
      buildChapterAuditPrompt({
        draft: '林牧直接改写命簿，没有代价。',
        auditContext: 'World Rule and Cost: 改写命簿会失去记忆。',
      })
    ).toContain('world_rule_violation');

    expect(
      buildRevisionPrompt({
        originalPrompt: '写第一章。',
        draft: '林牧直接胜利。',
        issues: [
          {
            type: 'world_rule_violation',
            severity: 'major',
            evidence: '没有体现代价。',
            fixInstruction: '加入记忆损失。',
          },
        ],
      })
    ).toContain('加入记忆损失');
  });
});

describe('parseJsonObject', () => {
  it('strips markdown code fences before parsing JSON', () => {
    expect(parseJsonObject<{ ok: boolean }>('```json\\n{"ok":true}\\n```')).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run failing prompt tests**

Run:

```bash
pnpm exec vitest run tests/core/narrative-prompts.test.ts --reporter=dot
```

Expected: FAIL because prompt helpers do not exist.

- [ ] **Step 3: Implement JSON helper**

Create `src/core/narrative/json.ts`:

```ts
export function stripCodeFences(text: string) {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return trimmed;

  return trimmed
    .replace(/^```[a-zA-Z]*\n?/, '')
    .replace(/\n?```$/, '')
    .trim();
}

export function parseJsonObject<T>(text: string): T {
  return JSON.parse(stripCodeFences(text)) as T;
}

export function buildJsonRepairPrompt(input: {
  originalPrompt: string;
  invalidText: string;
  parseError: string;
}) {
  return [
    'Repair the model output so it becomes valid JSON only.',
    `Parse error: ${input.parseError}`,
    'Original task:',
    input.originalPrompt,
    'Invalid output:',
    input.invalidText,
    'Return valid JSON only. Do not wrap JSON in markdown fences.',
  ].join('\n');
}
```

- [ ] **Step 4: Implement narrative prompts**

Create `src/core/narrative/prompts.ts` and re-export `parseJsonObject` from `json.ts`:

```ts
import type { NarrativeAudit } from './types.js';
export { parseJsonObject } from './json.js';

export function buildNarrativeBiblePrompt(input: {
  idea: string;
  targetChapters: number;
  wordsPerChapter: number;
}) {
  return [
    'Design a long-form Chinese web novel narrative bible.',
    'Return valid JSON only. Do not wrap JSON in markdown fences.',
    `User idea: ${input.idea}`,
    `Target chapters: ${input.targetChapters}`,
    `Words per chapter: ${input.wordsPerChapter}`,
    'The JSON must include premise, genreContract, targetReaderExperience, themeQuestion, themeAnswerDirection, centralDramaticQuestion, endingState, voiceGuide.',
    'Each characterArcs item must include id, name, roleType, desire, fear, flaw, misbelief, wound, externalGoal, internalNeed, arcDirection, decisionLogic, lineWillNotCross, lineMayEventuallyCross, currentArcPhase.',
    'Each worldRules item must include id, category, ruleText, cost, whoBenefits, whoSuffers, taboo, violationConsequence, allowedException, currentStatus.',
    'Each narrativeThreads item must include id, type, promise, plantedAt, expectedPayoff, resolvedAt, currentState, importance, payoffMustChange, ownerCharacterId, relatedRelationshipId, notes.',
    'All ids must be stable kebab-case strings.',
  ].join('\n');
}

export function buildVolumePlanPrompt(input: {
  targetChapters: number;
  bibleSummary: string;
}) {
  return [
    'Create volume plans for this long-form Chinese web novel.',
    'Return valid JSON only: an array of volume plan objects.',
    `Target chapters: ${input.targetChapters}`,
    `Narrative bible summary:\n${input.bibleSummary}`,
    'Chapter ranges must continuously cover chapter 1 through targetChapters.',
    'Each volume must include title, chapterStart, chapterEnd, roleInStory, mainPressure, promisedPayoff, characterArcMovement, relationshipMovement, worldExpansion, endingTurn.',
  ].join('\n');
}

export function buildChapterCardPrompt(input: {
  bookId: string;
  targetChapters: number;
  bibleSummary: string;
  volumePlansText: string;
}) {
  return [
    'Create chapter cards for a long-form Chinese web novel.',
    'Return valid JSON only with keys cards, threadActions, characterPressures, relationshipActions.',
    `Book id: ${input.bookId}`,
    `Target chapters: ${input.targetChapters}`,
    `Narrative bible summary:\n${input.bibleSummary}`,
    `Volume plans:\n${input.volumePlansText}`,
    'Each card must include volumeIndex, chapterIndex, title, plotFunction, povCharacterId, externalConflict, internalConflict, relationshipChange, worldRuleUsedOrTested, informationReveal, readerReward, endingHook, mustChange, forbiddenMoves.',
    'Every chapter must produce an irreversible mustChange.',
    'threadActions must use action plant, advance, misdirect, or payoff.',
    'Do not create extra major characters unless required by the bible.',
  ].join('\n');
}

export function buildNarrativeDraftPrompt(input: {
  idea: string;
  wordsPerChapter: number;
  commandContext: string;
}) {
  return [
    'Write the next chapter of a long-form Chinese web novel.',
    `Book idea: ${input.idea}`,
    `Write approximately ${input.wordsPerChapter} Chinese characters.`,
    input.commandContext,
    'Hard requirements: complete mustChange, preserve forbiddenMoves, show world-rule cost when a rule is used, and make relationship changes visible through action.',
    'Return only the final chapter prose. Do not summarize or explain.',
  ].join('\n');
}

export function buildChapterAuditPrompt(input: {
  draft: string;
  auditContext: string;
}) {
  return [
    'Audit this chapter draft for long-form narrative drift.',
    'Return valid JSON only with passed, score, decision, issues, scoring, stateUpdates.',
    'Issue type enum: character_logic, relationship_static, world_rule_violation, mainline_stall, thread_leak, pacing_problem, theme_drift, chapter_too_empty, forbidden_move, missing_reader_reward.',
    'Decision rules: accept for strong chapters, revise for fixable major issues, rewrite for blockers.',
    `Audit context:\n${input.auditContext}`,
    `Draft:\n${input.draft}`,
  ].join('\n');
}

export function buildRevisionPrompt(input: {
  originalPrompt: string;
  draft: string;
  issues: NarrativeAudit['issues'];
}) {
  return [
    input.originalPrompt,
    '',
    'Revise the draft using the audit issues below.',
    'Preserve the chapter direction and useful prose. Do not introduce new major characters or new major rules.',
    `Draft:\n${input.draft}`,
    'Audit issues:',
    ...input.issues.map(
      (issue) =>
        `- ${issue.severity} ${issue.type}: ${issue.evidence}; fix=${issue.fixInstruction}`
    ),
    'Return only the revised chapter prose.',
  ].join('\n');
}
```

- [ ] **Step 5: Keep legacy prompt-builder exports**

Modify `src/core/prompt-builder.ts` to import the new narrative prompt helpers and export them without changing legacy functions:

```ts
export {
  buildChapterAuditPrompt,
  buildChapterCardPrompt,
  buildNarrativeBiblePrompt,
  buildNarrativeDraftPrompt,
  buildRevisionPrompt,
  buildVolumePlanPrompt,
} from './narrative/prompts.js';
```

- [ ] **Step 6: Run prompt tests**

Run:

```bash
pnpm exec vitest run tests/core/narrative-prompts.test.ts tests/core/prompt-builder.test.ts --reporter=dot
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/core/narrative/json.ts src/core/narrative/prompts.ts src/core/prompt-builder.ts tests/core/narrative-prompts.test.ts
git commit -m "feat: add narrative prompt contracts"
```

## Task 5: Mock Narrative Services

**Files:**
- Modify: `src/mock/story-services.ts`
- Modify: `src/core/development-outline.ts`
- Test: `tests/mock/story-services.test.ts`
- Test: `tests/core/development-outline.test.ts`

- [ ] **Step 1: Add failing mock tests**

Extend `tests/mock/story-services.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createMockStoryServices } from '../../src/mock/story-services';

describe('mock narrative control loop', () => {
  it('generates a structured narrative bundle with bible, volumes, and chapter cards', async () => {
    const services = createMockStoryServices();
    const result = await services.outlineService.generateFromIdea({
      bookId: 'book-1',
      idea: '一个修复命簿的人发现家族被命运删除。',
      targetChapters: 6,
      wordsPerChapter: 1800,
      modelId: 'mock',
    });

    expect(result.narrativeBible.themeQuestion).toContain('命运');
    expect(result.narrativeBible.characterArcs[0].desire).toMatch(/[查找追]/);
    expect(result.narrativeBible.worldRules[0].cost).toMatch(/[代价记忆失去]/);
    expect(result.volumePlans[0].chapterStart).toBe(1);
    expect(result.chapterCards).toHaveLength(6);
    expect(result.chapterCards[0].mustChange).not.toHaveLength(0);
    expect(result.chapterCards[0].readerReward).toMatch(/truth|breakthrough|failure|reversal|dread|relief|upgrade|confession/);
  });

  it('audits a mock chapter and returns an accept decision with scoring', async () => {
    const services = createMockStoryServices();
    const audit = await services.chapterAuditor.auditChapter({
      modelId: 'mock',
      draft: '林牧触碰命簿碎页，失去关于母亲声音的一段记忆，却确认林家旧案被宗门遮掩。',
      auditContext: 'mustChange: 林牧从逃避变成主动追查。 World Rule and Cost: 改写命簿会失去记忆。',
    });

    expect(audit.decision).toBe('accept');
    expect(audit.score).toBeGreaterThanOrEqual(80);
    expect(audit.stateUpdates.themeUpdate).toContain('代价');
  });
});
```

- [ ] **Step 2: Run failing mock tests**

Run:

```bash
pnpm exec vitest run tests/mock/story-services.test.ts --reporter=dot
```

Expected: FAIL because mock services do not expose `narrativeBible`, `chapterCards`, or `chapterAuditor`.

- [ ] **Step 3: Extend OutlineBundle type**

Modify `src/core/types.ts`:

```ts
import type {
  ChapterCard,
  ChapterCharacterPressure,
  ChapterRelationshipAction,
  ChapterThreadAction,
  NarrativeBible,
  VolumePlan,
} from './narrative/types.js';

export type OutlineBundle = {
  worldSetting: string;
  masterOutline: string;
  volumeOutlines: string[];
  chapterOutlines: ChapterOutline[];
  narrativeBible: NarrativeBible;
  volumePlans: VolumePlan[];
  chapterCards: ChapterCard[];
  chapterThreadActions: ChapterThreadAction[];
  chapterCharacterPressures: ChapterCharacterPressure[];
  chapterRelationshipActions: ChapterRelationshipAction[];
};
```

Keep existing `ChapterOutline` type for renderer compatibility.

- [ ] **Step 4: Implement deterministic mock narrative data**

Modify `src/mock/story-services.ts` so `createMockOutlineService().generateFromIdea` returns the new fields. The mock should derive names from existing helpers where possible and use stable ids:

```ts
const narrativeBible = {
  premise: `${protagonist}从最低谷起势，追查旧案真相并重塑命运。`,
  genreContract: `${genre.label}长篇，主打升级、反转、关系拉扯和规则代价。`,
  targetReaderExperience: '每几章获得一次真相、突破、失败或关系反转。',
  themeQuestion: '人能不能摆脱命运？',
  themeAnswerDirection: '人可以改写命运，但必须承担公开、记忆和关系代价。',
  centralDramaticQuestion: `${protagonist}能否查清旧案并避免成为新的压迫者？`,
  endingState: {
    protagonistWins: '夺回选择权。',
    protagonistLoses: '失去躲在旧身份里的安全。',
    worldChange: '旧秩序被迫公开规则。',
    relationshipOutcome: '关键关系从依附变成并肩。',
    themeAnswer: '自由不是没有代价，而是愿意承担代价。',
  },
  voiceGuide: '中文网文节奏，章末有钩子，冲突推进清楚。',
  characterArcs: [
    {
      id: protagonistId,
      name: protagonist,
      roleType: 'protagonist',
      desire: '查清旧案真相并夺回选择权。',
      fear: '再次被宗门和命运彻底抹除。',
      flaw: '遇到危险时习惯独自承担并隐瞒代价。',
      misbelief: '只要自己掌握规则，就能保护所有重要的人。',
      wound: '幼年亲眼见到家族记录被删去。',
      externalGoal: '找到改写命运的核心证据。',
      internalNeed: '学会公开风险并信任同伴。',
      arcDirection: 'growth',
      decisionLogic: '优先保护弱者，但会把真正代价藏在自己身上。',
      lineWillNotCross: '不主动牺牲无辜者的记忆。',
      lineMayEventuallyCross: '公开自己的禁忌身份。',
      currentArcPhase: 'denial',
    },
    {
      id: 'ledger-enforcer',
      name: `${faction}执令者`,
      roleType: 'antagonist',
      desire: '维持旧秩序对命运记录的垄断。',
      fear: '底层知道规则真相后推翻秩序。',
      flaw: '把稳定看得高于人的选择。',
      misbelief: '少数人的牺牲可以换来天下安稳。',
      wound: '曾因规则失控失去亲族。',
      externalGoal: '夺回所有旧案证据。',
      internalNeed: '承认秩序也会制造灾难。',
      arcDirection: 'fall',
      decisionLogic: '以秩序之名压制真相。',
      lineWillNotCross: '不亲手毁掉命簿原本。',
      lineMayEventuallyCross: '牺牲盟友保住秩序。',
      currentArcPhase: 'control',
    },
  ],
  relationshipEdges: [
    {
      id: `${protagonistId}-ally`,
      fromCharacterId: protagonistId,
      toCharacterId: 'ally-witness',
      visibleLabel: '临时同盟',
      hiddenTruth: '同伴家族也被旧案牵连。',
      dependency: `${protagonist}需要同伴辨认旧案证词。`,
      debt: `${protagonist}欠同伴一次救命人情。`,
      misunderstanding: '同伴以为主角追查只是为了复仇。',
      affection: '信任会在共同承担代价后增长。',
      harmPattern: '主角隐瞒代价会反复伤害同伴。',
      sharedGoal: '查清旧案。',
      valueConflict: '主角倾向隐忍，同伴要求公开。',
      trustLevel: 0,
      tensionLevel: 2,
      currentState: '互相试探',
      plannedTurns: [{ chapterRange: '1-6', change: '从交易关系变成共同承担风险。' }],
    },
  ],
  worldRules: [
    {
      id: 'record-cost',
      category: 'power',
      ruleText: '改写命运记录会交换等量真实记忆。',
      cost: '失去一段无法恢复的亲身经历。',
      whoBenefits: faction,
      whoSuffers: '被记录系统压迫的普通人',
      taboo: '不可改写死人命格。',
      violationConsequence: '改写者被命簿反噬。',
      allowedException: '以自愿记忆为祭。',
      currentStatus: 'active',
    },
    {
      id: 'rank-access',
      category: 'society',
      ruleText: '只有持令者能查阅完整命籍。',
      cost: '持令者必须接受宗门审计。',
      whoBenefits: faction,
      whoSuffers: '无令散修',
      taboo: '伪造令牌。',
      violationConsequence: '被剥夺身份并追捕。',
      allowedException: '公开审议时临时授权。',
      currentStatus: 'active',
    },
    {
      id: 'daily-ledger',
      category: 'daily_life',
      ruleText: '普通人的婚契、债契和迁徙都依赖命籍登记。',
      cost: '登记错误会让人失去合法身份。',
      whoBenefits: '地方书吏',
      whoSuffers: '底层百姓',
      taboo: '私改民籍。',
      violationConsequence: '牵连整户。',
      allowedException: '灾年赦令。',
      currentStatus: 'active',
    },
  ],
  narrativeThreads: [
    {
      id: 'main-ledger-truth',
      type: 'main',
      promise: `${protagonist}追查家族旧案为何被命运记录抹除。`,
      plantedAt: 1,
      expectedPayoff: Math.max(3, Math.min(input.targetChapters, 20)),
      resolvedAt: null,
      currentState: 'open',
      importance: 'critical',
      payoffMustChange: 'world',
      ownerCharacterId: protagonistId,
      relatedRelationshipId: null,
      notes: null,
    },
    {
      id: 'theme-freedom-cost',
      type: 'theme',
      promise: '自由是否值得失去安全和记忆。',
      plantedAt: 1,
      expectedPayoff: null,
      resolvedAt: null,
      currentState: 'open',
      importance: 'critical',
      payoffMustChange: 'theme',
      ownerCharacterId: protagonistId,
      relatedRelationshipId: `${protagonistId}-ally`,
      notes: null,
    },
    {
      id: 'antagonist-order',
      type: 'antagonist',
      promise: `${faction}执令者为何坚信旧秩序必须存在。`,
      plantedAt: 2,
      expectedPayoff: Math.max(4, Math.min(input.targetChapters, 30)),
      resolvedAt: null,
      currentState: 'open',
      importance: 'normal',
      payoffMustChange: 'character',
      ownerCharacterId: 'ledger-enforcer',
      relatedRelationshipId: null,
      notes: null,
    },
  ],
} satisfies NarrativeBible;
```

Create `chapterCards` from the existing `chapterOutlines` with real conflict fields:

```ts
const chapterCards = chapterOutlines.map((chapter) => ({
  bookId: input.bookId,
  volumeIndex: chapter.volumeIndex,
  chapterIndex: chapter.chapterIndex,
  title: chapter.title,
  plotFunction: chapter.outline,
  povCharacterId: `${protagonistId}`,
  externalConflict: `${faction}逼迫${protagonist}交出线索。`,
  internalConflict: `${protagonist}想独自承担，却需要相信他人。`,
  relationshipChange: `${protagonist}与同伴的信任出现一次可见变化。`,
  worldRuleUsedOrTested: 'record-cost',
  informationReveal: `旧案真相推进到第${chapter.chapterIndex}层。`,
  readerReward: chapter.chapterIndex % 4 === 0 ? 'reversal' : 'truth',
  endingHook: `新的代价在第${chapter.chapterIndex}章末浮出水面。`,
  mustChange: `${protagonist}在第${chapter.chapterIndex}章后不能回到原来的安全状态。`,
  forbiddenMoves: ['不能提前揭示最终幕后主使。'],
}));
```

- [ ] **Step 5: Add mock auditor and state extractor**

Extend `createMockStoryServices()` return value:

```ts
chapterAuditor: {
  async auditChapter() {
    return {
      passed: true,
      score: 88,
      decision: 'accept',
      issues: [],
      scoring: {
        characterLogic: 18,
        mainlineProgress: 13,
        relationshipChange: 13,
        conflictDepth: 14,
        worldRuleCost: 9,
        threadManagement: 8,
        pacingReward: 9,
        themeAlignment: 4,
      },
      stateUpdates: {
        characterArcUpdates: ['主角更主动承担代价。'],
        relationshipUpdates: ['信任因共同承担风险而上升。'],
        threadUpdates: ['主线旧案获得新证据。'],
        worldKnowledgeUpdates: ['命运规则的代价更加明确。'],
        themeUpdate: '自由需要承担代价。',
      },
    };
  },
},
```

Also add `chapterRevision` and `narrativeStateExtractor` mock stubs used by later tasks:

```ts
chapterRevision: {
  async reviseChapter(input: { draft: string }) {
    return `${input.draft}\n\n这一代价没有消失，而是在他心里留下新的缺口。`;
  },
},
narrativeStateExtractor: {
  async extractState() {
    return {
      characterStates: [],
      relationshipStates: [],
      threadUpdates: [],
      scene: null,
      themeProgression: '自由需要承担代价。',
    };
  },
},
```

- [ ] **Step 6: Run mock tests**

Run:

```bash
pnpm exec vitest run tests/mock/story-services.test.ts tests/core/development-outline.test.ts --reporter=dot
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/mock/story-services.ts src/core/development-outline.ts src/core/types.ts tests/mock/story-services.test.ts tests/core/development-outline.test.ts
git commit -m "feat: add mock narrative generation"
```

## Task 6: AI Narrative Planning Service

**Files:**
- Modify: `src/core/ai-outline.ts`
- Test: `tests/core/ai-outline.test.ts`

- [ ] **Step 1: Add failing AI outline test**

Extend `tests/core/ai-outline.test.ts` with a deterministic fake `generateText` sequence:

```ts
it('generates bible, volume plans, and chapter cards from AI JSON', async () => {
  const service = createAiOutlineService({
    registry: { languageModel: () => ({}) },
    generateText: async ({ prompt }) => {
      if (prompt.includes('narrative bible')) {
        return { text: JSON.stringify(validNarrativeBibleJson()) };
      }
      if (prompt.includes('volume plans')) {
        return {
          text: JSON.stringify([
            {
              volumeIndex: 1,
              title: '命簿初鸣',
              chapterStart: 1,
              chapterEnd: 2,
              roleInStory: '建立旧案。',
              mainPressure: '宗门追捕。',
              promisedPayoff: '拿到碎页。',
              characterArcMovement: '林牧开始信任同伴。',
              relationshipMovement: '信任从零到一。',
              worldExpansion: '命簿代价显露。',
              endingTurn: '碎页指向师父。',
            },
          ]),
        };
      }
      if (prompt.includes('chapter cards')) {
        return {
          text: JSON.stringify({
            cards: [
              validChapterCardJson(1),
              validChapterCardJson(2),
            ],
            threadActions: [],
            characterPressures: [],
            relationshipActions: [],
          }),
        };
      }
      return { text: '旧标题' };
    },
  });

  const result = await service.generateFromIdea({
    bookId: 'book-1',
    idea: '命簿',
    targetChapters: 2,
    wordsPerChapter: 2000,
    modelId: 'model-1',
  });

  expect(result.narrativeBible.themeQuestion).toContain('命运');
  expect(result.volumePlans).toHaveLength(1);
  expect(result.chapterCards).toHaveLength(2);
  expect(result.chapterOutlines[0].outline).toContain('必须变化');
});
```

Add local helper functions in the test file so the test is self-contained:

```ts
function validNarrativeBibleJson() {
  return {
    premise: '命簿修复师追查旧案。',
    genreContract: '东方幻想。',
    targetReaderExperience: '真相、代价、反转。',
    themeQuestion: '人能否摆脱命运？',
    themeAnswerDirection: '自由来自承担代价。',
    centralDramaticQuestion: '林牧能否改写命簿？',
    endingState: {
      protagonistWins: '夺回选择权。',
      protagonistLoses: '失去匿名安全。',
      worldChange: '命簿公开。',
      relationshipOutcome: '并肩而非依附。',
      themeAnswer: '自由需要责任。',
    },
    voiceGuide: '中文网文。',
    characterArcs: [
      {
        id: 'lin-mu',
        name: '林牧',
        roleType: 'protagonist',
        desire: '查清真相。',
        fear: '被遗忘。',
        flaw: '独自承担。',
        misbelief: '掌控记录才能保护别人。',
        wound: '家族被抹除。',
        externalGoal: '寻找命簿。',
        internalNeed: '学会共享风险。',
        arcDirection: 'growth',
        decisionLogic: '保护弱者但隐瞒危险。',
        lineWillNotCross: '不抹除无辜者。',
        lineMayEventuallyCross: '公开身份。',
        currentArcPhase: 'denial',
      },
    ],
    relationshipEdges: [],
    worldRules: [
      {
        id: 'record-cost',
        category: 'power',
        ruleText: '改写命簿会交换记忆。',
        cost: '失去经历。',
        whoBenefits: '掌簿宗门',
        whoSuffers: '散修',
        taboo: '不可改死人命格',
        violationConsequence: '反噬',
        allowedException: '自愿献祭',
        currentStatus: 'active',
      },
    ],
    narrativeThreads: [
      {
        id: 'main-ledger-truth',
        type: 'main',
        promise: '查清林家旧案。',
        plantedAt: 1,
        expectedPayoff: 2,
        resolvedAt: null,
        currentState: 'open',
        importance: 'critical',
        payoffMustChange: 'world',
        ownerCharacterId: 'lin-mu',
        relatedRelationshipId: null,
        notes: null,
      },
    ],
  };
}
```

- [ ] **Step 2: Run failing AI outline test**

Run:

```bash
pnpm exec vitest run tests/core/ai-outline.test.ts --reporter=dot
```

Expected: FAIL because `createAiOutlineService.generateFromIdea` still uses legacy world/master/volume prompts.

- [ ] **Step 3: Implement narrative planning in AI outline service**

Modify `src/core/ai-outline.ts`:

- Keep `generateTitleFromIdea` unchanged.
- Replace `generateFromIdea` internals with:
  1. generate bible JSON using `buildNarrativeBiblePrompt`;
  2. parse with `parseJsonObject<NarrativeBible>`;
  3. validate with `validateNarrativeBible`;
  4. generate volume plan JSON using `buildVolumePlanPrompt`;
  5. validate with `validateVolumePlans`;
  6. generate chapter card JSON using `buildChapterCardPrompt`;
  7. validate with `validateChapterCards`;
  8. derive legacy `worldSetting`, `masterOutline`, `volumeOutlines`, and `chapterOutlines` from structured records.

Add helpers:

```ts
function renderWorldSettingFromBible(bible: NarrativeBible) {
  return [
    `Premise: ${bible.premise}`,
    `Theme: ${bible.themeQuestion}`,
    `Theme answer direction: ${bible.themeAnswerDirection}`,
    'World rules:',
    ...bible.worldRules.map((rule) => `${rule.id}: ${rule.ruleText}; cost=${rule.cost}`),
  ].join('\n');
}

function renderMasterOutlineFromPlans(bible: NarrativeBible, volumePlans: VolumePlan[]) {
  return [
    `Central dramatic question: ${bible.centralDramaticQuestion}`,
    ...volumePlans.map(
      (volume) =>
        `Volume ${volume.volumeIndex} ${volume.title}: chapters ${volume.chapterStart}-${volume.chapterEnd}; payoff=${volume.promisedPayoff}; ending=${volume.endingTurn}`
    ),
  ].join('\n');
}

function chapterOutlinesFromCards(cards: ChapterCard[]): ChapterOutline[] {
  return cards.map((card) => ({
    volumeIndex: card.volumeIndex,
    chapterIndex: card.chapterIndex,
    title: card.title,
    outline: [
      card.plotFunction,
      `必须变化：${card.mustChange}`,
      `外部冲突：${card.externalConflict}`,
      `内部冲突：${card.internalConflict}`,
      `关系变化：${card.relationshipChange}`,
      `章末钩子：${card.endingHook}`,
    ].join('\n'),
  }));
}
```

If validation fails, throw `new Error(\`Invalid narrative bible: ${issues.join('; ')}\`)` or matching entity name.

- [ ] **Step 4: Run AI outline tests**

Run:

```bash
pnpm exec vitest run tests/core/ai-outline.test.ts tests/core/narrative-validation.test.ts --reporter=dot
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/ai-outline.ts tests/core/ai-outline.test.ts
git commit -m "feat: generate narrative planning bundle"
```

## Task 7: Narrative Command Context Builder

**Files:**
- Create: `src/core/narrative/context.ts`
- Modify: `src/core/consistency.ts`
- Test: `tests/core/narrative-context.test.ts`
- Test: `tests/core/consistency.test.ts`

- [ ] **Step 1: Write failing context tests**

Create `tests/core/narrative-context.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildNarrativeCommandContext } from '../../src/core/narrative/context';

describe('buildNarrativeCommandContext', () => {
  it('keeps chapter mission and forbidden moves when trimming', () => {
    const result = buildNarrativeCommandContext({
      bible: {
        themeQuestion: '人能否摆脱命运？',
        themeAnswerDirection: '自由需要承担代价。',
        voiceGuide: '中文网文。',
      },
      chapterCard: {
        title: '旧页初鸣',
        plotFunction: '建立旧案。',
        externalConflict: '宗门执事追捕。',
        internalConflict: '林牧想隐瞒却需要求助。',
        relationshipChange: '林牧欠下人情。',
        worldRuleUsedOrTested: 'record-cost',
        informationReveal: '命簿吞记忆。',
        readerReward: 'truth',
        endingHook: '旧页浮现林家姓名。',
        mustChange: '林牧从逃避变为主动追查。',
        forbiddenMoves: ['不能揭示最终幕后主使。'],
      },
      hardContinuity: Array.from({ length: 20 }, (_, index) => `事实${index}: ${'很长'.repeat(20)}`),
      characterPressures: ['林牧: 欲望被旧页刺激，恐惧被遗忘。'],
      relationshipActions: ['林牧和阿照: trust +1 because shared risk.'],
      threadActions: ['main-ledger-truth advance: 确认旧案有关。'],
      worldRules: ['record-cost: 改写命簿会失去记忆。'],
      recentSummaries: ['上一章林牧失去身份。'],
      previousChapterEnding: '碎页发光。',
      maxCharacters: 650,
    });

    expect(result.length).toBeLessThanOrEqual(650);
    expect(result).toContain('Chapter Mission');
    expect(result).toContain('mustChange: 林牧从逃避变为主动追查。');
    expect(result).toContain('Forbidden Moves');
    expect(result).toContain('不能揭示最终幕后主使。');
  });
});
```

- [ ] **Step 2: Run failing context test**

Run:

```bash
pnpm exec vitest run tests/core/narrative-context.test.ts --reporter=dot
```

Expected: FAIL because the context builder does not exist.

- [ ] **Step 3: Implement context builder**

Create `src/core/narrative/context.ts`:

```ts
type CompactBible = {
  themeQuestion: string;
  themeAnswerDirection: string;
  voiceGuide: string;
};

type CompactChapterCard = {
  title: string;
  plotFunction: string;
  externalConflict: string;
  internalConflict: string;
  relationshipChange: string;
  worldRuleUsedOrTested: string;
  informationReveal: string;
  readerReward: string;
  endingHook: string;
  mustChange: string;
  forbiddenMoves: string[];
};

function appendIfFits(lines: string[], line: string, requiredTail: string, maxCharacters: number) {
  const next = [...lines, line, requiredTail].join('\n');
  if (next.length <= maxCharacters) lines.push(line);
}

export function buildNarrativeCommandContext(input: {
  bible: CompactBible;
  chapterCard: CompactChapterCard;
  hardContinuity: string[];
  characterPressures: string[];
  relationshipActions: string[];
  threadActions: string[];
  worldRules: string[];
  recentSummaries: string[];
  previousChapterEnding: string | null;
  maxCharacters?: number;
}) {
  const requiredTail = [
    'Chapter Mission:',
    `title: ${input.chapterCard.title}`,
    `plotFunction: ${input.chapterCard.plotFunction}`,
    `externalConflict: ${input.chapterCard.externalConflict}`,
    `internalConflict: ${input.chapterCard.internalConflict}`,
    `relationshipChange: ${input.chapterCard.relationshipChange}`,
    `worldRuleUsedOrTested: ${input.chapterCard.worldRuleUsedOrTested}`,
    `informationReveal: ${input.chapterCard.informationReveal}`,
    `readerReward: ${input.chapterCard.readerReward}`,
    `endingHook: ${input.chapterCard.endingHook}`,
    `mustChange: ${input.chapterCard.mustChange}`,
    'Forbidden Moves:',
    ...input.chapterCard.forbiddenMoves,
  ].join('\n');

  const full = [
    'Hard Continuity:',
    ...input.hardContinuity,
    'Character Pressure:',
    ...input.characterPressures,
    'Relationship Delta:',
    ...input.relationshipActions,
    'Thread Obligations:',
    ...input.threadActions,
    'World Rule and Cost:',
    ...input.worldRules,
    'Theme Pressure:',
    `themeQuestion: ${input.bible.themeQuestion}`,
    `themeAnswerDirection: ${input.bible.themeAnswerDirection}`,
    'Recent Summaries:',
    ...input.recentSummaries,
    ...(input.previousChapterEnding ? [`Previous Chapter Ending: ${input.previousChapterEnding}`] : []),
    requiredTail,
  ].join('\n');

  if (!input.maxCharacters || full.length <= input.maxCharacters) return full;
  if (requiredTail.length >= input.maxCharacters) return requiredTail.slice(0, input.maxCharacters);

  const lines: string[] = [];
  for (const line of [
    'Hard Continuity:',
    ...input.hardContinuity,
    'Character Pressure:',
    ...input.characterPressures,
    'Relationship Delta:',
    ...input.relationshipActions,
    'Thread Obligations:',
    ...input.threadActions,
    'World Rule and Cost:',
    ...input.worldRules,
    'Theme Pressure:',
    `themeQuestion: ${input.bible.themeQuestion}`,
    `themeAnswerDirection: ${input.bible.themeAnswerDirection}`,
    'Recent Summaries:',
    ...input.recentSummaries,
    ...(input.previousChapterEnding ? [`Previous Chapter Ending: ${input.previousChapterEnding}`] : []),
  ]) {
    appendIfFits(lines, line, requiredTail, input.maxCharacters);
  }

  return [...lines, requiredTail].join('\n');
}
```

- [ ] **Step 4: Keep consistency tests green**

Do not remove legacy `buildStoredChapterContext`. If refactoring, leave its current behavior intact and add a small export wrapper for new narrative context only when `book-service` calls it.

Run:

```bash
pnpm exec vitest run tests/core/narrative-context.test.ts tests/core/consistency.test.ts --reporter=dot
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/narrative/context.ts src/core/consistency.ts tests/core/narrative-context.test.ts tests/core/consistency.test.ts
git commit -m "feat: add narrative command context"
```

## Task 8: Chapter Audit and Revision Services

**Files:**
- Create: `src/core/narrative/audit.ts`
- Create: `src/core/chapter-auditor.ts`
- Create: `src/core/chapter-revision.ts`
- Modify: `src/core/ai-post-chapter.ts`
- Test: `tests/core/chapter-audit.test.ts`

- [ ] **Step 1: Write failing audit tests**

Create `tests/core/chapter-audit.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { decideAuditOutcome } from '../../src/core/narrative/audit';
import { createAiChapterAuditor, createAiChapterRevisionService } from '../../src/core/ai-post-chapter';

describe('decideAuditOutcome', () => {
  it('rewrites blocker audits even when numeric score is acceptable', () => {
    expect(
      decideAuditOutcome({
        score: 78,
        issues: [
          {
            type: 'forbidden_move',
            severity: 'blocker',
            evidence: '提前揭示幕后主使。',
            fixInstruction: '移除终局揭示。',
          },
        ],
      })
    ).toBe('rewrite');
  });

  it('revises major issues and accepts strong audits', () => {
    expect(
      decideAuditOutcome({
        score: 72,
        issues: [
          {
            type: 'relationship_static',
            severity: 'major',
            evidence: '关系无变化。',
            fixInstruction: '加入信任破裂。',
          },
        ],
      })
    ).toBe('revise');

    expect(decideAuditOutcome({ score: 88, issues: [] })).toBe('accept');
  });
});

describe('AI audit and revision services', () => {
  it('normalizes the audit decision after parsing JSON', async () => {
    const service = createAiChapterAuditor({
      registry: { languageModel: () => ({}) },
      generateText: async () => ({
        text: JSON.stringify({
          passed: true,
          score: 90,
          decision: 'rewrite',
          issues: [],
          scoring: {
            characterLogic: 20,
            mainlineProgress: 15,
            relationshipChange: 15,
            conflictDepth: 15,
            worldRuleCost: 10,
            threadManagement: 10,
            pacingReward: 10,
            themeAlignment: 5,
          },
          stateUpdates: {
            characterArcUpdates: [],
            relationshipUpdates: [],
            threadUpdates: [],
            worldKnowledgeUpdates: [],
            themeUpdate: '自由需要代价。',
          },
        }),
      }),
    });

    const audit = await service.auditChapter({
      modelId: 'model-1',
      draft: '正文',
      auditContext: '上下文',
    });

    expect(audit.decision).toBe('accept');
    expect(audit.passed).toBe(true);
  });

  it('builds a revision request from audit issues', async () => {
    const service = createAiChapterRevisionService({
      registry: { languageModel: () => ({}) },
      generateText: async ({ prompt }) => ({ text: prompt.includes('加入记忆损失') ? '修订正文' : '错误' }),
    });

    const revised = await service.reviseChapter({
      modelId: 'model-1',
      originalPrompt: '原始写作提示',
      draft: '旧正文',
      issues: [
        {
          type: 'world_rule_violation',
          severity: 'major',
          evidence: '没有代价。',
          fixInstruction: '加入记忆损失。',
        },
      ],
    });

    expect(revised).toBe('修订正文');
  });
});
```

- [ ] **Step 2: Run failing audit tests**

Run:

```bash
pnpm exec vitest run tests/core/chapter-audit.test.ts --reporter=dot
```

Expected: FAIL because audit helpers and services do not exist.

- [ ] **Step 3: Implement audit decision helper**

Create `src/core/narrative/audit.ts`:

```ts
import type { AuditDecision, NarrativeAudit } from './types.js';

export function decideAuditOutcome(input: Pick<NarrativeAudit, 'score' | 'issues'>): AuditDecision {
  if (input.issues.some((issue) => issue.severity === 'blocker')) return 'rewrite';
  if (input.score < 60) return 'rewrite';
  if (input.issues.some((issue) => issue.severity === 'major')) return 'revise';
  if (input.score < 75) return 'revise';
  return 'accept';
}

export function normalizeAuditDecision(audit: NarrativeAudit): NarrativeAudit {
  const decision = decideAuditOutcome(audit);
  return {
    ...audit,
    decision,
    passed: decision === 'accept',
  };
}
```

- [ ] **Step 4: Add AI auditor and revision services**

Modify `src/core/ai-post-chapter.ts` and add:

```ts
import { buildChapterAuditPrompt, buildRevisionPrompt } from './narrative/prompts.js';
import { parseJsonObject } from './narrative/json.js';
import { normalizeAuditDecision } from './narrative/audit.js';
import type { NarrativeAudit } from './narrative/types.js';

export function createAiChapterAuditor(deps: {
  registry: { languageModel: (modelId: string) => unknown };
  generateText: (input: { model: unknown; prompt: string }) => Promise<{ text: string }>;
}) {
  return {
    async auditChapter(input: { modelId: string; draft: string; auditContext: string }) {
      const model = deps.registry.languageModel(input.modelId);
      const response = await deps.generateText({
        model,
        prompt: buildChapterAuditPrompt(input),
      });
      return normalizeAuditDecision(parseJsonObject<NarrativeAudit>(response.text));
    },
  };
}

export function createAiChapterRevisionService(deps: {
  registry: { languageModel: (modelId: string) => unknown };
  generateText: (input: { model: unknown; prompt: string }) => Promise<{ text: string }>;
}) {
  return {
    async reviseChapter(input: {
      modelId: string;
      originalPrompt: string;
      draft: string;
      issues: NarrativeAudit['issues'];
    }) {
      const model = deps.registry.languageModel(input.modelId);
      const response = await deps.generateText({
        model,
        prompt: buildRevisionPrompt(input),
      });
      return response.text.trim();
    },
  };
}
```

- [ ] **Step 5: Run audit tests**

Run:

```bash
pnpm exec vitest run tests/core/chapter-audit.test.ts --reporter=dot
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/narrative/audit.ts src/core/ai-post-chapter.ts tests/core/chapter-audit.test.ts
git commit -m "feat: add chapter audit and revision services"
```

## Task 9: Narrative State Extraction

**Files:**
- Create: `src/core/narrative/state.ts`
- Modify: `src/core/ai-post-chapter.ts`
- Test: `tests/core/narrative-state.test.ts`

- [ ] **Step 1: Write failing state extraction tests**

Create `tests/core/narrative-state.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { normalizeNarrativeStateDelta } from '../../src/core/narrative/state';
import { createAiNarrativeStateExtractor } from '../../src/core/ai-post-chapter';

describe('normalizeNarrativeStateDelta', () => {
  it('defaults missing arrays and preserves theme progression', () => {
    expect(
      normalizeNarrativeStateDelta({
        themeProgression: '自由开始意味着承担代价。',
      })
    ).toEqual({
      characterStates: [],
      relationshipStates: [],
      threadUpdates: [],
      worldRuleUpdates: [],
      scene: null,
      themeProgression: '自由开始意味着承担代价。',
    });
  });
});

describe('createAiNarrativeStateExtractor', () => {
  it('parses state deltas from JSON', async () => {
    const extractor = createAiNarrativeStateExtractor({
      registry: { languageModel: () => ({}) },
      generateText: async () => ({
        text: JSON.stringify({
          characterStates: [
            {
              characterId: 'lin-mu',
              location: '旧祠',
              status: '开始追查',
              knowledge: '命簿会吞记忆',
              emotion: '压抑',
              powerLevel: '初醒',
              arcPhase: 'commitment',
              desireState: '更强',
              fearState: '被刺激',
              flawState: '仍想隐瞒',
            },
          ],
          relationshipStates: [],
          threadUpdates: [],
          worldRuleUpdates: [],
          scene: null,
          themeProgression: '自由需要承担记忆代价。',
        }),
      }),
    });

    const result = await extractor.extractState({
      modelId: 'model-1',
      chapterIndex: 1,
      content: '正文',
      auditStateUpdates: {
        characterArcUpdates: [],
        relationshipUpdates: [],
        threadUpdates: [],
        worldKnowledgeUpdates: [],
        themeUpdate: '自由需要代价。',
      },
    });

    expect(result.characterStates[0].arcPhase).toBe('commitment');
    expect(result.themeProgression).toContain('代价');
  });
});
```

- [ ] **Step 2: Run failing state tests**

Run:

```bash
pnpm exec vitest run tests/core/narrative-state.test.ts --reporter=dot
```

Expected: FAIL because state helpers do not exist.

- [ ] **Step 3: Implement state types and normalizer**

Create `src/core/narrative/state.ts`:

```ts
export type NarrativeStateDelta = {
  characterStates: Array<{
    characterId: string;
    location: string | null;
    status: string | null;
    knowledge: string | null;
    emotion: string | null;
    powerLevel: string | null;
    arcPhase: string | null;
    desireState: string | null;
    fearState: string | null;
    flawState: string | null;
  }>;
  relationshipStates: Array<{
    relationshipId: string;
    trustLevel: number;
    tensionLevel: number;
    currentState: string;
    lastChange: string;
  }>;
  threadUpdates: Array<{
    threadId: string;
    currentState: string;
    resolvedAt: number | null;
    notes: string | null;
  }>;
  worldRuleUpdates: Array<{
    ruleId: string;
    currentStatus: string;
  }>;
  scene: {
    location: string;
    timeInStory: string;
    charactersPresent: string[];
    events: string | null;
  } | null;
  themeProgression: string;
};

export function normalizeNarrativeStateDelta(input: Partial<NarrativeStateDelta>): NarrativeStateDelta {
  return {
    characterStates: Array.isArray(input.characterStates) ? input.characterStates : [],
    relationshipStates: Array.isArray(input.relationshipStates) ? input.relationshipStates : [],
    threadUpdates: Array.isArray(input.threadUpdates) ? input.threadUpdates : [],
    worldRuleUpdates: Array.isArray(input.worldRuleUpdates) ? input.worldRuleUpdates : [],
    scene: input.scene ?? null,
    themeProgression: input.themeProgression ?? '',
  };
}
```

- [ ] **Step 4: Add AI state extractor**

Modify `src/core/ai-post-chapter.ts`:

```ts
import { normalizeNarrativeStateDelta, type NarrativeStateDelta } from './narrative/state.js';

export function createAiNarrativeStateExtractor(deps: {
  registry: { languageModel: (modelId: string) => unknown };
  generateText: (input: { model: unknown; prompt: string }) => Promise<{ text: string }>;
}) {
  return {
    async extractState(input: {
      modelId: string;
      chapterIndex: number;
      content: string;
      auditStateUpdates: {
        characterArcUpdates: string[];
        relationshipUpdates: string[];
        threadUpdates: string[];
        worldKnowledgeUpdates: string[];
        themeUpdate: string;
      };
    }): Promise<NarrativeStateDelta> {
      const model = deps.registry.languageModel(input.modelId);
      const response = await deps.generateText({
        model,
        prompt: [
          'Extract narrative state deltas from this approved chapter as JSON.',
          `Chapter index: ${input.chapterIndex}`,
          `Audit state updates: ${JSON.stringify(input.auditStateUpdates)}`,
          `Chapter content:\n${input.content}`,
          'Return JSON with characterStates, relationshipStates, threadUpdates, worldRuleUpdates, scene, themeProgression.',
        ].join('\n'),
      });
      return normalizeNarrativeStateDelta(parseJsonObject<Partial<NarrativeStateDelta>>(response.text));
    },
  };
}
```

- [ ] **Step 5: Run state tests**

Run:

```bash
pnpm exec vitest run tests/core/narrative-state.test.ts --reporter=dot
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/narrative/state.ts src/core/ai-post-chapter.ts tests/core/narrative-state.test.ts
git commit -m "feat: extract narrative state deltas"
```

## Task 10: Book Service Planning Persistence

**Files:**
- Modify: `src/core/book-service.ts`
- Modify: `tests/core/book-service.test.ts`

- [ ] **Step 1: Add failing startBook persistence test**

Extend `tests/core/book-service.test.ts` with a case that uses mock narrative repositories:

```ts
it('persists narrative bible, volume plans, and chapter cards when starting a book', async () => {
  const harness = createBookServiceHarness();
  const bookId = harness.service.createBook({
    idea: '命簿',
    targetChapters: 3,
    wordsPerChapter: 1800,
  });

  await harness.service.startBook(bookId);

  expect(harness.repositories.storyBibles.getByBook(bookId)?.themeQuestion).toContain('命运');
  expect(harness.repositories.characterArcs.listByBook(bookId).length).toBeGreaterThan(0);
  expect(harness.repositories.volumePlans.listByBook(bookId)).toHaveLength(1);
  expect(harness.repositories.chapterCards.listByBook(bookId)).toHaveLength(3);
  expect(harness.repositories.chapters.listByBook(bookId)).toHaveLength(3);
});
```

If the existing harness does not expose new repositories, extend it to use `createRepositories` from `src/storage/database.ts` or add in-memory fakes with the same methods. Prefer real repositories with an in-memory SQLite database.

- [ ] **Step 2: Run failing book-service test**

Run:

```bash
pnpm exec vitest run tests/core/book-service.test.ts -t "persists narrative bible" --reporter=dot
```

Expected: FAIL because `startBook` still saves `book_context` and chapter outlines only.

- [ ] **Step 3: Extend book-service dependency type**

Modify `createBookService` dependencies in `src/core/book-service.ts` to include:

```ts
storyBibles: { saveGraph: (bookId: string, bible: NarrativeBible) => void; getByBook: (bookId: string) => unknown };
volumePlans: { upsertMany: (bookId: string, plans: VolumePlan[]) => void; listByBook: (bookId: string) => VolumePlan[] };
chapterCards: {
  upsertMany: (cards: ChapterCard[]) => void;
  listByBook: (bookId: string) => ChapterCard[];
  getNextUnwritten: (bookId: string) => ChapterCard | null;
  upsertThreadActions: (bookId: string, volumeIndex: number, chapterIndex: number, actions: ChapterThreadAction[]) => void;
  upsertCharacterPressures: (bookId: string, volumeIndex: number, chapterIndex: number, pressures: ChapterCharacterPressure[]) => void;
  upsertRelationshipActions: (bookId: string, volumeIndex: number, chapterIndex: number, actions: ChapterRelationshipAction[]) => void;
};
```

Import types from `src/core/narrative/types.ts`.

- [ ] **Step 4: Persist planning bundle in startBook**

After `outlineBundle` is generated, replace old `saveContext` as source of truth:

```ts
deps.storyBibles.saveGraph(bookId, outlineBundle.narrativeBible);
deps.volumePlans.upsertMany(bookId, outlineBundle.volumePlans);
deps.chapterCards.upsertMany(outlineBundle.chapterCards);

for (const card of outlineBundle.chapterCards) {
  deps.chapters.upsertOutline({
    bookId,
    volumeIndex: card.volumeIndex,
    chapterIndex: card.chapterIndex,
    title: card.title,
    outline: [
      card.plotFunction,
      `必须变化：${card.mustChange}`,
      `读者满足：${card.readerReward}`,
      `章末钩子：${card.endingHook}`,
    ].join('\n'),
  });
}
```

This step still calls `chapters.upsertOutline` until Task 11 rewrites `chapters.ts`. The content should be stored in the compatibility `chapters` table as title-only planned rows.

Persist actions:

```ts
for (const card of outlineBundle.chapterCards) {
  deps.chapterCards.upsertThreadActions(
    bookId,
    card.volumeIndex,
    card.chapterIndex,
    outlineBundle.chapterThreadActions.filter(
      (action) => action.volumeIndex === card.volumeIndex && action.chapterIndex === card.chapterIndex
    )
  );
  deps.chapterCards.upsertCharacterPressures(
    bookId,
    card.volumeIndex,
    card.chapterIndex,
    outlineBundle.chapterCharacterPressures.filter(
      (pressure) => pressure.volumeIndex === card.volumeIndex && pressure.chapterIndex === card.chapterIndex
    )
  );
  deps.chapterCards.upsertRelationshipActions(
    bookId,
    card.volumeIndex,
    card.chapterIndex,
    outlineBundle.chapterRelationshipActions.filter(
      (action) => action.volumeIndex === card.volumeIndex && action.chapterIndex === card.chapterIndex
    )
  );
}
```

- [ ] **Step 5: Run planning persistence test**

Run:

```bash
pnpm exec vitest run tests/core/book-service.test.ts -t "persists narrative bible" --reporter=dot
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/book-service.ts tests/core/book-service.test.ts
git commit -m "feat: persist narrative planning bundle"
```

## Task 11: Chapter Repository Compatibility

**Files:**
- Modify: `src/storage/chapters.ts`
- Modify: `tests/storage/books.test.ts`
- Modify: `tests/storage/export.test.ts`
- Modify: `tests/core/book-service.test.ts`

- [ ] **Step 1: Add failing chapter repository test**

Extend the existing chapter storage tests or add `tests/storage/chapters.test.ts`:

```ts
it('creates planned chapter rows without storing outline in chapters table', () => {
  const repos = openRepositories();
  repos.books.create({
    id: 'book-1',
    title: '新作品',
    idea: '命簿',
    targetChapters: 1,
    wordsPerChapter: 1800,
  });

  repos.chapters.upsertPlanned({
    bookId: 'book-1',
    volumeIndex: 1,
    chapterIndex: 1,
    title: '旧页初鸣',
  });

  expect(repos.chapters.listByBook('book-1')[0]).toMatchObject({
    title: '旧页初鸣',
    content: null,
    auditScore: null,
    draftAttempts: 0,
  });
});
```

- [ ] **Step 2: Run failing chapter test**

Run:

```bash
pnpm exec vitest run tests/storage/chapters.test.ts --reporter=dot
```

Expected: FAIL because `upsertPlanned` and `auditScore` do not exist.

- [ ] **Step 3: Update chapter repository API**

Modify `src/storage/chapters.ts`:

- Replace `upsertOutline` with `upsertPlanned`.
- Keep a temporary `upsertOutline` alias that calls `upsertPlanned` and ignores `outline`, so old tests can be migrated incrementally in this task.
- Update `listByBook` to return `auditScore` and `draftAttempts`.
- Update `saveContent` to accept `auditScore` and increment or set `draftAttempts`.

Implementation shape:

```ts
upsertPlanned(input: {
  bookId: string;
  volumeIndex: number;
  chapterIndex: number;
  title: string;
}) {
  db.prepare(`
    INSERT INTO chapters (book_id, volume_index, chapter_index, title, created_at, updated_at)
    VALUES (@bookId, @volumeIndex, @chapterIndex, @title, datetime('now'), datetime('now'))
    ON CONFLICT(book_id, volume_index, chapter_index) DO UPDATE SET
      title = excluded.title,
      updated_at = datetime('now')
  `).run(input);
}
```

`saveContent`:

```ts
saveContent(input: {
  bookId: string;
  volumeIndex: number;
  chapterIndex: number;
  content: string;
  summary?: string | null;
  wordCount: number;
  auditScore?: number | null;
}) {
  db.prepare(`
    UPDATE chapters
    SET content = @content,
        summary = @summary,
        word_count = @wordCount,
        audit_score = @auditScore,
        draft_attempts = draft_attempts + 1,
        updated_at = datetime('now')
    WHERE book_id = @bookId
      AND volume_index = @volumeIndex
      AND chapter_index = @chapterIndex
  `).run({
    ...input,
    summary: input.summary ?? null,
    auditScore: input.auditScore ?? null,
  });
}
```

- [ ] **Step 4: Update callers from upsertOutline to upsertPlanned**

Modify `src/core/book-service.ts` planning persistence to call:

```ts
deps.chapters.upsertPlanned({
  bookId,
  volumeIndex: card.volumeIndex,
  chapterIndex: card.chapterIndex,
  title: card.title,
});
```

Update the dependency type accordingly.

- [ ] **Step 5: Run storage and service tests**

Run:

```bash
pnpm exec vitest run tests/storage/chapters.test.ts tests/storage/export.test.ts tests/core/book-service.test.ts --reporter=dot
```

Expected: PASS after adjusting tests that expected `outline` on chapter rows to read chapter card data instead.

- [ ] **Step 6: Commit**

```bash
git add src/storage/chapters.ts src/core/book-service.ts tests/storage/chapters.test.ts tests/storage/export.test.ts tests/core/book-service.test.ts
git commit -m "feat: align chapters with narrative cards"
```

## Task 12: Write Chapter Through Audit Loop

**Files:**
- Modify: `src/core/book-service.ts`
- Modify: `tests/core/book-service.test.ts`

- [ ] **Step 1: Add failing audit-loop test**

Extend `tests/core/book-service.test.ts`:

```ts
it('revises a chapter before saving when audit returns revise', async () => {
  const harness = createBookServiceHarness({
    chapterAuditor: {
      async auditChapter() {
        return {
          passed: false,
          score: 70,
          decision: 'revise',
          issues: [
            {
              type: 'world_rule_violation',
              severity: 'major',
              evidence: '没有代价。',
              fixInstruction: '加入记忆损失。',
            },
          ],
          scoring: {
            characterLogic: 15,
            mainlineProgress: 12,
            relationshipChange: 10,
            conflictDepth: 11,
            worldRuleCost: 3,
            threadManagement: 8,
            pacingReward: 7,
            themeAlignment: 4,
          },
          stateUpdates: {
            characterArcUpdates: [],
            relationshipUpdates: [],
            threadUpdates: [],
            worldKnowledgeUpdates: [],
            themeUpdate: '自由需要代价。',
          },
        };
      },
    },
    chapterRevision: {
      async reviseChapter() {
        return '修订正文，林牧失去关于母亲声音的一段记忆。';
      },
    },
  });

  const bookId = await harness.createStartedBookWithOneCard();
  await harness.service.writeNextChapter(bookId);

  const chapter = harness.repositories.chapters.listByBook(bookId)[0];
  expect(chapter.content).toContain('修订正文');
  expect(chapter.auditScore).toBe(70);
  expect(harness.repositories.chapterAudits.listByChapter(bookId, 1, 1)).toHaveLength(1);
});
```

Add a second test:

```ts
it('marks the book needs_review when rewrite still fails after max attempts', async () => {
  const harness = createBookServiceHarness({
    chapterAuditor: {
      async auditChapter() {
        return {
          passed: false,
          score: 40,
          decision: 'rewrite',
          issues: [
            {
              type: 'forbidden_move',
              severity: 'blocker',
              evidence: '提前揭示终局。',
              fixInstruction: '删除终局揭示。',
            },
          ],
          scoring: {
            characterLogic: 5,
            mainlineProgress: 5,
            relationshipChange: 5,
            conflictDepth: 5,
            worldRuleCost: 5,
            threadManagement: 5,
            pacingReward: 5,
            themeAlignment: 5,
          },
          stateUpdates: {
            characterArcUpdates: [],
            relationshipUpdates: [],
            threadUpdates: [],
            worldKnowledgeUpdates: [],
            themeUpdate: '',
          },
        };
      },
    },
  });

  const bookId = await harness.createStartedBookWithOneCard();
  await harness.service.writeNextChapter(bookId);

  expect(harness.repositories.books.getById(bookId)?.status).toBe('needs_review');
});
```

- [ ] **Step 2: Run failing audit-loop tests**

Run:

```bash
pnpm exec vitest run tests/core/book-service.test.ts -t "audit" --reporter=dot
```

Expected: FAIL because `writeNextChapter` saves drafts before audit and has no `needs_review` status handling.

- [ ] **Step 3: Extend dependencies**

Add to `createBookService` deps:

```ts
chapterAuditor: {
  auditChapter: (input: { modelId: string; draft: string; auditContext: string }) => Promise<NarrativeAudit>;
};
chapterRevision: {
  reviseChapter: (input: {
    modelId: string;
    originalPrompt: string;
    draft: string;
    issues: NarrativeAudit['issues'];
  }) => Promise<string>;
};
chapterAudits: {
  save: (input: {
    bookId: string;
    volumeIndex: number;
    chapterIndex: number;
    attempt: number;
    audit: NarrativeAudit;
  }) => void;
};
```

- [ ] **Step 4: Build prompt from chapter card**

In `writeNextChapter`, replace `chapters.find((chapter) => chapter.outline && !chapter.content)` with:

```ts
const nextCard = deps.chapterCards.getNextUnwritten(bookId);
if (!nextCard) throw new Error('No planned chapter card available to write');
```

Build command context with `buildNarrativeCommandContext`, using repository data:

```ts
const commandContext = buildNarrativeCommandContext({
  bible: {
    themeQuestion: fullBible.themeQuestion,
    themeAnswerDirection: fullBible.themeAnswerDirection,
    voiceGuide: fullBible.voiceGuide,
  },
  chapterCard: nextCard,
  hardContinuity,
  characterPressures,
  relationshipActions,
  threadActions,
  worldRules,
  recentSummaries,
  previousChapterEnding,
  maxCharacters: CHAPTER_CONTEXT_MAX_CHARACTERS,
});
```

Then use `buildNarrativeDraftPrompt`.

- [ ] **Step 5: Add audit loop**

Implement this control flow in `writeNextChapter`:

```ts
const maxAttempts = 3;
let attempt = 1;
let draft = await writeDraft(prompt, false);
let finalAudit: NarrativeAudit | null = null;

while (attempt <= maxAttempts) {
  const audit = await deps.chapterAuditor.auditChapter({
    modelId,
    draft,
    auditContext: commandContext,
  });
  finalAudit = audit;
  deps.chapterAudits.save({
    bookId,
    volumeIndex: nextCard.volumeIndex,
    chapterIndex: nextCard.chapterIndex,
    attempt,
    audit,
  });

  if (audit.decision === 'accept') break;

  if (attempt >= maxAttempts) {
    deps.books.updateStatus(bookId, 'needs_review' as BookStatus);
    deps.progress.updatePhase(bookId, 'needs_review', {
      currentVolume: nextCard.volumeIndex,
      currentChapter: nextCard.chapterIndex,
      stepLabel: `第 ${nextCard.chapterIndex} 章需要人工检查`,
    });
    return { needsReview: true as const };
  }

  if (audit.decision === 'revise') {
    draft = await deps.chapterRevision.reviseChapter({
      modelId,
      originalPrompt: prompt,
      draft,
      issues: audit.issues,
    });
  } else {
    draft = (await deps.chapterWriter.writeChapter({ modelId, prompt })).content;
  }

  attempt += 1;
}
```

Save content only after an accepted or final revised draft with accepted audit. Use `finalAudit?.score ?? null` for `auditScore`.

- [ ] **Step 6: Run audit-loop tests**

Run:

```bash
pnpm exec vitest run tests/core/book-service.test.ts -t "audit" --reporter=dot
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/core/book-service.ts tests/core/book-service.test.ts
git commit -m "feat: gate chapter saves with narrative audit"
```

## Task 13: Persist Narrative State After Approved Chapter

**Files:**
- Modify: `src/core/book-service.ts`
- Modify: `tests/core/book-service.test.ts`

- [ ] **Step 1: Add failing state persistence test**

Extend `tests/core/book-service.test.ts`:

```ts
it('persists narrative state deltas after an accepted chapter', async () => {
  const harness = createBookServiceHarness({
    narrativeStateExtractor: {
      async extractState() {
        return {
          characterStates: [
            {
              characterId: 'lin-mu',
              location: '旧祠',
              status: '主动追查',
              knowledge: '命簿吞记忆',
              emotion: '压抑',
              powerLevel: '初醒',
              arcPhase: 'commitment',
              desireState: '更强',
              fearState: '被刺激',
              flawState: '仍想隐瞒',
            },
          ],
          relationshipStates: [
            {
              relationshipId: 'lin-mu-a-zhao',
              trustLevel: 1,
              tensionLevel: 2,
              currentState: '互相试探',
              lastChange: '共同承担风险。',
            },
          ],
          threadUpdates: [
            {
              threadId: 'main-ledger-truth',
              currentState: 'advanced',
              resolvedAt: null,
              notes: '确认旧案和命簿有关。',
            },
          ],
          worldRuleUpdates: [],
          scene: {
            location: '旧祠',
            timeInStory: '第一夜',
            charactersPresent: ['林牧'],
            events: '碎页显名。',
          },
          themeProgression: '自由需要记忆代价。',
        };
      },
    },
  });

  const bookId = await harness.createStartedBookWithOneCard();
  await harness.service.writeNextChapter(bookId);

  expect(harness.repositories.characterArcs.listLatestStatesByBook(bookId)[0].arcPhase).toBe('commitment');
  expect(harness.repositories.relationshipStates.listLatestByBook(bookId)[0].lastChange).toContain('共同承担');
  expect(harness.repositories.narrativeThreads.listByBook(bookId)[0].currentState).toBe('advanced');
  expect(harness.repositories.sceneRecords.getLatestByBook(bookId)?.location).toBe('旧祠');
});
```

- [ ] **Step 2: Run failing state persistence test**

Run:

```bash
pnpm exec vitest run tests/core/book-service.test.ts -t "persists narrative state" --reporter=dot
```

Expected: FAIL because `writeNextChapter` does not call `narrativeStateExtractor`.

- [ ] **Step 3: Extend dependencies**

Add to `createBookService` deps:

```ts
narrativeStateExtractor: {
  extractState: (input: {
    modelId: string;
    chapterIndex: number;
    content: string;
    auditStateUpdates: NarrativeAudit['stateUpdates'];
  }) => Promise<NarrativeStateDelta>;
};
relationshipStates: {
  save: (input: {
    bookId: string;
    relationshipId: string;
    volumeIndex: number;
    chapterIndex: number;
    trustLevel: number;
    tensionLevel: number;
    currentState: string;
    lastChange: string;
  }) => void;
  listLatestByBook: (bookId: string) => Array<unknown>;
};
```

- [ ] **Step 4: Persist extracted state**

After accepted audit and before `chapter-complete` event:

```ts
const stateDelta = await deps.narrativeStateExtractor.extractState({
  modelId,
  chapterIndex: nextCard.chapterIndex,
  content: draft,
  auditStateUpdates: finalAudit.stateUpdates,
});

for (const state of stateDelta.characterStates) {
  deps.characterArcs.saveState({
    bookId,
    characterId: state.characterId,
    volumeIndex: nextCard.volumeIndex,
    chapterIndex: nextCard.chapterIndex,
    location: state.location,
    status: state.status,
    knowledge: state.knowledge,
    emotion: state.emotion,
    powerLevel: state.powerLevel,
    arcPhase: state.arcPhase,
    desireState: state.desireState,
    fearState: state.fearState,
    flawState: state.flawState,
  });
}

for (const state of stateDelta.relationshipStates) {
  deps.relationshipStates.save({
    bookId,
    relationshipId: state.relationshipId,
    volumeIndex: nextCard.volumeIndex,
    chapterIndex: nextCard.chapterIndex,
    trustLevel: state.trustLevel,
    tensionLevel: state.tensionLevel,
    currentState: state.currentState,
    lastChange: state.lastChange,
  });
}

for (const update of stateDelta.threadUpdates) {
  deps.narrativeThreads.updateState({
    bookId,
    threadId: update.threadId,
    currentState: update.currentState,
    resolvedAt: update.resolvedAt,
    notes: update.notes,
  });
}

if (stateDelta.scene) {
  deps.sceneRecords.save({
    bookId,
    volumeIndex: nextCard.volumeIndex,
    chapterIndex: nextCard.chapterIndex,
    location: stateDelta.scene.location,
    timeInStory: stateDelta.scene.timeInStory,
    charactersPresent: stateDelta.scene.charactersPresent,
    events: stateDelta.scene.events,
  });
}
```

Add `narrativeThreads.updateState` to repository if Task 3 did not include it.

- [ ] **Step 5: Run state persistence test**

Run:

```bash
pnpm exec vitest run tests/core/book-service.test.ts -t "persists narrative state" --reporter=dot
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/book-service.ts src/storage/narrative-threads.ts tests/core/book-service.test.ts
git commit -m "feat: persist narrative state after chapters"
```

## Task 14: Checkpoints and Future Card Replanning Hooks

**Files:**
- Create: `src/core/narrative/checkpoint.ts`
- Modify: `src/core/book-service.ts`
- Modify: `src/mock/story-services.ts`
- Test: `tests/core/narrative-checkpoint.test.ts`
- Test: `tests/core/book-service.test.ts`

- [ ] **Step 1: Write failing checkpoint tests**

Create `tests/core/narrative-checkpoint.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { shouldRunNarrativeCheckpoint } from '../../src/core/narrative/checkpoint';

describe('shouldRunNarrativeCheckpoint', () => {
  it('runs arc checkpoint every 10 chapters', () => {
    expect(shouldRunNarrativeCheckpoint(9)).toBe(false);
    expect(shouldRunNarrativeCheckpoint(10)).toBe(true);
    expect(shouldRunNarrativeCheckpoint(20)).toBe(true);
  });
});
```

Extend `tests/core/book-service.test.ts`:

```ts
it('runs a checkpoint after completing chapter 10', async () => {
  const harness = createBookServiceHarness({
    narrativeCheckpoint: {
      async reviewCheckpoint() {
        return {
          checkpointType: 'arc',
          arcReport: { protagonist: '欲望仍清晰。' },
          threadDebt: { critical: [] },
          pacingReport: { readerRewards: '稳定。' },
          replanningNotes: '后续章节无需调整。',
        };
      },
    },
  });

  const bookId = await harness.createStartedBookWithCards(10);
  await harness.service.writeRemainingChapters(bookId);

  expect(harness.repositories.narrativeCheckpoints.listByBook(bookId)).toHaveLength(1);
});
```

- [ ] **Step 2: Run failing checkpoint tests**

Run:

```bash
pnpm exec vitest run tests/core/narrative-checkpoint.test.ts tests/core/book-service.test.ts -t "checkpoint|chapter 10" --reporter=dot
```

Expected: FAIL because checkpoint helpers and service dependency do not exist.

- [ ] **Step 3: Implement checkpoint helper**

Create `src/core/narrative/checkpoint.ts`:

```ts
export function shouldRunNarrativeCheckpoint(chapterIndex: number) {
  return chapterIndex > 0 && chapterIndex % 10 === 0;
}
```

- [ ] **Step 4: Add checkpoint dependency and persistence**

Add service dependency:

```ts
narrativeCheckpoint?: {
  reviewCheckpoint: (input: { bookId: string; chapterIndex: number }) => Promise<{
    checkpointType: string;
    arcReport: unknown;
    threadDebt: unknown;
    pacingReport: unknown;
    replanningNotes: string | null;
  }>;
};
narrativeCheckpoints: {
  save: (input: {
    bookId: string;
    checkpointType: string;
    chapterIndex: number;
    arcReport: unknown;
    threadDebt: unknown;
    pacingReport: unknown;
    replanningNotes: string | null;
  }) => void;
};
```

After a chapter completes:

```ts
if (deps.narrativeCheckpoint && shouldRunNarrativeCheckpoint(nextCard.chapterIndex)) {
  deps.progress.updatePhase(bookId, 'checkpoint_review', {
    currentVolume: nextCard.volumeIndex,
    currentChapter: nextCard.chapterIndex,
    stepLabel: `正在复盘第 ${nextCard.chapterIndex} 章叙事状态`,
  });
  const checkpoint = await deps.narrativeCheckpoint.reviewCheckpoint({
    bookId,
    chapterIndex: nextCard.chapterIndex,
  });
  deps.narrativeCheckpoints.save({
    bookId,
    chapterIndex: nextCard.chapterIndex,
    ...checkpoint,
  });
}
```

- [ ] **Step 5: Run checkpoint tests**

Run:

```bash
pnpm exec vitest run tests/core/narrative-checkpoint.test.ts tests/core/book-service.test.ts -t "checkpoint|chapter 10" --reporter=dot
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/narrative/checkpoint.ts src/core/book-service.ts src/mock/story-services.ts tests/core/narrative-checkpoint.test.ts tests/core/book-service.test.ts
git commit -m "feat: add narrative checkpoints"
```

## Task 15: Renderer and Contract Compatibility

**Files:**
- Modify: `src/shared/contracts.ts`
- Modify: `src/core/book-service.ts`
- Modify: `renderer/pages/BookDetail.tsx`
- Modify: `renderer/components/ChapterList.tsx`
- Test: `tests/core/ipc-contracts.test.ts`
- Test: `tests/renderer/book-detail.test.tsx`
- Test: `tests/renderer/chapter-list.test.tsx`

- [ ] **Step 1: Add failing contract and renderer tests**

Extend `tests/core/ipc-contracts.test.ts`:

```ts
it('book detail supports narrative records while retaining existing display fields', () => {
  const detail = makeBookDetailContractFixture();

  expect(detail.context?.worldSetting).toEqual(expect.any(String));
  expect(detail.context?.outline).toEqual(expect.any(String));
  expect(detail.narrative?.storyBible?.themeQuestion).toEqual(expect.any(String));
  expect(Array.isArray(detail.narrative?.chapterCards)).toBe(true);
});
```

Extend `tests/renderer/chapter-list.test.tsx`:

```ts
it('shows audit score when a chapter has been audited', () => {
  render(
    <ChapterList
      chapters={[
        {
          bookId: 'book-1',
          volumeIndex: 1,
          chapterIndex: 1,
          title: '旧页初鸣',
          outline: '必须变化：主动追查。',
          content: '正文',
          summary: '林牧开始追查。',
          wordCount: 1200,
          auditScore: 88,
          draftAttempts: 1,
        },
      ]}
      activeChapterKey={null}
      onSelectChapter={() => {}}
    />
  );

  expect(screen.getByText(/审计 88/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run failing compatibility tests**

Run:

```bash
pnpm exec vitest run tests/core/ipc-contracts.test.ts tests/renderer/chapter-list.test.tsx --reporter=dot
```

Expected: FAIL because contracts and chapter list do not expose audit score.

- [ ] **Step 3: Extend contracts**

Modify `src/shared/contracts.ts`:

```ts
export type BookDetail = {
  book: BookRecord;
  context: {
    bookId: string;
    worldSetting: string | null;
    outline: string | null;
    styleGuide: string | null;
  } | null;
  narrative?: {
    storyBible: {
      themeQuestion: string;
      themeAnswerDirection: string;
      centralDramaticQuestion: string;
    } | null;
    chapterCards: Array<{
      volumeIndex: number;
      chapterIndex: number;
      mustChange: string;
      readerReward: string;
      endingHook: string;
    }>;
  };
  chapters: Array<ChapterRecord & { auditScore?: number | null; draftAttempts?: number }>;
  characterStates: unknown[];
  plotThreads: unknown[];
  latestScene: unknown;
  progress: unknown;
};
```

Keep the existing field names and merge the optional `narrative` field into the current type rather than replacing the type wholesale.

- [ ] **Step 4: Map structured data in getBookDetail**

Modify `book-service.getBookDetail` to return legacy context strings rendered from `storyBibles`, `worldRules`, `volumePlans`, and `chapterCards`:

```ts
const bible = deps.storyBibles.getByBook(bookId);
const worldRules = deps.worldRules.listByBook(bookId);
const volumePlans = deps.volumePlans.listByBook(bookId);
const chapterCards = deps.chapterCards.listByBook(bookId);

const context = bible
  ? {
      bookId,
      worldSetting: [
        `主题问题：${bible.themeQuestion}`,
        `主题方向：${bible.themeAnswerDirection}`,
        ...worldRules.map((rule) => `${rule.id}: ${rule.ruleText}; 代价：${rule.cost}`),
      ].join('\n'),
      outline: volumePlans
        .map((volume) => `第${volume.volumeIndex}卷 ${volume.title}: ${volume.chapterStart}-${volume.chapterEnd}; ${volume.promisedPayoff}`)
        .join('\n'),
      styleGuide: bible.voiceGuide,
    }
  : null;
```

Merge chapter card outline back onto chapter rows for existing UI:

```ts
const chapters = deps.chapters.listByBook(bookId).map((chapter) => {
  const card = chapterCards.find(
    (candidate) =>
      candidate.volumeIndex === chapter.volumeIndex &&
      candidate.chapterIndex === chapter.chapterIndex
  );
  return {
    ...chapter,
    outline: card
      ? [`必须变化：${card.mustChange}`, `读者满足：${card.readerReward}`, `章末钩子：${card.endingHook}`].join('\n')
      : null,
  };
});
```

- [ ] **Step 5: Render audit score**

Modify `renderer/components/ChapterList.tsx` to show `审计 ${chapter.auditScore}` only when `auditScore` is a number.

- [ ] **Step 6: Run compatibility tests**

Run:

```bash
pnpm exec vitest run tests/core/ipc-contracts.test.ts tests/renderer/book-detail.test.tsx tests/renderer/chapter-list.test.tsx --reporter=dot
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/shared/contracts.ts src/core/book-service.ts renderer/pages/BookDetail.tsx renderer/components/ChapterList.tsx tests/core/ipc-contracts.test.ts tests/renderer/book-detail.test.tsx tests/renderer/chapter-list.test.tsx
git commit -m "feat: expose narrative data compatibly"
```

## Task 16: Runtime Wiring and Full Regression

**Files:**
- Modify: `electron/runtime.ts`
- Modify: `tests/electron/runtime-mock-fallback.test.ts`
- Modify: `tests/core/engine.test.ts`
- Modify: `tests/core/scheduler.test.ts`

- [ ] **Step 1: Add failing runtime wiring test**

Extend `tests/electron/runtime-mock-fallback.test.ts`:

```ts
it('wires narrative audit services in mock fallback runtime', async () => {
  const runtime = await createTestRuntimeWithMockFallback();
  const services = runtime.getStoryServices();

  expect(services.chapterAuditor).toBeDefined();
  expect(services.chapterRevision).toBeDefined();
  expect(services.narrativeStateExtractor).toBeDefined();
});
```

- [ ] **Step 2: Run failing runtime test**

Run:

```bash
pnpm exec vitest run tests/electron/runtime-mock-fallback.test.ts --reporter=dot
```

Expected: FAIL because runtime wiring does not pass new narrative services into `createBookService`.

- [ ] **Step 3: Wire real and mock services**

Modify `electron/runtime.ts`:

- When constructing real AI services, add `createAiChapterAuditor`, `createAiChapterRevisionService`, and `createAiNarrativeStateExtractor`.
- When using mock fallback, pass `mockServices.chapterAuditor`, `mockServices.chapterRevision`, and `mockServices.narrativeStateExtractor`.
- Pass new repositories from `createRepositories(db)` into `createBookService`.

Required dependency additions:

```ts
chapterAuditor,
chapterRevision,
narrativeStateExtractor,
storyBibles: repositories.storyBibles,
characterArcs: repositories.characterArcs,
relationshipEdges: repositories.relationshipEdges,
relationshipStates: repositories.relationshipStates,
worldRules: repositories.worldRules,
narrativeThreads: repositories.narrativeThreads,
volumePlans: repositories.volumePlans,
chapterCards: repositories.chapterCards,
chapterAudits: repositories.chapterAudits,
narrativeCheckpoints: repositories.narrativeCheckpoints,
```

- [ ] **Step 4: Run targeted runtime and engine tests**

Run:

```bash
pnpm exec vitest run tests/electron/runtime-mock-fallback.test.ts tests/core/engine.test.ts tests/core/scheduler.test.ts --reporter=dot
```

Expected: PASS.

- [ ] **Step 5: Run typecheck**

Run:

```bash
pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Run full test suite**

Run:

```bash
pnpm run test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add electron/runtime.ts tests/electron/runtime-mock-fallback.test.ts tests/core/engine.test.ts tests/core/scheduler.test.ts
git commit -m "feat: wire narrative control runtime"
```

## Implementation Notes

- Keep commits task-sized. If a task becomes too wide while implementing, split it after tests define a smaller passing boundary.
- Use real SQLite repositories in service tests when practical; they catch schema and serialization bugs faster than handwritten fakes.
- Do not save a chapter draft before audit. If a test needs to inspect a rejected draft, inspect the audit record or emitted stream event instead.
- Keep old renderer-friendly fields populated from structured data until there is a dedicated UI redesign.
- JSON fields must round-trip with `JSON.stringify` and `JSON.parse`; malformed stored JSON should return a safe empty array or null and be covered by a repository test.

## Plan Self-Review

- Spec coverage: The plan covers schema replacement, narrative bible, character arcs, relationship edges, world rules, narrative threads, volume plans, chapter cards, command context, audit, revision, state extraction, checkpoint review, mock services, runtime wiring, and renderer compatibility.
- Scope boundary: Dedicated graph UI and rich visualization are excluded, matching the spec non-goals.
- Placeholder scan: The plan avoids unfinished markers and gives concrete file paths, commands, and expected outcomes.
- Type consistency: Later tasks use `NarrativeBible`, `ChapterCard`, `NarrativeAudit`, and `NarrativeStateDelta` introduced in earlier tasks.
