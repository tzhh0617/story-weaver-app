import { randomUUID } from 'node:crypto';
import type {
  BookGenerationEvent,
  BookRecord,
  BookStatus,
  StoryRoutePlanView,
} from '../shared/contracts.js';
import {
  DEFAULT_MOCK_MODEL_ID,
  isMockModelId,
} from '../models/runtime-mode.js';
import { buildStoredChapterContext } from './consistency.js';
import {
  buildChapterDraftPrompt,
  buildNarrativeDraftPrompt,
} from './prompt-builder.js';
import { decideAuditAction } from './narrative/audit.js';
import {
  buildTensionCheckpoint,
  shouldRunNarrativeCheckpoint,
} from './narrative/checkpoint.js';
import { buildNarrativeCommandContext } from './narrative/context.js';
import { buildOpeningRetentionContextLines } from './narrative/opening-retention.js';
import { storyTemplatePresets } from './narrative/templates.js';
import {
  calculateRemainingChapterBudget,
  detectMilestone,
} from './narrative/state.js';
import { formatViralProtocolForPrompt } from './narrative/viral-story-protocol.js';
import {
  formatStoryRoutePlanForPrompt,
  routeStoryTask,
} from './story-router/index.js';
import type { StoryRoutePlan, StorySkill } from './story-router/index.js';
import type {
  ChapterCard,
  ChapterCharacterPressure,
  ChapterRelationshipAction,
  ChapterTensionBudget,
  ChapterThreadAction,
  NarrativeAudit,
  NarrativeStateDelta,
  RelationshipStateInput,
  IntegrityReport,
  ViralStoryProtocol,
} from './narrative/types.js';
import {
  assertPositiveIntegerLimit,
  countStoryCharacters,
  normalizeChapterOutlinesToTarget,
} from './story-constraints.js';
import type { OutlineBundle, OutlineGenerationInput } from './types.js';

const CHAPTER_CONTEXT_MAX_CHARACTERS = 6000;
const INITIAL_BOOK_TITLE = '新作品';
const FLATNESS_ISSUE_TYPES = new Set<NarrativeAudit['issues'][number]['type']>(
  [
    'flat_chapter',
    'weak_choice_pressure',
    'missing_consequence',
    'soft_hook',
    'repeated_tension_pattern',
  ]
);
const VIRAL_ISSUE_TYPES = new Set<NarrativeAudit['issues'][number]['type']>([
  'weak_reader_promise',
  'unclear_desire',
  'missing_payoff',
  'payoff_without_cost',
  'generic_trope',
  'weak_reader_question',
  'stale_hook_engine',
]);

function deriveTitleFromIdea(idea: string) {
  const cleaned = idea.trim().replace(/\s+/g, ' ');

  if (!cleaned) {
    return 'Untitled Story';
  }

  return cleaned.length > 48 ? `${cleaned.slice(0, 48)}...` : cleaned;
}

function toStoryRoutePlanView(plan: StoryRoutePlan): StoryRoutePlanView {
  const mapSkill = (skill: StorySkill) => ({
    id: skill.id,
    name: skill.name,
    type: skill.type,
    rigidity: skill.rigidity,
  });

  return {
    taskType: plan.taskType,
    requiredSkills: plan.requiredSkills.map(mapSkill),
    optionalSkills: plan.optionalSkills.map(mapSkill),
    hardConstraints: plan.hardConstraints,
    checklist: plan.checklist,
    redFlags: plan.redFlags,
    warnings: plan.warnings,
  };
}

type ChapterUpdate = {
  summary: string;
  openedThreads: Array<{
    id: string;
    description: string;
    plantedAt: number;
    expectedPayoff?: number | null;
    importance?: string | null;
  }>;
  resolvedThreadIds: string[];
  characterStates: Array<{
    characterId: string;
    characterName: string;
    location?: string | null;
    status?: string | null;
    knowledge?: string | null;
    emotion?: string | null;
    powerLevel?: string | null;
  }>;
  scene: {
    location: string;
    timeInStory: string;
    charactersPresent: string[];
    events?: string | null;
  } | null;
};

function hasUsableChapterUpdate(update: ChapterUpdate) {
  return update.summary.trim().length > 0;
}

function allowsIntegrityCommit(report: IntegrityReport | null | undefined) {
  if (!report) {
    return true;
  }

  return (
    report.repairAction === 'continue' || report.repairAction === 'patch_scene'
  );
}

function calculateFlatnessScore(scoring: NarrativeAudit['scoring']) {
  const flatness = scoring.flatness;
  if (!flatness) {
    return null;
  }

  return Math.round(
    (flatness.conflictEscalation +
      flatness.choicePressure +
      flatness.consequenceVisibility +
      flatness.irreversibleChange +
      flatness.hookStrength) /
      5
  );
}

function calculateViralScore(scoring: NarrativeAudit['scoring']) {
  const viral = scoring.viral;
  if (!viral) {
    return null;
  }

  return Math.round(
    (viral.openingHook +
      viral.desireClarity +
      viral.payoffStrength +
      viral.readerQuestionStrength +
      viral.tropeFulfillment +
      viral.antiClicheFreshness) /
      6
  );
}

function buildShortChapterRewritePrompt(input: {
  originalPrompt: string;
  wordsPerChapter: number;
  actualWordCount: number;
}) {
  return [
    input.originalPrompt,
    '',
    'Automatic review found this chapter too short.',
    `Generated effective word count: ${input.actualWordCount}`,
    `Soft target word count: approximately ${input.wordsPerChapter}`,
    'Start over from the original chapter brief and write a complete replacement draft. Preserve the same chapter identity, outline, continuity, and story direction, but expand scenes, conflict, sensory detail, and emotional beats naturally.',
    'Do not include any chapter title, heading, Markdown title, or title line in the正文.',
    'Do not summarize, do not explain the rewrite, and do not truncate the prose.',
  ].join('\n');
}

