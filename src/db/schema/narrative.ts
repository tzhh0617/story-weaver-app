import { sql } from 'drizzle-orm';
import {
  primaryKey,
  sqliteTable,
  text,
  integer,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { books } from './books.js';

export const titleIdeaContracts = sqliteTable('title_idea_contracts', {
  bookId: text('book_id')
    .primaryKey()
    .references(() => books.id),
  title: text('title').notNull(),
  idea: text('idea').notNull(),
  corePromise: text('core_promise').notNull(),
  titleHooksJson: text('title_hooks_json').notNull().default('[]'),
  forbiddenDriftJson: text('forbidden_drift_json').notNull().default('[]'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const endgamePlans = sqliteTable('endgame_plans', {
  bookId: text('book_id')
    .primaryKey()
    .references(() => books.id),
  titleIdeaContract: text('title_idea_contract').notNull(),
  protagonistEndState: text('protagonist_end_state').notNull(),
  finalConflict: text('final_conflict').notNull(),
  finalOpponent: text('final_opponent').notNull(),
  worldEndState: text('world_end_state').notNull(),
  coreCharacterOutcomesJson: text('core_character_outcomes_json').notNull(),
  majorPayoffsJson: text('major_payoffs_json').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const stagePlans = sqliteTable(
  'stage_plans',
  {
    bookId: text('book_id')
      .notNull()
      .references(() => books.id),
    stageIndex: integer('stage_index').notNull(),
    chapterStart: integer('chapter_start').notNull(),
    chapterEnd: integer('chapter_end').notNull(),
    chapterBudget: integer('chapter_budget').notNull(),
    objective: text('objective').notNull(),
    primaryResistance: text('primary_resistance').notNull(),
    pressureCurve: text('pressure_curve').notNull(),
    escalation: text('escalation').notNull(),
    climax: text('climax').notNull(),
    payoff: text('payoff').notNull(),
    irreversibleChange: text('irreversible_change').notNull(),
    nextQuestion: text('next_question').notNull(),
    titleIdeaFocus: text('title_idea_focus').notNull(),
    compressionTrigger: text('compression_trigger').notNull(),
    status: text('status').notNull().default('planned'),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.bookId, table.stageIndex],
    }),
  })
);

export const characterArcs = sqliteTable('character_arcs', {
  id: text('id').primaryKey(),
  bookId: text('book_id')
    .notNull()
    .references(() => books.id),
  name: text('name').notNull(),
  roleType: text('role_type').notNull(),
  desire: text('desire').notNull(),
  fear: text('fear').notNull(),
  flaw: text('flaw').notNull(),
  misbelief: text('misbelief').notNull(),
  wound: text('wound'),
  externalGoal: text('external_goal').notNull(),
  internalNeed: text('internal_need').notNull(),
  arcDirection: text('arc_direction').notNull(),
  decisionLogic: text('decision_logic').notNull(),
  lineWillNotCross: text('line_will_not_cross'),
  lineMayEventuallyCross: text('line_may_eventually_cross'),
  currentArcPhase: text('current_arc_phase').notNull(),
});

export const characterStates = sqliteTable(
  'character_states',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    bookId: text('book_id').notNull(),
    characterId: text('character_id').notNull(),
    characterName: text('character_name').notNull(),
    volumeIndex: integer('volume_index').notNull(),
    chapterIndex: integer('chapter_index').notNull(),
    location: text('location'),
    status: text('status'),
    knowledge: text('knowledge'),
    emotion: text('emotion'),
    powerLevel: text('power_level'),
    arcPhase: text('arc_phase'),
  },
  (table) => ({
    uniqueProgress: uniqueIndex('character_states_book_character_volume_chapter_idx').on(
      table.bookId,
      table.characterId,
      table.volumeIndex,
      table.chapterIndex
    ),
  })
);

export const relationshipEdges = sqliteTable('relationship_edges', {
  id: text('id').primaryKey(),
  bookId: text('book_id')
    .notNull()
    .references(() => books.id),
  fromCharacterId: text('from_character_id').notNull(),
  toCharacterId: text('to_character_id').notNull(),
  visibleLabel: text('visible_label').notNull(),
  hiddenTruth: text('hidden_truth'),
  dependency: text('dependency'),
  debt: text('debt'),
  misunderstanding: text('misunderstanding'),
  affection: text('affection'),
  harmPattern: text('harm_pattern'),
  sharedGoal: text('shared_goal'),
  valueConflict: text('value_conflict'),
  trustLevel: integer('trust_level').notNull(),
  tensionLevel: integer('tension_level').notNull(),
  currentState: text('current_state').notNull(),
  plannedTurnsJson: text('planned_turns_json').notNull().default('[]'),
});

export const relationshipStates = sqliteTable(
  'relationship_states',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    bookId: text('book_id').notNull(),
    relationshipId: text('relationship_id').notNull(),
    volumeIndex: integer('volume_index').notNull(),
    chapterIndex: integer('chapter_index').notNull(),
    trustLevel: integer('trust_level').notNull(),
    tensionLevel: integer('tension_level').notNull(),
    currentState: text('current_state').notNull(),
    changeSummary: text('change_summary'),
  },
  (table) => ({
    uniqueProgress: uniqueIndex('relationship_states_book_relationship_volume_chapter_idx').on(
      table.bookId,
      table.relationshipId,
      table.volumeIndex,
      table.chapterIndex
    ),
  })
);

