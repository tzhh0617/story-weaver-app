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

export type ViralTargetEmotion =
  | 'comeback'
  | 'revenge'
  | 'survival'
  | 'wonder'
  | 'romantic_tension'
  | 'power_climb'
  | 'mystery_breakthrough'
  | 'being_chosen'
  | 'moral_pressure';

export type ViralTropeContract =
  | 'rebirth_change_fate'
  | 'system_growth'
  | 'hidden_identity'
  | 'revenge_payback'
  | 'weak_to_strong'
  | 'forbidden_bond'
  | 'case_breaking'
  | 'sect_or_family_pressure'
  | 'survival_game'
  | 'business_or_power_game';

export type ViralPayoffType =
  | 'face_slap'
  | 'upgrade'
  | 'truth_reveal'
  | 'relationship_shift'
  | 'resource_gain'
  | 'local_victory'
  | 'identity_reveal'
  | 'enemy_setback';

export type ViralPayoffCadence = {
  mode: 'fast' | 'steady' | 'slow_burn' | 'suppressed_then_burst';
  minorPayoffEveryChapters: number;
  majorPayoffEveryChapters: number;
  payoffTypes: ViralPayoffType[];
};

export type ViralStoryProtocol = {
  readerPromise: string;
  targetEmotion: ViralTargetEmotion;
  coreDesire: string;
  protagonistDrive: string;
  hookEngine: string;
  payoffCadence: ViralPayoffCadence;
  tropeContract: ViralTropeContract[];
  antiClicheRules: string[];
  longTermQuestion: string;
};

export type ViralStrategyInput = {
  readerPayoff?: string;
  protagonistDesire?: string;
  tropeContracts?: ViralTropeContract[];
  cadenceMode?: ViralPayoffCadence['mode'];
  antiClicheDirection?: string;
};

export type ViralScoring = {
  openingHook: number;
  desireClarity: number;
  payoffStrength: number;
  readerQuestionStrength: number;
  tropeFulfillment: number;
  antiClicheFreshness: number;
};

export type ThreadAction = 'plant' | 'advance' | 'misdirect' | 'payoff';
export type RelationshipAction =
  | 'strain'
  | 'repair'
  | 'betray'
  | 'reveal'
  | 'deepen'
  | 'reverse';

export type TensionPressureLevel = 'low' | 'medium' | 'high' | 'peak';

export type DominantTension =
  | 'danger'
  | 'desire'
  | 'relationship'
  | 'mystery'
  | 'moral_choice'
  | 'deadline'
  | 'status_loss'
  | 'resource_cost';

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
  | 'missing_reader_reward'
  | 'flat_chapter'
  | 'weak_choice_pressure'
  | 'missing_consequence'
  | 'soft_hook'
  | 'repeated_tension_pattern'
  | 'weak_reader_promise'
  | 'unclear_desire'
  | 'missing_payoff'
  | 'payoff_without_cost'
  | 'generic_trope'
  | 'weak_reader_question'
  | 'stale_hook_engine';

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
  viralStoryProtocol?: ViralStoryProtocol;
};

export type PlanningTaskType =
  | 'book:plan:title-idea'
  | 'book:plan:endgame'
  | 'book:plan:stage'
  | 'book:plan:arc'
  | 'book:plan:chapters'
  | 'book:plan:rebuild-chapters'
  | 'book:state:snapshot';

export type PlanStatus = 'planned' | 'in_progress' | 'completed' | 'needs_revision';

export type TitleIdeaContract = {
  bookId: string;
  title: string;
  idea: string;
  corePromise: string;
  titleHooks: string[];
  forbiddenDrift: string[];
  createdAt: string;
  updatedAt: string;
};

export type EndgamePlan = {
  bookId: string;
  titleIdeaContract: string;
  protagonistEndState: string;
  finalConflict: string;
  finalOpponent: string;
  worldEndState: string;
  coreCharacterOutcomes: unknown;
  majorPayoffs: unknown;
  createdAt: string;
  updatedAt: string;
};

export type StagePlan = {
  stageIndex: number;
  chapterStart: number;
  chapterEnd: number;
  chapterBudget: number;
  objective: string;
  primaryResistance: string;
  pressureCurve: string;
  escalation: string;
  climax: string;
  payoff: string;
  irreversibleChange: string;
  nextQuestion: string;
  titleIdeaFocus: string;
  compressionTrigger: string;
  status: PlanStatus | string;
};

