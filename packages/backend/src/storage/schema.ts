import { integer, primaryKey, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

export const books = sqliteTable('books', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  idea: text('idea').notNull(),
  status: text('status').notNull().default('creating'),
  modelId: text('model_id').notNull(),
  targetChapters: integer('target_chapters').notNull(),
  wordsPerChapter: integer('words_per_chapter').notNull(),
  viralStrategyJson: text('viral_strategy_json'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const bookContext = sqliteTable('book_context', {
  bookId: text('book_id').primaryKey(),
  worldSetting: text('world_setting'),
  outline: text('outline'),
  styleGuide: text('style_guide'),
});

export const storyBibles = sqliteTable('story_bibles', {
  bookId: text('book_id').primaryKey(),
  premise: text('premise').notNull(),
  genreContract: text('genre_contract').notNull(),
  targetReaderExperience: text('target_reader_experience').notNull(),
  themeQuestion: text('theme_question').notNull(),
  themeAnswerDirection: text('theme_answer_direction').notNull(),
  centralDramaticQuestion: text('central_dramatic_question').notNull(),
  endingStateJson: text('ending_state_json').notNull(),
  voiceGuide: text('voice_guide').notNull(),
  viralProtocolJson: text('viral_protocol_json'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const chapters = sqliteTable(
  'chapters',
  {
    bookId: text('book_id').notNull(),
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

export const characterArcs = sqliteTable('character_arcs', {
  id: text('id').primaryKey(),
  bookId: text('book_id').notNull(),
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
    uniq: unique().on(
      table.bookId,
      table.characterId,
      table.volumeIndex,
      table.chapterIndex
    ),
  })
);

export const relationshipEdges = sqliteTable('relationship_edges', {
  id: text('id').primaryKey(),
  bookId: text('book_id').notNull(),
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
    uniq: unique().on(
      table.bookId,
      table.relationshipId,
      table.volumeIndex,
      table.chapterIndex
    ),
  })
);

export const worldRules = sqliteTable('world_rules', {
  id: text('id').primaryKey(),
  bookId: text('book_id').notNull(),
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
  bookId: text('book_id').notNull(),
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

export const volumePlans = sqliteTable(
  'volume_plans',
  {
    bookId: text('book_id').notNull(),
    volumeIndex: integer('volume_index').notNull(),
    title: text('title').notNull(),
    chapterStart: integer('chapter_start').notNull(),
    chapterEnd: integer('chapter_end').notNull(),
    roleInStory: text('role_in_story').notNull(),
    mainPressure: text('main_pressure').notNull(),
    promisedPayoff: text('promised_payoff').notNull(),
    characterArcMovement: text('character_arc_movement').notNull(),
    relationshipMovement: text('relationship_movement').notNull(),
    worldExpansion: text('world_expansion').notNull(),
    endingTurn: text('ending_turn').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.bookId, table.volumeIndex] }),
  })
);

export const chapterCards = sqliteTable(
  'chapter_cards',
  {
    bookId: text('book_id').notNull(),
    volumeIndex: integer('volume_index').notNull(),
    chapterIndex: integer('chapter_index').notNull(),
    title: text('title').notNull(),
    plotFunction: text('plot_function').notNull(),
    povCharacterId: text('pov_character_id'),
    externalConflict: text('external_conflict').notNull(),
    internalConflict: text('internal_conflict').notNull(),
    relationshipChange: text('relationship_change').notNull(),
    worldRuleUsedOrTested: text('world_rule_used_or_tested').notNull(),
    informationReveal: text('information_reveal').notNull(),
    readerReward: text('reader_reward').notNull(),
    endingHook: text('ending_hook').notNull(),
    mustChange: text('must_change').notNull(),
    forbiddenMovesJson: text('forbidden_moves_json').notNull().default('[]'),
    status: text('status').notNull().default('planned'),
    revision: integer('revision').notNull().default(0),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.bookId, table.volumeIndex, table.chapterIndex],
    }),
  })
);

export const chapterThreadActions = sqliteTable(
  'chapter_thread_actions',
  {
    bookId: text('book_id').notNull(),
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
    bookId: text('book_id').notNull(),
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
      columns: [
        table.bookId,
        table.volumeIndex,
        table.chapterIndex,
        table.characterId,
      ],
    }),
  })
);

export const chapterRelationshipActions = sqliteTable(
  'chapter_relationship_actions',
  {
    bookId: text('book_id').notNull(),
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
    bookId: text('book_id').notNull(),
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
    createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
    updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.bookId, table.volumeIndex, table.chapterIndex],
    }),
  })
);

export const chapterGenerationAudits = sqliteTable('chapter_generation_audits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  bookId: text('book_id').notNull(),
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
  bookId: text('book_id').notNull(),
  chapterIndex: integer('chapter_index').notNull(),
  reportJson: text('report_json').notNull(),
  futureCardRevisionsJson: text('future_card_revisions_json')
    .notNull()
    .default('[]'),
  createdAt: text('created_at').notNull(),
});

export const sceneRecords = sqliteTable('scene_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  bookId: text('book_id').notNull(),
  volumeIndex: integer('volume_index').notNull(),
  chapterIndex: integer('chapter_index').notNull(),
  location: text('location').notNull(),
  timeInStory: text('time_in_story').notNull(),
  charactersPresent: text('characters_present').notNull(),
  events: text('events'),
});

export const writingProgress = sqliteTable('writing_progress', {
  bookId: text('book_id').primaryKey(),
  currentVolume: integer('current_volume'),
  currentChapter: integer('current_chapter'),
  phase: text('phase'),
  stepLabel: text('step_label'),
  retryCount: integer('retry_count').notNull().default(0),
  errorMsg: text('error_msg'),
});

export const apiLogs = sqliteTable('api_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  bookId: text('book_id'),
  modelId: text('model_id'),
  phase: text('phase'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  durationMs: integer('duration_ms'),
  createdAt: text('created_at').notNull(),
});

export const modelConfigs = sqliteTable('model_configs', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  modelName: text('model_name').notNull(),
  apiKey: text('api_key'),
  baseUrl: text('base_url'),
  isActive: integer('is_active').notNull().default(1),
  configJson: text('config_json').notNull(),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const characters = sqliteTable('characters', {
  id: text('id').primaryKey(),
  bookId: text('book_id').notNull(),
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
  bookId: text('book_id').notNull(),
  description: text('description').notNull(),
  plantedAt: integer('planted_at').notNull(),
  expectedPayoff: integer('expected_payoff'),
  resolvedAt: integer('resolved_at'),
  importance: text('importance').notNull().default('normal'),
});

export const worldSettings = sqliteTable(
  'world_settings',
  {
    bookId: text('book_id').notNull(),
    category: text('category').notNull(),
    key: text('key').notNull(),
    content: text('content').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.bookId, table.category, table.key] }),
  })
);