export const worldRules = sqliteTable('world_rules', {
  id: text('id').primaryKey(),
  bookId: text('book_id')
    .notNull()
    .references(() => books.id),
  category: text('category').notNull(),
  ruleText: text('rule_text').notNull(),
  cost: text('cost').notNull(),
  whoBenefits: text('who_benefits'),
  whoSuffers: text('who_suffers'),
  taboo: text('taboo'),
  violationConsequence: text('violation_consequence'),
  allowedException: text('allowed_exception'),
  currentStatus: text('current_status').notNull(),
});

export const narrativeThreads = sqliteTable('narrative_threads', {
  id: text('id').primaryKey(),
  bookId: text('book_id')
    .notNull()
    .references(() => books.id),
  type: text('type').notNull(),
  promise: text('promise').notNull(),
  plantedAt: integer('planted_at').notNull(),
  expectedPayoff: integer('expected_payoff'),
  resolvedAt: integer('resolved_at'),
  currentState: text('current_state').notNull(),
  importance: text('importance').notNull(),
  payoffMustChange: text('payoff_must_change').notNull(),
  ownerCharacterId: text('owner_character_id'),
  relatedRelationshipId: text('related_relationship_id'),
  notes: text('notes'),
});

export const arcPlans = sqliteTable(
  'arc_plans',
  {
    bookId: text('book_id')
      .notNull()
      .references(() => books.id),
    arcIndex: integer('arc_index').notNull(),
    stageIndex: integer('stage_index').notNull(),
    chapterStart: integer('chapter_start').notNull(),
    chapterEnd: integer('chapter_end').notNull(),
    chapterBudget: integer('chapter_budget').notNull(),
    primaryThreadsJson: text('primary_threads_json').notNull(),
    characterTurnsJson: text('character_turns_json').notNull(),
    threadActionsJson: text('thread_actions_json').notNull(),
    targetOutcome: text('target_outcome').notNull(),
    escalationMode: text('escalation_mode').notNull(),
    turningPoint: text('turning_point').notNull(),
    requiredPayoff: text('required_payoff').notNull(),
    resultingInstability: text('resulting_instability').notNull(),
    titleIdeaFocus: text('title_idea_focus').notNull(),
    minChapterCount: integer('min_chapter_count').notNull(),
    maxChapterCount: integer('max_chapter_count').notNull(),
    status: text('status').notNull().default('planned'),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.bookId, table.arcIndex],
    }),
  })
);