export type ArcPlan = {
  arcIndex: number;
  stageIndex: number;
  chapterStart: number;
  chapterEnd: number;
  chapterBudget: number;
  primaryThreads: unknown;
  characterTurns: unknown;
  threadActions: unknown;
  targetOutcome: string;
  escalationMode: string;
  turningPoint: string;
  requiredPayoff: string;
  resultingInstability: string;
  titleIdeaFocus: string;
  minChapterCount: number;
  maxChapterCount: number;
  status: PlanStatus | string;
};

export type ChapterPlan = {
  batchIndex: number;
  chapterIndex: number;
  arcIndex: number;
  goal: string;
  conflict: string;
  pressureSource: string;
  changeType: string;
  threadActions: unknown;
  reveal: string;
  payoffOrCost: string;
  endingHook: string;
  titleIdeaLink: string;
  batchGoal: string;
  requiredPayoffs: unknown;
  forbiddenDrift: unknown;
  status: PlanStatus | string;
};

export type StoryStateSnapshot = {
  bookId: string;
  chapterIndex: number;
  summary: string;
  titleIdeaAlignment: string;
  flatnessRisk: string;
  characterChanges: unknown;
  relationshipChanges: unknown;
  worldFacts: unknown;
  threadUpdates: unknown;
  unresolvedPromises: unknown;
  stageProgress: string;
  remainingChapterBudget: number;
  createdAt: string;
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

export type ChapterTensionBudget = {
  bookId: string;
  volumeIndex: number;
  chapterIndex: number;
  pressureLevel: TensionPressureLevel;
  dominantTension: DominantTension;
  requiredTurn: string;
  forcedChoice: string;
  costToPay: string;
  irreversibleChange: string;
  readerQuestion: string;
  hookPressure: string;
  flatnessRisks: string[];
};

export type FlatnessScoring = {
  conflictEscalation: number;
  choicePressure: number;
  consequenceVisibility: number;
  irreversibleChange: number;
  hookStrength: number;
};

export type TensionCheckpoint = {
  recentPressureCurve: Array<{
    chapterIndex: number;
    pressureLevel: TensionPressureLevel;
    dominantTension: DominantTension;
    flatnessScore: number | null;
  }>;
  repeatedPatterns: string[];
  flatChapterIndexes: number[];
  rewardGaps: string[];
  nextBudgetInstruction: string;
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
    flatness?: FlatnessScoring;
    viral?: ViralScoring;
  };
  stateUpdates: {
    characterArcUpdates: string[];
    relationshipUpdates: string[];
    threadUpdates: string[];
    worldKnowledgeUpdates: string[];
    themeUpdate: string;
  };
};

export type NarrativeStateDelta = {
  characterStates: CharacterStateInput[];
  relationshipStates: RelationshipStateInput[];
  threadUpdates: Array<{
    threadId: string;
    currentState: NarrativeThreadState;
    resolvedAt?: number | null;
    notes?: string | null;
  }>;
  scene: {
    location: string;
    timeInStory: string;
    charactersPresent: string[];
    events?: string | null;
  } | null;
  themeProgression: string;
};

export type CharacterStateInput = {
  bookId: string;
  characterId: string;
  characterName: string;
  volumeIndex: number;
  chapterIndex: number;
  location?: string | null;
  status?: string | null;
  knowledge?: string | null;
  emotion?: string | null;
  powerLevel?: string | null;
  arcPhase?: string | null;
};

export type CharacterStateOutput = Required<
  Pick<CharacterStateInput, 'bookId' | 'characterId' | 'characterName' | 'volumeIndex' | 'chapterIndex'>
> &
  Pick<
    CharacterStateInput,
    'location' | 'status' | 'knowledge' | 'emotion' | 'powerLevel' | 'arcPhase'
  >;

export type RelationshipStateInput = {
  bookId: string;
  relationshipId: string;
  volumeIndex: number;
  chapterIndex: number;
  trustLevel: number;
  tensionLevel: number;
  currentState: string;
  changeSummary?: string | null;
};

export type RelationshipStateOutput = RelationshipStateInput;

export type ValidationResult = {
  valid: boolean;
  issues: string[];
};

export type StoryTemplateId =
  | 'progression'
  | 'romance_growth'
  | 'mystery_serial';

export type DriftLevel = 'none' | 'light' | 'medium' | 'heavy';

export type StoryRhythmPosition =
  | 'setup'
  | 'escalation'
  | 'payoff'
  | 'twist'
  | 'cost';

export type StoryCheckpointType = 'light' | 'heavy';

export type StoryRunPhase =
  | 'bootstrapping'
  | 'planning_ready'
  | 'chapter_window_ready'
  | 'writing'
  | 'auditing'
  | 'patching'
  | 'replanning'
  | 'blocked'
  | 'cooldown'
  | 'completed';

