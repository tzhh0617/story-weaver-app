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
  | 'repeated_tension_pattern';

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