export const chapterPlans = sqliteTable(
  'chapter_plans',
  {
    bookId: text('book_id')
      .notNull()
      .references(() => books.id),
    batchIndex: integer('batch_index').notNull(),
    chapterIndex: integer('chapter_index').notNull(),
    arcIndex: integer('arc_index').notNull(),
    goal: text('goal').notNull(),
    conflict: text('conflict').notNull(),
    pressureSource: text('pressure_source').notNull(),
    changeType: text('change_type').notNull(),
    threadActionsJson: text('thread_actions_json').notNull(),
    reveal: text('reveal').notNull(),
    payoffOrCost: text('payoff_or_cost').notNull(),
    endingHook: text('ending_hook').notNull(),
    titleIdeaLink: text('title_idea_link').notNull(),
    batchGoal: text('batch_goal').notNull(),
    requiredPayoffsJson: text('required_payoffs_json').notNull(),
    forbiddenDriftJson: text('forbidden_drift_json').notNull(),
    status: text('status').notNull().default('planned'),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.bookId, table.chapterIndex],
    }),
  })
);

export const storyStateSnapshots = sqliteTable(
  'story_state_snapshots',
  {
    bookId: text('book_id')
      .notNull()
      .references(() => books.id),
    chapterIndex: integer('chapter_index').notNull(),
    summary: text('summary').notNull(),
    titleIdeaAlignment: text('title_idea_alignment').notNull(),
    flatnessRisk: text('flatness_risk').notNull(),
    characterChangesJson: text('character_changes_json').notNull(),
    relationshipChangesJson: text('relationship_changes_json').notNull(),
    worldFactsJson: text('world_facts_json').notNull(),
    threadUpdatesJson: text('thread_updates_json').notNull(),
    unresolvedPromisesJson: text('unresolved_promises_json').notNull(),
    stageProgress: text('stage_progress').notNull(),
    remainingChapterBudget: integer('remaining_chapter_budget').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.bookId, table.chapterIndex],
    }),
  })
);

export const chapterThreadActions = sqliteTable(
  'chapter_thread_actions',
  {
    bookId: text('book_id')
      .notNull()
      .references(() => books.id),
    volumeIndex: integer('volume_index').notNull(),
    chapterIndex: integer('chapter_index').notNull(),
    threadId: text('thread_id').notNull(),
    action: text('action').notNull(),
    requiredEffect: text('required_effect').notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [
        table.bookId,
        table.volumeIndex,
        table.chapterIndex,
        table.threadId,
        table.action,
      ],
    }),
  })
);

export const chapterCharacterPressures = sqliteTable(
  'chapter_character_pressures',
  {
    bookId: text('book_id')
      .notNull()
      .references(() => books.id),
    volumeIndex: integer('volume_index').notNull(),
    chapterIndex: integer('chapter_index').notNull(),
    characterId: text('character_id').notNull(),
    desirePressure: text('desire_pressure').notNull(),
    fearPressure: text('fear_pressure').notNull(),
    flawTrigger: text('flaw_trigger').notNull(),
    expectedChoice: text('expected_choice').notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.bookId, table.volumeIndex, table.chapterIndex, table.characterId],
    }),
  })
);

export const chapterRelationshipActions = sqliteTable(
  'chapter_relationship_actions',
  {
    bookId: text('book_id')
      .notNull()
      .references(() => books.id),
    volumeIndex: integer('volume_index').notNull(),
    chapterIndex: integer('chapter_index').notNull(),
    relationshipId: text('relationship_id').notNull(),
    action: text('action').notNull(),
    requiredChange: text('required_change').notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [
        table.bookId,
        table.volumeIndex,
        table.chapterIndex,
        table.relationshipId,
        table.action,
      ],
    }),
  })
);