export type StoryRepairAction =
  | 'continue'
  | 'patch_scene'
  | 'rebalance_subplots'
  | 'refresh_payoff_plan'
  | 'rebuild_chapter_window'
  | 'escalate_replanning'
  | 'pause_and_review';

export type StoryEventType =
  | 'mainline_advance'
  | 'subplot_shift'
  | 'promise_opened'
  | 'promise_paid'
  | 'character_turn'
  | 'relationship_turn'
  | 'world_change'
  | 'cost_paid';

export type StorySchedulerPriority = number;

export type BookContractCharacterBoundary = {
  characterId: string;
  publicPersona: string;
  hiddenDrive: string;
  lineWillNotCross: string;
  lineMayEventuallyCross: string;
};

export type BookContract = {
  bookId: string;
  titlePromise: string;
  corePremise: string;
  mainlinePromise: string;
  protagonistCoreDesire: string;
  protagonistNoDriftRules: string[];
  keyCharacterBoundaries: BookContractCharacterBoundary[];
  mandatoryPayoffs: string[];
  antiDriftRules: string[];
  activeTemplate: StoryTemplateId;
  createdAt: string;
  updatedAt: string;
};

export type StoryLedger = {
  bookId: string;
  chapterIndex: number;
  mainlineProgress: string;
  activeSubplots: Array<{
    threadId: string;
    label: string;
    status: 'active' | 'cooling' | 'payoff_due' | 'resolved';
    lastMovedChapter: number;
    targetPayoffChapter: number | null;
  }>;
  openPromises: Array<{
    promiseId: string;
    promise: string;
    introducedAtChapter: number;
    targetPayoffChapter: number | null;
    priority: ThreadImportance;
  }>;
  characterTruths: Array<{
    characterId: string;
    truth: string;
    sourceChapter: number;
    stability: 'stable' | 'volatile' | 'contested';
  }>;
  relationshipDeltas: Array<{
    relationshipId: string;
    summary: string;
    direction: 'improving' | 'fracturing' | 'volatile' | 'revealed';
    sourceChapter: number;
  }>;
  worldFacts: Array<{
    factId: string;
    fact: string;
    sourceChapter: number;
    scope: 'local' | 'faction' | 'systemic';
  }>;
  rhythmPosition: StoryRhythmPosition;
  riskFlags: Array<{
    code: 'drift_risk' | 'payoff_gap' | 'subplot_overload' | 'pacing_stall';
    message: string;
    severity: Exclude<AuditSeverity, 'blocker'>;
  }>;
  createdAt: string;
};

export type StoryLedgerDigest = {
  mainlineProgress: string;
  openPromises: StoryLedger['openPromises'];
  rhythmPosition: StoryRhythmPosition;
  riskFlags: StoryLedger['riskFlags'];
};

export type IntegrityReport = {
  mainlineAlignmentScore: number;
  characterStabilityScore: number;
  subplotControlScore: number;
  payoffProgressScore: number;
  rhythmFitScore: number;
  driftLevel: DriftLevel;
  repairAction: StoryRepairAction;
  findings: string[];
};

export type CheckpointSummary = {
  checkpointType: StoryCheckpointType;
  ledgerDigest: StoryLedgerDigest;
  tensionCheckpoint?: TensionCheckpoint | null;
  notes: string[];
};

export type StoryCheckpoint = {
  bookId: string;
  chapterIndex: number;
  checkpointType: StoryCheckpointType;
  contractDigest: string;
  planDigest: string;
  ledgerDigest: StoryLedgerDigest;
  checkpointSummary?: CheckpointSummary | null;
  integrityReport?: IntegrityReport | null;
  createdAt: string;
};

export type LatestStoryCheckpoint = Pick<
  StoryCheckpoint,
  'bookId' | 'chapterIndex' | 'checkpointType' | 'createdAt'
>;

export type StoryRunState = {
  phase: StoryRunPhase;
  currentChapter: number | null;
  driftLevel: DriftLevel;
  starvationScore: number;
  lastHealthyCheckpointChapter: number | null;
  latestFailureReason: string | null;
  cooldownUntil: string | null;
};

export type StoryTemplateRubric = {
  subplotLimit: number;
  maxPayoffGapChapters: number;
  rhythmPattern: StoryRhythmPosition[];
  driftWarnings: string[];
};

export type StoryTemplatePreset = {
  id: StoryTemplateId;
  label: string;
  summary: string;
  rubric: StoryTemplateRubric;
};

export type StoryEvent = {
  id: string;
  bookId: string;
  chapterIndex: number;
  eventType: StoryEventType;
  summary: string;
  affectedIds: string[];
  irreversible: boolean;
  createdAt: string;
};