function buildOutlineFromChapterCard(card: ChapterCard) {
  return [
    card.plotFunction,
    `必须变化：${card.mustChange}`,
    `外部冲突：${card.externalConflict}`,
    `内部冲突：${card.internalConflict}`,
    `关系变化：${card.relationshipChange}`,
    `章末钩子：${card.endingHook}`,
  ]
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

function buildTemplatePromptContextLines(activeTemplate: string | null | undefined) {
  if (!activeTemplate) {
    return [];
  }

  const preset = storyTemplatePresets[activeTemplate as keyof typeof storyTemplatePresets];
  if (!preset) {
    return [`Template: ${activeTemplate}`];
  }

  const lines = [`Template: ${preset.id}`];
  for (const warning of preset.rubric.driftWarnings.slice(0, 2)) {
    lines.push(`Anti-drift: ${warning}`);
  }

  if (preset.rubric.rhythmPattern.length > 0) {
    lines.push(`Rhythm hint: ${preset.rubric.rhythmPattern.join(' -> ')}`);
  }

  if (preset.rubric.maxPayoffGapChapters > 0) {
    lines.push(
      `Payoff hint: land a visible gain, loss, clue, or relationship turn within ${preset.rubric.maxPayoffGapChapters} chapters.`
    );
  }

  return lines.slice(0, 5);
}

function saveChapterOutlines(
  deps: {
    chapters: {
      upsertOutline: (input: {
        bookId: string;
        volumeIndex: number;
        chapterIndex: number;
        title: string;
        outline: string;
      }) => void;
    };
    onBookUpdated?: (bookId: string) => void;
  },
  bookId: string,
  chapterOutlines: OutlineBundle['chapterOutlines']
) {
  for (const chapter of chapterOutlines) {
    deps.chapters.upsertOutline({
      bookId,
      volumeIndex: chapter.volumeIndex,
      chapterIndex: chapter.chapterIndex,
      title: chapter.title,
      outline: chapter.outline,
    });
  }

  if (chapterOutlines.length) {
    deps.onBookUpdated?.(bookId);
  }
}

function findNextWritableChapter(input: {
  chapters: Array<{
    volumeIndex: number;
    chapterIndex: number;
    title: string | null;
    outline: string | null;
    content: string | null;
  }>;
  chapterCards: Array<{
    volumeIndex: number;
    chapterIndex: number;
  }>;
  chapterPlans: Array<{
    chapterIndex: number;
    status: string;
  }>;
}) {
  const nextPlannedChapter = input.chapterPlans.find(
    (plan) => plan.status !== 'completed'
  );
  const plannedChapterRow = nextPlannedChapter
    ? input.chapters.find(
        (chapter) =>
          !chapter.content &&
          chapter.chapterIndex === nextPlannedChapter.chapterIndex
      )
    : null;
  const fallbackChapter = input.chapters.find(
    (chapter) =>
      !chapter.content &&
      (Boolean(chapter.outline?.trim()) ||
        input.chapterCards.some(
          (card) =>
            card.volumeIndex === chapter.volumeIndex &&
            card.chapterIndex === chapter.chapterIndex
        ))
  );

  return plannedChapterRow ?? fallbackChapter ?? null;
}

function hasPlanningBundle(
  outlineBundle: OutlineBundle
): outlineBundle is OutlineBundle & {
  titleIdeaContract?: NonNullable<OutlineBundle['titleIdeaContract']>;
  endgamePlan?: NonNullable<OutlineBundle['endgamePlan']>;
  stagePlans?: NonNullable<OutlineBundle['stagePlans']>;
  arcPlans?: NonNullable<OutlineBundle['arcPlans']>;
  chapterPlans?: NonNullable<OutlineBundle['chapterPlans']>;
} {
  return Boolean(
    outlineBundle.titleIdeaContract ||
      outlineBundle.endgamePlan ||
      outlineBundle.stagePlans?.length ||
      outlineBundle.arcPlans?.length ||
      outlineBundle.chapterPlans?.length
  );
}

function isBookPaused(
  deps: {
    books: {
      getById: (bookId: string) => { status: string } | undefined;
    };
  },
  bookId: string
) {
  return deps.books.getById(bookId)?.status === 'paused';
}

async function extractChapterUpdate(input: {
  modelId: string;
  chapterIndex: number;
  content: string;
  deps: Pick<
    Parameters<typeof createBookService>[0],
    | 'summaryGenerator'
    | 'plotThreadExtractor'
    | 'characterStateExtractor'
    | 'sceneRecordExtractor'
    | 'chapterUpdateExtractor'
  >;
}): Promise<ChapterUpdate> {
  if (input.deps.chapterUpdateExtractor) {
    try {
      const chapterUpdate =
        await input.deps.chapterUpdateExtractor.extractChapterUpdate({
          modelId: input.modelId,
          chapterIndex: input.chapterIndex,
          content: input.content,
        });

      if (hasUsableChapterUpdate(chapterUpdate)) {
        return chapterUpdate;
      }
    } catch {
      // Fall back to the older extractors so one malformed JSON response does not lose the chapter.
    }
  }

  const threadUpdates = await input.deps.plotThreadExtractor.extractThreads({
    modelId: input.modelId,
    chapterIndex: input.chapterIndex,
    content: input.content,
  });

  return {
    summary: await input.deps.summaryGenerator.summarizeChapter({
      modelId: input.modelId,
      content: input.content,
    }),
    openedThreads: threadUpdates.openedThreads,
    resolvedThreadIds: threadUpdates.resolvedThreadIds,
    characterStates: await input.deps.characterStateExtractor.extractStates({
      modelId: input.modelId,
      chapterIndex: input.chapterIndex,
      content: input.content,
    }),
    scene: await input.deps.sceneRecordExtractor.extractScene({
      modelId: input.modelId,
      chapterIndex: input.chapterIndex,
      content: input.content,
    }),
  };
}

export function createBookService(deps: {
  books: {
    create: (input: {
      id: string;
      title: string;
      idea: string;
      targetChapters: number;
      wordsPerChapter: number;
      viralStrategy?: BookRecord['viralStrategy'];
    }) => void;
    list: () => Array<{
      id: string;
      title: string;
      idea: string;
      status: string;
      targetChapters: number;
      wordsPerChapter: number;
      viralStrategy?: BookRecord['viralStrategy'];
      createdAt: string;
      updatedAt: string;
    }>;
    getById: (bookId: string) =>
      | {
          id: string;
          title: string;
          idea: string;
          status: string;
          targetChapters: number;
          wordsPerChapter: number;
          viralStrategy?: BookRecord['viralStrategy'];
          createdAt: string;
          updatedAt: string;
        }
      | undefined;
    updateStatus: (bookId: string, status: BookStatus) => void;
    updateTitle: (bookId: string, title: string) => void;
    delete: (bookId: string) => void;
    saveContext: (input: {
      bookId: string;
      worldSetting: string;
      outline: string;
      styleGuide?: string | null;
    }) => void;
    getContext: (bookId: string) =>
      | {
          bookId: string;
          worldSetting: string;
          outline: string;
          styleGuide: string | null;
        }
      | undefined;
    clearGeneratedState?: (bookId: string) => void;
  };
  chapters: {
    upsertOutline: (input: {
      bookId: string;
      volumeIndex: number;
      chapterIndex: number;
      title: string;
      outline: string;
    }) => void;
    listByBook: (bookId: string) => Array<{
      bookId: string;
      volumeIndex: number;
      chapterIndex: number;
      title: string | null;
      outline: string | null;
      content: string | null;
      summary: string | null;
      wordCount: number;
      auditScore?: number | null;
      draftAttempts?: number;
    }>;
    listProgressByBookIds?: (
      bookIds: string[]
    ) => Map<string, { completedChapters: number; totalChapters: number }>;
    saveContent: (input: {
      bookId: string;
      volumeIndex: number;
      chapterIndex: number;
      content: string;
      summary?: string | null;
      wordCount: number;
      auditScore?: number | null;
      draftAttempts?: number;
    }) => void;
    clearGeneratedContent: (bookId: string) => void;
    deleteByBook: (bookId: string) => void;
  };
  sceneRecords: {
    save: (input: {
      bookId: string;
      volumeIndex: number;
      chapterIndex: number;
      location: string;
      timeInStory: string;
      charactersPresent: string[];
      events?: string | null;
    }) => void;
    getLatestByBook: (bookId: string) =>
      | {
          bookId: string;
          volumeIndex: number;
          chapterIndex: number;
          location: string;
          timeInStory: string;
          charactersPresent: string[];
          events: string | null;
        }
      | null;
    clearByBook: (bookId: string) => void;
  };
  characters: {
    saveState: (input: {
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
    }) => void;
    listLatestStatesByBook: (bookId: string) => Array<{
      characterId: string;
      characterName: string;
      volumeIndex: number;
      chapterIndex: number;
      location: string | null;
      status: string | null;
      knowledge: string | null;
      emotion: string | null;
      powerLevel: string | null;
    }>;
    clearStatesByBook: (bookId: string) => void;
    deleteByBook: (bookId: string) => void;
  };
  plotThreads: {
    upsertThread: (input: {
      id: string;
      bookId: string;
      description: string;
      plantedAt: number;
      expectedPayoff?: number | null;
      resolvedAt?: number | null;
      importance?: string | null;
    }) => void;
    resolveThread: (id: string, resolvedAt: number) => void;
    listByBook: (bookId: string) => Array<{
      id: string;
      bookId: string;
      description: string;
      plantedAt: number;
      expectedPayoff: number | null;
      resolvedAt: number | null;
      importance: string;
    }>;
    clearByBook: (bookId: string) => void;
  };
  storyBibles?: {
    saveGraph: (
      bookId: string,
      bible: NonNullable<OutlineBundle['narrativeBible']>
    ) => void;
    getByBook?: (bookId: string) =>
      | Omit<
          NonNullable<OutlineBundle['narrativeBible']>,
          'characterArcs' | 'relationshipEdges' | 'worldRules' | 'narrativeThreads'
        >
      | null;
  };
  characterArcs?: {
    listByBook: (bookId: string) => NonNullable<OutlineBundle['narrativeBible']>['characterArcs'];
    saveState?: (input: {
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
    }) => void;
  };
  relationshipEdges?: {
    listByBook: (bookId: string) => NonNullable<OutlineBundle['narrativeBible']>['relationshipEdges'];
  };
  worldRules?: {
    listByBook: (bookId: string) => NonNullable<OutlineBundle['narrativeBible']>['worldRules'];
  };
  narrativeThreads?: {
    listByBook: (bookId: string) => NonNullable<OutlineBundle['narrativeBible']>['narrativeThreads'];
    resolveThread?: (bookId: string, threadId: string, resolvedAt: number) => void;
    upsertThread?: (
      bookId: string,
      thread: NonNullable<OutlineBundle['narrativeBible']>['narrativeThreads'][number]
    ) => void;
  };
  volumePlans?: {
    upsertMany: (bookId: string, plans: NonNullable<OutlineBundle['volumePlans']>) => void;
    listByBook?: (bookId: string) => NonNullable<OutlineBundle['volumePlans']>;
  };
  chapterCards?: {
    upsertMany: (cards: NonNullable<OutlineBundle['chapterCards']>) => void;
    getNextUnwritten?: (bookId: string) => ChapterCard | null;
    listByBook?: (bookId: string) => ChapterCard[];
    upsertThreadActions?: (
      bookId: string,
      volumeIndex: number,
      chapterIndex: number,
      actions: ChapterThreadAction[]
    ) => void;
    listThreadActions?: (
      bookId: string,
      volumeIndex: number,
      chapterIndex: number
    ) => ChapterThreadAction[];
    upsertCharacterPressures?: (
      bookId: string,
      volumeIndex: number,
      chapterIndex: number,
      pressures: ChapterCharacterPressure[]
    ) => void;
    listCharacterPressures?: (
      bookId: string,
      volumeIndex: number,
      chapterIndex: number
    ) => ChapterCharacterPressure[];
    upsertRelationshipActions?: (
      bookId: string,
      volumeIndex: number,
      chapterIndex: number,
      actions: ChapterRelationshipAction[]
    ) => void;
    listRelationshipActions?: (
      bookId: string,
      volumeIndex: number,
      chapterIndex: number
    ) => ChapterRelationshipAction[];
  };
  chapterTensionBudgets?: {
    upsertMany: (budgets: ChapterTensionBudget[]) => void;
    getByChapter?: (
      bookId: string,
      volumeIndex: number,
      chapterIndex: number
    ) => ChapterTensionBudget | null;
    listByBook?: (bookId: string) => ChapterTensionBudget[];
  };
  chapterAudits?: {
    save: (input: {
      bookId: string;
      volumeIndex: number;
      chapterIndex: number;
      attempt: number;
      audit: NarrativeAudit;
    }) => void;
    listLatestByBook?: (bookId: string) => Array<{
      volumeIndex: number;
      chapterIndex: number;
      attempt: number;
      score?: number;
      decision?: NarrativeAudit['decision'];
      issues?: NarrativeAudit['issues'];
      scoring: NarrativeAudit['scoring'];
    }>;
  };
  relationshipStates?: {
    save: (input: RelationshipStateInput) => void;
  };
  narrativeCheckpoint?: {
    reviewCheckpoint: (input: {
      bookId: string;
      chapterIndex: number;
    }) => Promise<{
      checkpointType: string;
      arcReport: unknown;
      threadDebt: unknown;
      pacingReport: unknown;
      replanningNotes: string | null;
    }>;
  };
  narrativeCheckpoints?: {
    save: (input: {
      bookId: string;
      chapterIndex: number;
      report?: unknown;
      checkpointType?: string;
      arcReport?: unknown;
      threadDebt?: unknown;
      pacingReport?: unknown;
      replanningNotes?: string | null;
      futureCardRevisions?: unknown[];
    }) => void;
    listByBook?: (bookId: string) => Array<{
      bookId: string;
      chapterIndex: number;
      checkpointType?: string;
      report: unknown;
      futureCardRevisions: unknown[];
      createdAt: string;
    }>;
  };
  titleIdeaContracts?: {
    save: (input: {
      bookId: string;
      title: string;
      idea: string;
      corePromise: string;
      titleHooks: string[];
      forbiddenDrift: string[];
    }) => void;
    getByBook: (bookId: string) => {
      bookId: string;
      title: string;
      idea: string;
      corePromise: string;
      titleHooks: string[];
      forbiddenDrift: string[];
      createdAt: string;
      updatedAt: string;
    } | null;
  };
  endgamePlans?: {
    save: (input: {
      bookId: string;
      titleIdeaContract: string;
      protagonistEndState: string;
      finalConflict: string;
      finalOpponent: string;
      worldEndState: string;
      coreCharacterOutcomes: unknown;
      majorPayoffs: unknown;
    }) => void;
    getByBook: (bookId: string) => {
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
    } | null;
  };
  stagePlans?: {
    upsertMany: (
      bookId: string,
      plans: Array<{
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
        status?: string;
      }>
    ) => void;
    listByBook: (bookId: string) => Array<{
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
      status: string;
    }>;
  };
  arcPlans?: {
    upsertMany: (
      bookId: string,
      plans: Array<{
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
        status?: string;
      }>
    ) => void;
    listByBook: (bookId: string) => Array<{
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
      status: string;
    }>;
  };
  chapterPlans?: {
    upsertMany: (
      bookId: string,
      plans: Array<{
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
        status?: string;
      }>
    ) => void;
    listByBook: (bookId: string) => Array<{
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
      status: string;
    }>;
  };
  storyStateSnapshots?: {
    save: (input: {
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
    }) => void;
    getLatestByBook: (bookId: string) => {
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
    } | null;
  };
  bookContracts?: {
    getByBook: (bookId: string) => {
      bookId: string;
      titlePromise: string;
      corePremise: string;
      mainlinePromise: string;
      protagonistCoreDesire: string;
      protagonistNoDriftRules: string[];
      keyCharacterBoundaries: Array<{
        characterId: string;
        publicPersona: string;
        hiddenDrive: string;
        lineWillNotCross: string;
        lineMayEventuallyCross: string;
      }>;
      mandatoryPayoffs: string[];
      antiDriftRules: string[];
      activeTemplate: string;
      createdAt: string;
      updatedAt: string;
    } | null;
  };
  storyLedgers?: {
    getLatestByBook: (bookId: string) => {
      bookId: string;
      chapterIndex: number;
      mainlineProgress: string;
      activeSubplots: unknown;
      openPromises: unknown;
      characterTruths: unknown;
      relationshipDeltas: unknown;
      worldFacts: unknown;
      rhythmPosition: string;
      riskFlags: unknown;
      createdAt: string;
    } | null;
  };
  storyCheckpoints?: {
    getLatestByBook: (bookId: string) => {
      bookId: string;
      chapterIndex: number;
      checkpointType: string;
      createdAt: string;
    } | null;
  };
  progress: {
    updatePhase: (
      bookId: string,
      phase: string,
      metadata?: {
        currentVolume?: number | null;
        currentChapter?: number | null;
        currentStage?: number | null;
        currentArc?: number | null;
        stepLabel?: string | null;
        activeTaskType?: string | null;
        errorMsg?: string | null;
        driftLevel?: 'none' | 'light' | 'medium' | 'heavy';
        lastHealthyCheckpointChapter?: number | null;
        cooldownUntil?: string | null;
        starvationScore?: number | null;
      }
    ) => void;
    getByBookId: (bookId: string) =>
      | {
          bookId: string;
          currentVolume: number | null;
          currentChapter: number | null;
          currentStage: number | null;
          currentArc: number | null;
          phase: string | null;
          stepLabel: string | null;
          activeTaskType: string | null;
          retryCount: number;
          errorMsg: string | null;
          driftLevel: 'none' | 'light' | 'medium' | 'heavy';
          lastHealthyCheckpointChapter: number | null;
          cooldownUntil: string | null;
          starvationScore: number;
        }
      | undefined;
    reset: (bookId: string, phase: string) => void;
    deleteByBook: (bookId: string) => void;
  };
  outlineService: {
    generateTitleFromIdea?: (
      input: OutlineGenerationInput & { modelId: string }
    ) => Promise<string>;
    generateFromIdea: (
      input: OutlineGenerationInput & { modelId: string }
    ) => Promise<OutlineBundle>;
  };
  chapterWriter: {
    writeChapter: (input: {
      modelId: string;
      prompt: string;
      onChunk?: (chunk: string) => void;
    }) => Promise<{
      content: string;
      usage?: {
        inputTokens?: number;
        outputTokens?: number;
      };
    }>;
  };
  chapterAuditor?: {
    auditChapter: (input: {
      modelId: string;
      draft: string;
      auditContext: string;
      routePlanText?: string | null;
      viralStoryProtocol?: ViralStoryProtocol | null;
      chapterIndex?: number | null;
    }) => Promise<NarrativeAudit>;
  };
  chapterRevision?: {
    reviseChapter: (input: {
      modelId: string;
      originalPrompt: string;
      draft: string;
      issues: NarrativeAudit['issues'];
    }) => Promise<string>;
  };
  narrativeStateExtractor?: {
    extractState: (input: {
      modelId: string;
      content: string;
    }) => Promise<NarrativeStateDelta>;
  };
  summaryGenerator: {
    summarizeChapter: (input: {
      modelId: string;
      content: string;
    }) => Promise<string>;
  };
  plotThreadExtractor: {
    extractThreads: (input: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) => Promise<{
      openedThreads: Array<{
        id: string;
        description: string;
        plantedAt: number;
        expectedPayoff?: number | null;
        importance?: string | null;
      }>;
      resolvedThreadIds: string[];
    }>;
  };
  characterStateExtractor: {
    extractStates: (input: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) => Promise<
      Array<{
        characterId: string;
        characterName: string;
        location?: string | null;
        status?: string | null;
        knowledge?: string | null;
        emotion?: string | null;
        powerLevel?: string | null;
      }>
    >;
  };
  sceneRecordExtractor: {
    extractScene: (input: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) => Promise<{
      location: string;
      timeInStory: string;
      charactersPresent: string[];
      events?: string | null;
    } | null>;
  };
  chapterUpdateExtractor?: {
    extractChapterUpdate: (input: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) => Promise<ChapterUpdate>;
  };
  chapterIntegrityChecker?: {
    inspectChapter: (input: {
      bookId: string;
      volumeIndex: number;
      chapterIndex: number;
      chapterTitle: string;
      chapterOutline: string;
      content: string;
      summary: string;
      auditScore: number | null;
      draftAttempts: number;
    }) => Promise<IntegrityReport>;
  };
  shouldRewriteShortChapter?: (input: {
    content: string;
    wordsPerChapter: number;
  }) => boolean;
  resolveModelId?: () => string;
  onBookUpdated?: (bookId: string) => void;
  onGenerationEvent?: (event: BookGenerationEvent) => void;
}) {
  const resolveModelId = deps.resolveModelId ?? (() => DEFAULT_MOCK_MODEL_ID);

  function emitProgress(input: {
    bookId: string;
    phase: string;
    stepLabel: string;
    currentVolume?: number | null;
    currentChapter?: number | null;
  }) {
    deps.onGenerationEvent?.({
      bookId: input.bookId,
      type: 'progress',
      phase: input.phase,
      stepLabel: input.stepLabel,
      currentVolume: input.currentVolume ?? null,
      currentChapter: input.currentChapter ?? null,
    });
  }

  function updateTrackedPhase(input: {
    bookId: string;
    phase: string;
    stepLabel: string;
    currentVolume?: number | null;
    currentChapter?: number | null;
    notifyBookUpdated?: boolean;
  }) {
    deps.progress.updatePhase(input.bookId, input.phase, {
      ...preservePlanningMetadata(input.bookId, {
        currentVolume: input.currentVolume ?? null,
        currentChapter: input.currentChapter ?? null,
        stepLabel: input.stepLabel,
      }),
    });
    emitProgress(input);
    if (input.notifyBookUpdated) {
      deps.onBookUpdated?.(input.bookId);
    }
  }

  function getProgressState(bookId: string) {
    return deps.progress.getByBookId(bookId) ?? null;
  }

  function hasPersistedPlanning(bookId: string) {
    return Boolean(
      deps.titleIdeaContracts?.getByBook(bookId) ||
        deps.endgamePlans?.getByBook(bookId) ||
        deps.stagePlans?.listByBook(bookId).length ||
        deps.arcPlans?.listByBook(bookId).length ||
        deps.chapterPlans?.listByBook(bookId).length
    );
  }

  function preservePlanningMetadata(bookId: string, metadata?: {
    currentVolume?: number | null;
    currentChapter?: number | null;
    stepLabel?: string | null;
  }) {
    const current = getProgressState(bookId);
    const keepPlanningMetadata = hasPersistedPlanning(bookId);

    return {
      currentVolume: metadata?.currentVolume ?? current?.currentVolume ?? null,
      currentChapter: metadata?.currentChapter ?? current?.currentChapter ?? null,
      currentStage: keepPlanningMetadata ? current?.currentStage ?? null : null,
      currentArc: keepPlanningMetadata ? current?.currentArc ?? null : null,
      stepLabel: metadata?.stepLabel ?? current?.stepLabel ?? null,
      activeTaskType: keepPlanningMetadata ? current?.activeTaskType ?? null : null,
    };
  }

  function initializePlanning(bookId: string, outlineBundle: OutlineBundle) {
    if (!hasPlanningBundle(outlineBundle)) {
      return false;
    }

    if (outlineBundle.titleIdeaContract) {
      deps.titleIdeaContracts?.save(outlineBundle.titleIdeaContract);
    }

    if (outlineBundle.endgamePlan) {
      deps.endgamePlans?.save(outlineBundle.endgamePlan);
    }

    if (outlineBundle.stagePlans?.length) {
      deps.stagePlans?.upsertMany(bookId, outlineBundle.stagePlans);
    }

    if (outlineBundle.arcPlans?.length) {
      deps.arcPlans?.upsertMany(bookId, outlineBundle.arcPlans);
    }

    if (outlineBundle.chapterPlans?.length) {
      deps.chapterPlans?.upsertMany(bookId, outlineBundle.chapterPlans);
    }

    deps.progress.updatePhase(bookId, 'planning_init', {
      currentStage: outlineBundle.stagePlans?.[0]?.stageIndex ?? 1,
      currentArc: outlineBundle.arcPlans?.[0]?.arcIndex ?? 1,
      stepLabel: '正在初始化规划循环',
      activeTaskType: 'book:plan:init',
    });
    emitProgress({
      bookId,
      phase: 'planning_init',
      stepLabel: '正在初始化规划循环',
    });

    deps.onBookUpdated?.(bookId);

    return true;
  }

  function markChapterPlanCompleted(bookId: string, chapterIndex: number) {
    const chapterPlans = deps.chapterPlans?.listByBook(bookId) ?? [];
    const targetPlan = chapterPlans.find((plan) => plan.chapterIndex === chapterIndex);

    if (!targetPlan) {
      return;
    }

    deps.chapterPlans?.upsertMany(bookId, [
      {
        ...targetPlan,
        status: 'completed',
      },
    ]);
  }

  function saveStoryStateSnapshot(input: {
    bookId: string;
    chapterIndex: number;
    summary: string;
    titleIdeaAlignment: string;
    flatnessRisk: string;
  }) {
    const book = deps.books.getById(input.bookId);

    if (!book) {
      return;
    }

    deps.storyStateSnapshots?.save({
      bookId: input.bookId,
      chapterIndex: input.chapterIndex,
      summary: input.summary,
      titleIdeaAlignment: input.titleIdeaAlignment,
      flatnessRisk: input.flatnessRisk,
      characterChanges: [],
      relationshipChanges: [],
      worldFacts: [],
      threadUpdates: [],
      unresolvedPromises: [],
      stageProgress: `chapter ${input.chapterIndex} completed`,
      remainingChapterBudget: calculateRemainingChapterBudget(
        book.targetChapters,
        input.chapterIndex
      ),
    });
  }

  function handleMilestoneReplan(bookId: string, chapterIndex: number) {
    const milestone = detectMilestone(chapterIndex);

    if (!milestone) {
      return;
    }

    deps.progress.updatePhase(bookId, 'planning_recheck', {
      currentChapter: chapterIndex,
      stepLabel: `已到达 ${milestone} 章里程碑，等待后续重规划`,
      activeTaskType: 'book:plan:rebuild-chapters',
    });
  }

  function routeChapterToReplanning(input: {
    bookId: string;
    volumeIndex: number;
    chapterIndex: number;
    integrityReport: IntegrityReport;
  }) {
    const rebuildWindow =
      input.integrityReport.repairAction === 'rebuild_chapter_window';
    const stepLabel = rebuildWindow
      ? `第 ${input.chapterIndex} 章完整性偏移，正在重建章节窗口`
      : `第 ${input.chapterIndex} 章完整性偏移，正在升级重规划`;

    deps.books.updateStatus(input.bookId, 'writing');
    deps.progress.updatePhase(input.bookId, 'planning_recheck', {
      currentVolume: input.volumeIndex,
      currentChapter: input.chapterIndex,
      stepLabel,
      activeTaskType: 'book:plan:rebuild-chapters',
    });
    emitProgress({
      bookId: input.bookId,
      phase: 'planning_recheck',
      stepLabel,
      currentVolume: input.volumeIndex,
      currentChapter: input.chapterIndex,
    });
    deps.onBookUpdated?.(input.bookId);
  }

  return {
    createBook(input: {
      idea: string;
      targetChapters: number;
      wordsPerChapter: number;
      modelId?: string;
      viralStrategy?: BookRecord['viralStrategy'];
    }) {
      assertPositiveIntegerLimit(
        input.targetChapters,
        'Target chapters must be a positive integer'
      );
      assertPositiveIntegerLimit(
        input.wordsPerChapter,
        'Words per chapter must be a positive integer'
      );

      const id = randomUUID();

      deps.books.create({
        id,
        title: INITIAL_BOOK_TITLE,
        idea: input.idea,
        targetChapters: input.targetChapters,
        wordsPerChapter: input.wordsPerChapter,
        viralStrategy: input.viralStrategy ?? null,
      });

      deps.progress.updatePhase(id, 'creating');

      return id;
    },

    listBooks() {
      const books = deps.books.list();
      const batchedProgress = deps.chapters.listProgressByBookIds?.(
        books.map((book) => book.id)
      );

      return books.map((book) => {
        const chapterProgress = batchedProgress?.get(book.id);
        const chapters = chapterProgress
          ? null
          : deps.chapters.listByBook(book.id);
        const totalChapters = chapterProgress?.totalChapters ?? chapters?.length ?? 0;
        const completedChapters =
          chapterProgress?.completedChapters ??
          chapters?.filter((chapter) => Boolean(chapter.content)).length ??
          0;

        return {
          ...book,
          progress: totalChapters
            ? Math.round((completedChapters / totalChapters) * 100)
            : 0,
          completedChapters,
          totalChapters,
        };
      });
    },

    getBookDetail(bookId: string) {
      const book = deps.books.getById(bookId);
      if (!book) {
        return null;
      }
      const storedContext = deps.books.getContext(bookId) ?? null;
      const bible = deps.storyBibles?.getByBook?.(bookId) ?? null;
      const worldRules = deps.worldRules?.listByBook(bookId) ?? [];
      const volumePlans = deps.volumePlans?.listByBook?.(bookId) ?? [];
      const titleIdeaContract = deps.titleIdeaContracts?.getByBook(bookId) ?? null;
      const endgamePlan = deps.endgamePlans?.getByBook(bookId) ?? null;
      const stagePlans = deps.stagePlans?.listByBook(bookId) ?? [];
      const arcPlans = deps.arcPlans?.listByBook(bookId) ?? [];
      const chapterPlans = deps.chapterPlans?.listByBook(bookId) ?? [];
      const latestStoryStateSnapshot =
        deps.storyStateSnapshots?.getLatestByBook(bookId) ?? null;
      const bookContract = deps.bookContracts?.getByBook(bookId) ?? null;
      const latestLedger = deps.storyLedgers?.getLatestByBook(bookId) ?? null;
      const latestCheckpoint =
        deps.storyCheckpoints?.getLatestByBook(bookId) ?? null;
      const chapterCards = deps.chapterCards?.listByBook?.(bookId) ?? [];
      const chapterTensionBudgets =
        deps.chapterTensionBudgets?.listByBook?.(bookId) ?? [];
      const currentProgress = deps.progress.getByBookId(bookId) ?? null;
      const latestAudits = new Map(
        (deps.chapterAudits?.listLatestByBook?.(bookId) ?? []).map((audit) => [
          `${audit.volumeIndex}-${audit.chapterIndex}`,
          audit,
        ])
      );
      const context = bible
        ? {
            bookId,
            worldSetting: [
              `主题问题：${bible.themeQuestion}`,
              `主题方向：${bible.themeAnswerDirection}`,
              ...worldRules.map(
                (rule) => `${rule.id}: ${rule.ruleText}; 代价：${rule.cost}`
              ),
            ].join('\n'),
            outline: volumePlans
              .map(
                (volume) =>
                  `第${volume.volumeIndex}卷 ${volume.title}: ${volume.chapterStart}-${volume.chapterEnd}; ${volume.promisedPayoff}`
              )
              .join('\n'),
            styleGuide: bible.voiceGuide,
          }
        : storedContext;
      const chapters = deps.chapters.listByBook(bookId).map((chapter) => {
        const latestAudit = latestAudits.get(
          `${chapter.volumeIndex}-${chapter.chapterIndex}`
        );
        const auditFlatnessScore = latestAudit
          ? calculateFlatnessScore(latestAudit.scoring)
          : null;
        const auditViralScore = latestAudit
          ? calculateViralScore(latestAudit.scoring)
          : null;
        const auditFlatnessIssues =
          latestAudit?.issues?.filter((issue) =>
            FLATNESS_ISSUE_TYPES.has(issue.type)
          ) ?? [];
        const auditViralIssues =
          latestAudit?.issues?.filter((issue) =>
            VIRAL_ISSUE_TYPES.has(issue.type)
          ) ?? [];
        const card = chapterCards.find(
          (candidate) =>
            candidate.volumeIndex === chapter.volumeIndex &&
            candidate.chapterIndex === chapter.chapterIndex
        );
        const budget = chapterTensionBudgets.find(
          (candidate) =>
            candidate.volumeIndex === chapter.volumeIndex &&
            candidate.chapterIndex === chapter.chapterIndex
        );
        const storyRoutePlan = toStoryRoutePlanView(
          routeStoryTask({
            taskType: 'write_chapter',
            context: {
              hasNarrativeBible: Boolean(bible),
              hasChapterCard: Boolean(card),
              hasTensionBudget: Boolean(budget),
            },
          })
        );

        if (!card) {
          return {
            ...chapter,
            auditFlatnessScore,
            auditFlatnessIssues,
            auditViralScore,
            auditViralIssues,
            storyRoutePlan,
          };
        }

        return {
          ...chapter,
          auditFlatnessScore,
          auditFlatnessIssues,
          auditViralScore,
          auditViralIssues,
          storyRoutePlan,
          outline: [
            `必须变化：${card.mustChange}`,
            `读者满足：${card.readerReward}`,
            `章末钩子：${card.endingHook}`,
          ].join('\n'),
        };
      });

      return {
        book,
        context,
        latestScene: deps.sceneRecords.getLatestByBook(bookId),
        characterStates: deps.characters.listLatestStatesByBook(bookId),
        plotThreads: deps.plotThreads.listByBook(bookId),
        narrative: {
          storyBible: bible
            ? {
                themeQuestion: bible.themeQuestion,
                themeAnswerDirection: bible.themeAnswerDirection,
                centralDramaticQuestion: bible.centralDramaticQuestion,
                viralStoryProtocol: bible.viralStoryProtocol ?? null,
              }
            : null,
          bookContract,
          latestLedger,
          latestCheckpoint,
          runState: currentProgress
            ? {
                phase: currentProgress.phase ?? 'creating',
                currentChapter: currentProgress.currentChapter ?? null,
                driftLevel: currentProgress.driftLevel ?? 'none',
                starvationScore: currentProgress.starvationScore ?? 0,
                lastHealthyCheckpointChapter:
                  currentProgress.lastHealthyCheckpointChapter ?? null,
                latestFailureReason: currentProgress.errorMsg,
                cooldownUntil: currentProgress.cooldownUntil ?? null,
              }
            : null,
          characterArcs: deps.characterArcs?.listByBook(bookId) ?? [],
          relationshipEdges: deps.relationshipEdges?.listByBook(bookId) ?? [],
          worldRules,
          narrativeThreads: deps.narrativeThreads?.listByBook(bookId) ?? [],
          titleIdeaContract,
          endgamePlan,
          stagePlans,
          arcPlans,
          chapterPlans,
          latestStoryStateSnapshot,
          chapterCards,
          chapterTensionBudgets,
          narrativeCheckpoints:
            deps.narrativeCheckpoints?.listByBook?.(bookId) ?? [],
        },
        chapters,
        progress: currentProgress,
      };
    },

    async startBook(bookId: string) {
      const book = deps.books.getById(bookId);
      if (!book) {
        throw new Error(`Book not found: ${bookId}`);
      }

      deps.books.updateStatus(bookId, 'building_world');
      const modelId = resolveModelId();

      if (deps.outlineService.generateTitleFromIdea) {
        updateTrackedPhase({
          bookId,
          phase: 'naming_title',
          stepLabel: '正在生成书名',
          notifyBookUpdated: true,
        });

        const generatedTitle = (
          await deps.outlineService.generateTitleFromIdea({
            bookId,
            idea: book.idea,
            targetChapters: book.targetChapters,
            wordsPerChapter: book.wordsPerChapter,
            modelId,
          })
        ).trim();

        if (!deps.books.getById(bookId)) {
          return;
        }

        deps.books.updateTitle(
          bookId,
          generatedTitle || deriveTitleFromIdea(book.idea)
        );
        deps.onBookUpdated?.(bookId);
      }

      updateTrackedPhase({
        bookId,
        phase: 'building_world',
        stepLabel: '正在构建世界观与叙事圣经',
        notifyBookUpdated: true,
      });

      const outlineBundle = await deps.outlineService.generateFromIdea({
        bookId,
        idea: book.idea,
        targetChapters: book.targetChapters,
        wordsPerChapter: book.wordsPerChapter,
        modelId,
        viralStrategy: book.viralStrategy ?? null,
        onWorldSetting: (worldSetting) => {
          if (!deps.books.getById(bookId)) {
            return;
          }

          updateTrackedPhase({
            bookId,
            phase: 'building_outline',
            stepLabel: '正在生成故事大纲',
            notifyBookUpdated: true,
          });

          deps.books.saveContext({
            bookId,
            worldSetting,
            outline: '',
          });
          deps.onBookUpdated?.(bookId);
        },
        onMasterOutline: (masterOutline) => {
          const currentContext = deps.books.getContext(bookId);
          if (!deps.books.getById(bookId) || !currentContext) {
            return;
          }

          updateTrackedPhase({
            bookId,
            phase: 'planning_chapters',
            stepLabel: '正在规划章节卡',
            notifyBookUpdated: true,
          });

          deps.books.saveContext({
            bookId,
            worldSetting: currentContext.worldSetting,
            outline: masterOutline,
          });
          deps.onBookUpdated?.(bookId);
        },
        onChapterOutlines: (chapterOutlines) => {
          if (!deps.books.getById(bookId)) {
            return;
          }

          saveChapterOutlines(deps, bookId, chapterOutlines);
        },
      });

      if (!deps.books.getById(bookId)) {
        return;
      }

      deps.books.saveContext({
        bookId,
        worldSetting: outlineBundle.worldSetting,
        outline: outlineBundle.masterOutline,
      });

      if (outlineBundle.narrativeBible) {
        deps.storyBibles?.saveGraph(bookId, outlineBundle.narrativeBible);
      }
      if (outlineBundle.volumePlans) {
        deps.volumePlans?.upsertMany(bookId, outlineBundle.volumePlans);
      }
      if (outlineBundle.chapterCards) {
        deps.chapterCards?.upsertMany(outlineBundle.chapterCards);
      }
      if (outlineBundle.chapterTensionBudgets?.length) {
        deps.chapterTensionBudgets?.upsertMany(outlineBundle.chapterTensionBudgets);
      }
      for (const card of outlineBundle.chapterCards ?? []) {
        const threadActions = (outlineBundle.chapterThreadActions ?? []).filter(
          (action) =>
            action.volumeIndex === card.volumeIndex &&
            action.chapterIndex === card.chapterIndex
        );
        const characterPressures = (
          outlineBundle.chapterCharacterPressures ?? []
        ).filter(
          (pressure) =>
            pressure.volumeIndex === card.volumeIndex &&
            pressure.chapterIndex === card.chapterIndex
        );
        const relationshipActions = (
          outlineBundle.chapterRelationshipActions ?? []
        ).filter(
          (action) =>
            action.volumeIndex === card.volumeIndex &&
            action.chapterIndex === card.chapterIndex
        );
        deps.chapterCards?.upsertThreadActions?.(
          bookId,
          card.volumeIndex,
          card.chapterIndex,
          threadActions
        );
        deps.chapterCards?.upsertCharacterPressures?.(
          bookId,
          card.volumeIndex,
          card.chapterIndex,
          characterPressures
        );
        deps.chapterCards?.upsertRelationshipActions?.(
          bookId,
          card.volumeIndex,
          card.chapterIndex,
          relationshipActions
        );
      }

      saveChapterOutlines(
        deps,
        bookId,
        normalizeChapterOutlinesToTarget(
          outlineBundle.chapterOutlines,
          book.targetChapters
        )
      );

      initializePlanning(bookId, outlineBundle);

      deps.books.updateStatus(bookId, 'building_outline');
      if (!hasPersistedPlanning(bookId)) {
        deps.progress.updatePhase(bookId, 'building_outline');
      }
    },

    pauseBook(bookId: string) {
      const book = deps.books.getById(bookId);
      if (!book) {
        throw new Error(`Book not found: ${bookId}`);
      }

      deps.books.updateStatus(bookId, 'paused');
      deps.progress.updatePhase(bookId, 'paused', {
        ...preservePlanningMetadata(bookId),
      });
    },

    async resumeBook(bookId: string) {
      const book = deps.books.getById(bookId);
      if (!book) {
        throw new Error(`Book not found: ${bookId}`);
      }

      const currentProgress = getProgressState(bookId);
      const shouldResumePlanning =
        currentProgress?.activeTaskType === 'book:plan:rebuild-arc' ||
        currentProgress?.activeTaskType === 'book:plan:rebuild-chapters' ||
        currentProgress?.phase === 'planning_recheck';

      if (shouldResumePlanning) {
        deps.books.updateStatus(bookId, 'building_outline');
        await this.startBook(bookId);

        if (!deps.books.getById(bookId)) {
          return {
            completedChapters: 0,
            status: 'deleted' as const,
          };
        }

        deps.books.updateStatus(bookId, 'writing');
        deps.progress.updatePhase(bookId, 'writing', {
          ...preservePlanningMetadata(bookId),
        });

        return this.writeRemainingChapters(bookId);
      }

      deps.books.updateStatus(bookId, 'writing');
      deps.progress.updatePhase(bookId, 'writing', {
        ...preservePlanningMetadata(bookId),
      });

      return this.writeRemainingChapters(bookId);
    },

    async writeNextChapter(bookId: string) {
      const book = deps.books.getById(bookId);
      if (!book) {
        throw new Error(`Book not found: ${bookId}`);
      }

      const context = deps.books.getContext(bookId);
      const chapters = deps.chapters.listByBook(bookId);
      const chapterCards = deps.chapterCards?.listByBook?.(bookId) ?? [];
      const chapterPlans = deps.chapterPlans?.listByBook(bookId) ?? [];
      const nextChapter = findNextWritableChapter({
        chapters,
        chapterCards,
        chapterPlans,
      });

      if (!nextChapter) {
        throw new Error('No outlined chapter available to write');
      }

      const chapterCard =
        chapterCards.find(
          (card) =>
            card.volumeIndex === nextChapter.volumeIndex &&
            card.chapterIndex === nextChapter.chapterIndex
        ) ?? null;
      const nextChapterOutline =
        nextChapter.outline?.trim() ||
        (chapterCard ? buildOutlineFromChapterCard(chapterCard) : '');
      const nextChapterTitle = nextChapter.title ?? chapterCard?.title;

      if (!nextChapterOutline || !nextChapterTitle) {
        throw new Error('No outlined chapter available to write');
      }

      const modelId = resolveModelId();
      const storyBible = deps.storyBibles?.getByBook?.(bookId) ?? null;
      const bookContract = deps.bookContracts?.getByBook(bookId) ?? null;
      const effectiveChapterCard = chapterCard
        ? {
            ...chapterCard,
            title: nextChapterTitle,
            plotFunction:
              chapterCard.plotFunction.trim() || nextChapterOutline,
          }
        : null;
      const tensionBudget =
        effectiveChapterCard && deps.chapterTensionBudgets?.getByChapter
          ? deps.chapterTensionBudgets.getByChapter(
              bookId,
              nextChapter.volumeIndex,
              nextChapter.chapterIndex
            )
          : null;
      const legacyContinuityContext = buildStoredChapterContext({
        worldSetting: context?.worldSetting ?? null,
        characterStates: deps.characters.listLatestStatesByBook(bookId),
        plotThreads: deps.plotThreads.listByBook(bookId),
        latestScene: deps.sceneRecords.getLatestByBook(bookId),
        chapters,
        currentChapter: {
          volumeIndex: nextChapter.volumeIndex,
          chapterIndex: nextChapter.chapterIndex,
          outline: nextChapterOutline,
        },
        maxCharacters: CHAPTER_CONTEXT_MAX_CHARACTERS,
      });
      const commandContext = effectiveChapterCard
        ? buildNarrativeCommandContext({
            bible: {
              themeQuestion: storyBible?.themeQuestion ?? '',
              themeAnswerDirection: storyBible?.themeAnswerDirection ?? '',
              voiceGuide: storyBible?.voiceGuide ?? '',
              viralStoryProtocol: storyBible?.viralStoryProtocol ?? null,
            },
            chapterCard: effectiveChapterCard,
            tensionBudget,
            hardContinuity: legacyContinuityContext.split('\n').slice(0, 20),
            characterPressures:
              deps.chapterCards
                ?.listCharacterPressures?.(
                  bookId,
                  nextChapter.volumeIndex,
                  nextChapter.chapterIndex
                )
                .map(
                  (pressure) =>
                    `${pressure.characterId}: ${pressure.desirePressure}; ${pressure.fearPressure}; ${pressure.flawTrigger}; expected=${pressure.expectedChoice}`
                ) ?? [],
            relationshipActions:
              deps.chapterCards
                ?.listRelationshipActions?.(
                  bookId,
                  nextChapter.volumeIndex,
                  nextChapter.chapterIndex
                )
                .map(
                  (action) =>
                    `${action.relationshipId} ${action.action}: ${action.requiredChange}`
                ) ?? [],
            threadActions:
              deps.chapterCards
                ?.listThreadActions?.(
                  bookId,
                  nextChapter.volumeIndex,
                  nextChapter.chapterIndex
                )
                .map(
                  (action) =>
                    `${action.threadId} ${action.action}: ${action.requiredEffect}`
                ) ?? [],
            worldRules:
              deps.worldRules
                ?.listByBook(bookId)
                .map((rule) => `${rule.id}: ${rule.ruleText}; cost=${rule.cost}`) ??
              [],
            recentSummaries: chapters
              .filter((chapter) => chapter.summary)
              .slice(-2)
              .map((chapter) => `Chapter ${chapter.chapterIndex}: ${chapter.summary}`),
            previousChapterEnding: null,
            maxCharacters: CHAPTER_CONTEXT_MAX_CHARACTERS,
        })
        : null;
      const storyRoutePlan = routeStoryTask({
        taskType: 'write_chapter',
        context: {
          hasNarrativeBible: Boolean(storyBible),
          hasChapterCard: Boolean(effectiveChapterCard),
          hasTensionBudget: Boolean(tensionBudget),
        },
      });
      const openingRetentionLines = buildOpeningRetentionContextLines(
        nextChapter.chapterIndex
      );
      const routePlanText = formatStoryRoutePlanForPrompt({
        ...storyRoutePlan,
        openingRetentionLines,
        viralProtocolLines: storyBible?.viralStoryProtocol
          ? [
              formatViralProtocolForPrompt(storyBible.viralStoryProtocol, {
                chapterIndex: nextChapter.chapterIndex,
              }),
            ]
          : [],
      });
      const prompt = effectiveChapterCard
        ? buildNarrativeDraftPrompt({
            idea: book.idea,
            wordsPerChapter: book.wordsPerChapter,
            commandContext: commandContext ?? legacyContinuityContext,
            routePlanText,
            viralStoryProtocol: storyBible?.viralStoryProtocol ?? null,
            chapterIndex: nextChapter.chapterIndex,
            extraContextLines: buildTemplatePromptContextLines(
              bookContract?.activeTemplate
            ),
          })
        : buildChapterDraftPrompt({
            idea: book.idea,
            worldSetting: context?.worldSetting ?? null,
            masterOutline: context?.outline ?? null,
            continuityContext: legacyContinuityContext,
            chapterTitle: nextChapterTitle,
            chapterOutline: nextChapterOutline,
            targetChapters: book.targetChapters,
            wordsPerChapter: book.wordsPerChapter,
            routePlanText,
          });
      const writingStepLabel = `正在写第 ${nextChapter.chapterIndex} 章`;

      deps.progress.updatePhase(bookId, 'writing', {
        ...preservePlanningMetadata(bookId, {
          currentVolume: nextChapter.volumeIndex,
          currentChapter: nextChapter.chapterIndex,
          stepLabel: writingStepLabel,
        }),
      });
      deps.onGenerationEvent?.({
        bookId,
        type: 'progress',
        phase: 'writing',
        stepLabel: writingStepLabel,
        currentVolume: nextChapter.volumeIndex,
        currentChapter: nextChapter.chapterIndex,
      });

      let result = await deps.chapterWriter.writeChapter({
        modelId,
        prompt,
        onChunk: (delta) => {
          if (!isBookPaused(deps, bookId)) {
            deps.onGenerationEvent?.({
              bookId,
              type: 'chapter-stream',
              volumeIndex: nextChapter.volumeIndex,
              chapterIndex: nextChapter.chapterIndex,
              title: nextChapterTitle,
              delta,
            });
          }
        },
      });

      const bookAfterDraft = deps.books.getById(bookId);
      if (!bookAfterDraft) {
        return {
          deleted: true as const,
        };
      }
      if (bookAfterDraft.status === 'paused') {
        deps.progress.updatePhase(bookId, 'paused');
        deps.onBookUpdated?.(bookId);
        return {
          paused: true as const,
        };
      }

      if (
        !isMockModelId(modelId) &&
        deps.shouldRewriteShortChapter?.({
          content: result.content,
          wordsPerChapter: book.wordsPerChapter,
        })
      ) {
        const rewriteStepLabel = `正在重写第 ${nextChapter.chapterIndex} 章`;
        deps.progress.updatePhase(bookId, 'writing', {
          ...preservePlanningMetadata(bookId, {
            currentVolume: nextChapter.volumeIndex,
            currentChapter: nextChapter.chapterIndex,
            stepLabel: rewriteStepLabel,
          }),
        });
        deps.onGenerationEvent?.({
          bookId,
          type: 'progress',
          phase: 'writing',
          stepLabel: rewriteStepLabel,
          currentVolume: nextChapter.volumeIndex,
          currentChapter: nextChapter.chapterIndex,
        });

        let isFirstRewriteChunk = true;
        result = await deps.chapterWriter.writeChapter({
          modelId,
          prompt: buildShortChapterRewritePrompt({
            originalPrompt: prompt,
            wordsPerChapter: book.wordsPerChapter,
            actualWordCount: countStoryCharacters(result.content),
          }),
          onChunk: (delta) => {
            const streamEvent: BookGenerationEvent = {
              bookId,
              type: 'chapter-stream',
              volumeIndex: nextChapter.volumeIndex,
              chapterIndex: nextChapter.chapterIndex,
              title: nextChapterTitle,
              delta,
              ...(isFirstRewriteChunk ? { replace: true } : {}),
            };
            if (!isBookPaused(deps, bookId)) {
              deps.onGenerationEvent?.(streamEvent);
            }
            isFirstRewriteChunk = false;
          },
        });
      }

      const bookAfterFinalDraft = deps.books.getById(bookId);
      if (!bookAfterFinalDraft) {
        return {
          deleted: true as const,
        };
      }
      if (bookAfterFinalDraft.status === 'paused') {
        deps.progress.updatePhase(bookId, 'paused');
        deps.onBookUpdated?.(bookId);
        return {
          paused: true as const,
        };
      }

      let auditScore: number | null = null;
      let draftAttempts = 1;
      if (deps.chapterAuditor && effectiveChapterCard) {
        const auditContext = commandContext ?? legacyContinuityContext;
        const auditStepLabel = `正在审校第 ${nextChapter.chapterIndex} 章叙事质量`;
        updateTrackedPhase({
          bookId,
          phase: 'auditing_chapter',
          stepLabel: auditStepLabel,
          currentVolume: nextChapter.volumeIndex,
          currentChapter: nextChapter.chapterIndex,
        });
        let audit = await deps.chapterAuditor.auditChapter({
          modelId,
          draft: result.content,
          auditContext,
          routePlanText,
          viralStoryProtocol: storyBible?.viralStoryProtocol ?? null,
          chapterIndex: nextChapter.chapterIndex,
        });
        deps.chapterAudits?.save({
          bookId,
          volumeIndex: nextChapter.volumeIndex,
          chapterIndex: nextChapter.chapterIndex,
          attempt: draftAttempts,
          audit,
        });

        const auditAction = decideAuditAction(audit, {
          chapterIndex: nextChapter.chapterIndex,
        });
        if (auditAction !== 'accept' && deps.chapterRevision) {
          draftAttempts += 1;
          const revisionStepLabel = `正在修订第 ${nextChapter.chapterIndex} 章`;
          updateTrackedPhase({
            bookId,
            phase: 'revising_chapter',
            stepLabel: revisionStepLabel,
            currentVolume: nextChapter.volumeIndex,
            currentChapter: nextChapter.chapterIndex,
          });
          result = {
            ...result,
            content: await deps.chapterRevision.reviseChapter({
              modelId,
              originalPrompt: prompt,
              draft: result.content,
              issues: audit.issues,
            }),
          };
          const reauditStepLabel = `正在复审第 ${nextChapter.chapterIndex} 章叙事质量`;
          updateTrackedPhase({
            bookId,
            phase: 'auditing_chapter',
            stepLabel: reauditStepLabel,
            currentVolume: nextChapter.volumeIndex,
            currentChapter: nextChapter.chapterIndex,
          });
          audit = await deps.chapterAuditor.auditChapter({
            modelId,
            draft: result.content,
            auditContext,
            routePlanText,
          });
          deps.chapterAudits?.save({
            bookId,
            volumeIndex: nextChapter.volumeIndex,
            chapterIndex: nextChapter.chapterIndex,
            attempt: draftAttempts,
            audit,
          });
        }

        auditScore = audit.score;
      }

      const postChapterStepLabel = `正在生成第 ${nextChapter.chapterIndex} 章摘要与连续性`;
      updateTrackedPhase({
        bookId,
        phase: 'extracting_continuity',
        stepLabel: postChapterStepLabel,
        currentVolume: nextChapter.volumeIndex,
        currentChapter: nextChapter.chapterIndex,
      });

      const chapterUpdate = await extractChapterUpdate({
        modelId,
        chapterIndex: nextChapter.chapterIndex,
        content: result.content,
        deps,
      });
      const integrityReport = deps.chapterIntegrityChecker
        ? await deps.chapterIntegrityChecker.inspectChapter({
            bookId,
            volumeIndex: nextChapter.volumeIndex,
            chapterIndex: nextChapter.chapterIndex,
            chapterTitle: nextChapterTitle,
            chapterOutline: nextChapterOutline,
            content: result.content,
            summary: chapterUpdate.summary,
            auditScore,
            draftAttempts,
          })
        : null;

      if (!deps.books.getById(bookId)) {
        return {
          deleted: true as const,
        };
      }

      if (!allowsIntegrityCommit(integrityReport)) {
        routeChapterToReplanning({
          bookId,
          volumeIndex: nextChapter.volumeIndex,
          chapterIndex: nextChapter.chapterIndex,
          integrityReport,
        });

        return {
          replanning: true as const,
          integrityReport,
        };
      }

      deps.chapters.saveContent({
        bookId,
        volumeIndex: nextChapter.volumeIndex,
        chapterIndex: nextChapter.chapterIndex,
        content: result.content,
        summary: chapterUpdate.summary,
        wordCount: countStoryCharacters(result.content),
        auditScore,
        draftAttempts,
      });

      for (const thread of chapterUpdate.openedThreads) {
        deps.plotThreads.upsertThread({
          id: thread.id,
          bookId,
          description: thread.description,
          plantedAt: thread.plantedAt,
          expectedPayoff: thread.expectedPayoff ?? null,
          importance: thread.importance ?? 'normal',
        });
      }

      for (const threadId of chapterUpdate.resolvedThreadIds) {
        deps.plotThreads.resolveThread(threadId, nextChapter.chapterIndex);
      }

      for (const state of chapterUpdate.characterStates) {
        deps.characters.saveState({
          bookId,
          characterId: state.characterId,
          characterName: state.characterName,
          volumeIndex: nextChapter.volumeIndex,
          chapterIndex: nextChapter.chapterIndex,
          location: state.location ?? null,
          status: state.status ?? null,
          knowledge: state.knowledge ?? null,
          emotion: state.emotion ?? null,
          powerLevel: state.powerLevel ?? null,
        });
      }

      if (chapterUpdate.scene) {
        deps.sceneRecords.save({
          bookId,
          volumeIndex: nextChapter.volumeIndex,
          chapterIndex: nextChapter.chapterIndex,
          location: chapterUpdate.scene.location,
          timeInStory: chapterUpdate.scene.timeInStory,
          charactersPresent: chapterUpdate.scene.charactersPresent,
          events: chapterUpdate.scene.events ?? null,
        });
      }

      if (deps.narrativeStateExtractor) {
        const stateStepLabel = `正在提取第 ${nextChapter.chapterIndex} 章叙事状态`;
        updateTrackedPhase({
          bookId,
          phase: 'extracting_state',
          stepLabel: stateStepLabel,
          currentVolume: nextChapter.volumeIndex,
          currentChapter: nextChapter.chapterIndex,
        });
        const delta = await deps.narrativeStateExtractor.extractState({
          modelId,
          content: result.content,
        });
        for (const state of delta.characterStates) {
          deps.characterArcs?.saveState?.({
            ...state,
            bookId,
            volumeIndex: nextChapter.volumeIndex,
            chapterIndex: nextChapter.chapterIndex,
          });
        }
        for (const state of delta.relationshipStates) {
          deps.relationshipStates?.save({
            ...state,
            bookId,
            volumeIndex: nextChapter.volumeIndex,
            chapterIndex: nextChapter.chapterIndex,
          });
        }
        for (const threadUpdate of delta.threadUpdates) {
          const existingThread = deps.narrativeThreads
            ?.listByBook(bookId)
            .find((thread) => thread.id === threadUpdate.threadId);
          if (existingThread && deps.narrativeThreads?.upsertThread) {
            deps.narrativeThreads.upsertThread(bookId, {
              ...existingThread,
              currentState: threadUpdate.currentState,
              resolvedAt: threadUpdate.resolvedAt ?? existingThread.resolvedAt,
              notes: threadUpdate.notes ?? existingThread.notes,
            });
          }
          if (threadUpdate.resolvedAt && deps.narrativeThreads?.resolveThread) {
            deps.narrativeThreads.resolveThread(
              bookId,
              threadUpdate.threadId,
              threadUpdate.resolvedAt
            );
          }
        }
      }

      markChapterPlanCompleted(bookId, nextChapter.chapterIndex);
      saveStoryStateSnapshot({
        bookId,
        chapterIndex: nextChapter.chapterIndex,
        summary: chapterUpdate.summary,
        titleIdeaAlignment: 'maintained',
        flatnessRisk: auditScore !== null && auditScore >= 80 ? 'low' : 'medium',
      });
      if (
        deps.narrativeCheckpoint &&
        deps.narrativeCheckpoints &&
        shouldRunNarrativeCheckpoint(nextChapter.chapterIndex)
      ) {
        const checkpointStepLabel = `正在复盘第 ${nextChapter.chapterIndex} 章叙事状态`;
        deps.progress.updatePhase(bookId, 'checkpoint_review', {
          currentVolume: nextChapter.volumeIndex,
          currentChapter: nextChapter.chapterIndex,
          stepLabel: checkpointStepLabel,
        });
        emitProgress({
          bookId,
          phase: 'checkpoint_review',
          stepLabel: checkpointStepLabel,
          currentVolume: nextChapter.volumeIndex,
          currentChapter: nextChapter.chapterIndex,
        });
        const checkpoint = await deps.narrativeCheckpoint.reviewCheckpoint({
          bookId,
          chapterIndex: nextChapter.chapterIndex,
        });
        const tensionCheckpoint =
          deps.chapterTensionBudgets?.listByBook &&
          deps.chapterAudits?.listLatestByBook
            ? buildTensionCheckpoint({
                chapterIndex: nextChapter.chapterIndex,
                budgets: deps.chapterTensionBudgets.listByBook(bookId),
                audits: deps.chapterAudits.listLatestByBook(bookId),
              })
            : null;
        deps.narrativeCheckpoints.save({
          bookId,
          chapterIndex: nextChapter.chapterIndex,
          ...(tensionCheckpoint
            ? {
                report: {
                  ...checkpoint,
                  tensionCheckpoint,
                },
                futureCardRevisions: [
                  {
                    type: 'tension_budget_rebalance',
                    instruction: tensionCheckpoint.nextBudgetInstruction,
                  },
                ],
              }
            : checkpoint),
        });
      }

      handleMilestoneReplan(bookId, nextChapter.chapterIndex);

      const latestBook = deps.books.getById(bookId);
      if (!latestBook) {
        return {
          deleted: true as const,
        };
      }

      if (latestBook.status === 'paused') {
        deps.progress.updatePhase(bookId, 'paused');
        deps.onBookUpdated?.(bookId);
        return result;
      }

      deps.books.updateStatus(bookId, 'writing');
      const progressAfterReplan = getProgressState(bookId);
      if (progressAfterReplan?.phase !== 'planning_recheck') {
        deps.progress.updatePhase(bookId, 'writing', {
          ...preservePlanningMetadata(bookId, {
            currentVolume: nextChapter.volumeIndex,
            currentChapter: nextChapter.chapterIndex,
            stepLabel: postChapterStepLabel,
          }),
        });
      }
      deps.onGenerationEvent?.({
        bookId,
        type: 'chapter-complete',
        volumeIndex: nextChapter.volumeIndex,
        chapterIndex: nextChapter.chapterIndex,
        title: nextChapterTitle,
      });
      deps.onBookUpdated?.(bookId);

      return result;
    },

    async writeRemainingChapters(bookId: string) {
      let completedChapters = 0;

      while (true) {
        const currentBook = deps.books.getById(bookId);
        if (!currentBook) {
          return {
            completedChapters,
            status: 'deleted' as const,
          };
        }

        if (currentBook.status === 'paused') {
          return {
            completedChapters,
            status: 'paused' as const,
          };
        }

        const chapters = deps.chapters.listByBook(bookId);
        const chapterCards = deps.chapterCards?.listByBook?.(bookId) ?? [];
        const chapterPlans = deps.chapterPlans?.listByBook(bookId) ?? [];
        const hasUnwrittenChapters = chapters.some((chapter) => !chapter.content);

        if (!hasUnwrittenChapters) {
          break;
        }

        if (
          !findNextWritableChapter({
            chapters,
            chapterCards,
            chapterPlans,
          })
        ) {
          throw new Error('No outlined chapter available to write');
        }

        const nextChapterResult = await this.writeNextChapter(bookId).catch((error) => {
          if (
            error instanceof Error &&
            error.message === 'No outlined chapter available to write'
          ) {
            return null;
          }

          throw error;
        });

        if (!nextChapterResult) {
          break;
        }
        const result = nextChapterResult;
        if (!deps.books.getById(bookId)) {
          return {
            completedChapters,
            status: 'deleted' as const,
          };
        }

        if ('deleted' in result && result.deleted) {
          return {
            completedChapters,
            status: 'deleted' as const,
          };
        }
        if ('paused' in result && result.paused) {
          return {
            completedChapters,
            status: 'paused' as const,
          };
        }
        if ('replanning' in result && result.replanning) {
          return {
            completedChapters,
            status: 'replanning' as const,
          };
        }

        completedChapters += 1;
      }

      if (!deps.books.getById(bookId)) {
        return {
          completedChapters,
          status: 'deleted' as const,
        };
      }

      const hasUnwrittenChapters = deps.chapters
        .listByBook(bookId)
        .some((chapter) => !chapter.content);

      if (hasUnwrittenChapters) {
        throw new Error('No outlined chapter available to write');
      }

      deps.books.updateStatus(bookId, 'completed');
      deps.progress.updatePhase(bookId, 'completed');
      deps.onBookUpdated?.(bookId);

      return {
        completedChapters,
        status: 'completed' as const,
      };
    },

    deleteBook(bookId: string) {
      if (!deps.books.getById(bookId)) {
        return;
      }

      deps.chapters.deleteByBook(bookId);
      deps.plotThreads.clearByBook(bookId);
      deps.characters.deleteByBook(bookId);
      deps.sceneRecords.clearByBook(bookId);
      deps.progress.deleteByBook(bookId);
      deps.books.delete(bookId);
    },

    async restartBook(bookId: string) {
      const book = deps.books.getById(bookId);
      if (!book) {
        throw new Error(`Book not found: ${bookId}`);
      }

      deps.books.clearGeneratedState?.(bookId);
      deps.chapters.deleteByBook(bookId);
      deps.plotThreads.clearByBook(bookId);
      deps.characters.clearStatesByBook(bookId);
      deps.sceneRecords.clearByBook(bookId);
      deps.books.updateStatus(bookId, 'creating');
      deps.progress.reset(bookId, 'creating');
      deps.onBookUpdated?.(bookId);

      await this.startBook(bookId);

      if (!deps.books.getById(bookId)) {
        return {
          completedChapters: 0,
          status: 'deleted' as const,
        };
      }

      deps.books.updateStatus(bookId, 'writing');
      deps.progress.updatePhase(bookId, 'writing');
      deps.onBookUpdated?.(bookId);

      return this.writeRemainingChapters(bookId);
    },
  };
}