export const chapterTensionBudgets = sqliteTable(
  'chapter_tension_budgets',
  {
    bookId: text('book_id')
      .notNull()
      .references(() => books.id),
    volumeIndex: integer('volume_index').notNull(),
    chapterIndex: integer('chapter_index').notNull(),
    pressureLevel: text('pressure_level').notNull(),
    dominantTension: text('dominant_tension').notNull(),
    requiredTurn: text('required_turn').notNull(),
    forcedChoice: text('forced_choice').notNull(),
    costToPay: text('cost_to_pay').notNull(),
    irreversibleChange: text('irreversible_change').notNull(),
    readerQuestion: text('reader_question').notNull(),
    hookPressure: text('hook_pressure').notNull(),
    flatnessRisksJson: text('flatness_risks_json').notNull(),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.bookId, table.volumeIndex, table.chapterIndex],
    }),
  })
);

export const chapters = sqliteTable(
  'chapters',
  {
    bookId: text('book_id')
      .notNull()
      .references(() => books.id),
    volumeIndex: integer('volume_index').notNull(),
    chapterIndex: integer('chapter_index').notNull(),
    title: text('title').notNull(),
    content: text('content'),
    summary: text('summary'),
    wordCount: integer('word_count').notNull().default(0),
    auditScore: integer('audit_score'),
    draftAttempts: integer('draft_attempts').notNull().default(0),
    createdAt: text('created_at'),
    updatedAt: text('updated_at'),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.bookId, table.volumeIndex, table.chapterIndex],
    }),
  })
);

export const chapterGenerationAudits = sqliteTable('chapter_generation_audits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  bookId: text('book_id')
    .notNull()
    .references(() => books.id),
  volumeIndex: integer('volume_index').notNull(),
  chapterIndex: integer('chapter_index').notNull(),
  attempt: integer('attempt').notNull(),
  passed: integer('passed').notNull(),
  score: integer('score').notNull(),
  decision: text('decision').notNull(),
  issuesJson: text('issues_json').notNull(),
  scoringJson: text('scoring_json').notNull(),
  stateUpdatesJson: text('state_updates_json').notNull(),
  createdAt: text('created_at').notNull(),
});

export const narrativeCheckpoints = sqliteTable('narrative_checkpoints', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  bookId: text('book_id')
    .notNull()
    .references(() => books.id),
  chapterIndex: integer('chapter_index').notNull(),
  reportJson: text('report_json').notNull(),
  futureCardRevisionsJson: text('future_card_revisions_json').notNull().default('[]'),
  createdAt: text('created_at').notNull(),
});

export const sceneRecords = sqliteTable('scene_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  bookId: text('book_id')
    .notNull()
    .references(() => books.id),
  volumeIndex: integer('volume_index').notNull(),
  chapterIndex: integer('chapter_index').notNull(),
  location: text('location').notNull(),
  timeInStory: text('time_in_story').notNull(),
  charactersPresent: text('characters_present').notNull(),
  events: text('events'),
});

export const characters = sqliteTable('characters', {
  id: text('id').primaryKey(),
  bookId: text('book_id')
    .notNull()
    .references(() => books.id),
  name: text('name').notNull(),
  roleType: text('role_type').notNull(),
  personality: text('personality').notNull(),
  speechStyle: text('speech_style'),
  appearance: text('appearance'),
  abilities: text('abilities'),
  background: text('background'),
  relationships: text('relationships'),
  firstAppear: integer('first_appear'),
  isActive: integer('is_active').notNull().default(1),
});

export const plotThreads = sqliteTable('plot_threads', {
  id: text('id').primaryKey(),
  bookId: text('book_id')
    .notNull()
    .references(() => books.id),
  description: text('description').notNull(),
  plantedAt: integer('planted_at').notNull(),
  expectedPayoff: integer('expected_payoff'),
  resolvedAt: integer('resolved_at'),
  importance: text('importance').notNull().default('normal'),
});
