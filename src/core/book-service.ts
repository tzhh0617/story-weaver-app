import { randomUUID } from 'node:crypto';
import type { BookGenerationEvent, BookStatus } from '../shared/contracts.js';
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
import {
  formatStoryRoutePlanForPrompt,
  routeStoryTask,
} from './story-router/index.js';
import type {
  ChapterCard,
  ChapterCharacterPressure,
  ChapterRelationshipAction,
  ChapterTensionBudget,
  ChapterThreadAction,
  NarrativeAudit,
  NarrativeStateDelta,
  RelationshipStateInput,
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

function deriveTitleFromIdea(idea: string) {
  const cleaned = idea.trim().replace(/\s+/g, ' ');

  if (!cleaned) {
    return 'Untitled Story';
  }

  return cleaned.length > 48 ? `${cleaned.slice(0, 48)}...` : cleaned;
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
    'Start over from the original chapter brief and write a complete replacement draft. Preserve the same chapter title, outline, continuity, and story direction, but expand scenes, conflict, sensory detail, and emotional beats naturally.',
    'Do not summarize, do not explain the rewrite, and do not truncate the prose.',
  ].join('\n');
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
    }) => void;
    list: () => Array<{
      id: string;
      title: string;
      idea: string;
      status: string;
      targetChapters: number;
      wordsPerChapter: number;
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
  progress: {
    updatePhase: (
      bookId: string,
      phase: string,
      metadata?: {
        currentVolume?: number | null;
        currentChapter?: number | null;
        stepLabel?: string | null;
        errorMsg?: string | null;
      }
    ) => void;
    getByBookId: (bookId: string) =>
      | {
          bookId: string;
          currentVolume: number | null;
          currentChapter: number | null;
          phase: string | null;
          stepLabel: string | null;
          retryCount: number;
          errorMsg: string | null;
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
      currentVolume: input.currentVolume ?? null,
      currentChapter: input.currentChapter ?? null,
      stepLabel: input.stepLabel,
    });
    emitProgress(input);
    if (input.notifyBookUpdated) {
      deps.onBookUpdated?.(input.bookId);
    }
  }

  return {
    createBook(input: {
      idea: string;
      targetChapters: number;
      wordsPerChapter: number;
      modelId?: string;
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
      });

      deps.progress.updatePhase(id, 'creating');

      return id;
    },

    listBooks() {
      return deps.books.list();
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
      const chapterCards = deps.chapterCards?.listByBook?.(bookId) ?? [];
      const chapterTensionBudgets =
        deps.chapterTensionBudgets?.listByBook?.(bookId) ?? [];
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
        const auditFlatnessIssues =
          latestAudit?.issues?.filter((issue) =>
            FLATNESS_ISSUE_TYPES.has(issue.type)
          ) ?? [];
        const card = chapterCards.find(
          (candidate) =>
            candidate.volumeIndex === chapter.volumeIndex &&
            candidate.chapterIndex === chapter.chapterIndex
        );

        if (!card) {
          return {
            ...chapter,
            auditFlatnessScore,
            auditFlatnessIssues,
          };
        }

        return {
          ...chapter,
          auditFlatnessScore,
          auditFlatnessIssues,
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
              }
            : null,
          characterArcs: deps.characterArcs?.listByBook(bookId) ?? [],
          relationshipEdges: deps.relationshipEdges?.listByBook(bookId) ?? [],
          worldRules,
          narrativeThreads: deps.narrativeThreads?.listByBook(bookId) ?? [],
          chapterCards,
          chapterTensionBudgets,
          narrativeCheckpoints:
            deps.narrativeCheckpoints?.listByBook?.(bookId) ?? [],
        },
        chapters,
        progress: deps.progress.getByBookId(bookId) ?? null,
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

      deps.books.updateStatus(bookId, 'building_outline');
      deps.progress.updatePhase(bookId, 'building_outline');
    },

    pauseBook(bookId: string) {
      const book = deps.books.getById(bookId);
      if (!book) {
        throw new Error(`Book not found: ${bookId}`);
      }

      deps.books.updateStatus(bookId, 'paused');
      deps.progress.updatePhase(bookId, 'paused');
    },

    async resumeBook(bookId: string) {
      const book = deps.books.getById(bookId);
      if (!book) {
        throw new Error(`Book not found: ${bookId}`);
      }

      deps.books.updateStatus(bookId, 'writing');
      deps.progress.updatePhase(bookId, 'writing');

      return this.writeRemainingChapters(bookId);
    },

    async writeNextChapter(bookId: string) {
      const book = deps.books.getById(bookId);
      if (!book) {
        throw new Error(`Book not found: ${bookId}`);
      }

      const context = deps.books.getContext(bookId);
      const chapters = deps.chapters.listByBook(bookId);
      const nextChapter = chapters.find(
        (chapter) => chapter.outline && !chapter.content
      );

      if (!nextChapter || !nextChapter.outline || !nextChapter.title) {
        throw new Error('No outlined chapter available to write');
      }

      const nextChapterTitle = nextChapter.title;
      const modelId = resolveModelId();
      const chapterCard =
        deps.chapterCards
          ?.listByBook?.(bookId)
          .find(
            (card) =>
              card.volumeIndex === nextChapter.volumeIndex &&
              card.chapterIndex === nextChapter.chapterIndex
          ) ?? null;
      const tensionBudget =
        chapterCard && deps.chapterTensionBudgets?.getByChapter
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
          outline: nextChapter.outline,
        },
        maxCharacters: CHAPTER_CONTEXT_MAX_CHARACTERS,
      });
      const commandContext = chapterCard
        ? buildNarrativeCommandContext({
            bible: {
              themeQuestion:
                deps.storyBibles?.getByBook?.(bookId)?.themeQuestion ?? '',
              themeAnswerDirection:
                deps.storyBibles?.getByBook?.(bookId)?.themeAnswerDirection ??
                '',
              voiceGuide: deps.storyBibles?.getByBook?.(bookId)?.voiceGuide ?? '',
            },
            chapterCard,
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
          hasNarrativeBible: Boolean(deps.storyBibles?.getByBook?.(bookId)),
          hasChapterCard: Boolean(chapterCard),
          hasTensionBudget: Boolean(tensionBudget),
        },
      });
      const routePlanText = formatStoryRoutePlanForPrompt(storyRoutePlan);
      const prompt = chapterCard
        ? buildNarrativeDraftPrompt({
            idea: book.idea,
            wordsPerChapter: book.wordsPerChapter,
            commandContext: commandContext ?? legacyContinuityContext,
            routePlanText,
          })
        : buildChapterDraftPrompt({
            idea: book.idea,
            worldSetting: context?.worldSetting ?? null,
            masterOutline: context?.outline ?? null,
            continuityContext: legacyContinuityContext,
            chapterTitle: nextChapterTitle,
            chapterOutline: nextChapter.outline,
            targetChapters: book.targetChapters,
            wordsPerChapter: book.wordsPerChapter,
          });
      const writingStepLabel = `正在写第 ${nextChapter.chapterIndex} 章`;

      deps.progress.updatePhase(bookId, 'writing', {
        currentVolume: nextChapter.volumeIndex,
        currentChapter: nextChapter.chapterIndex,
        stepLabel: writingStepLabel,
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
          currentVolume: nextChapter.volumeIndex,
          currentChapter: nextChapter.chapterIndex,
          stepLabel: rewriteStepLabel,
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
      if (deps.chapterAuditor && chapterCard) {
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
        });
        deps.chapterAudits?.save({
          bookId,
          volumeIndex: nextChapter.volumeIndex,
          chapterIndex: nextChapter.chapterIndex,
          attempt: draftAttempts,
          audit,
        });

        const auditAction = decideAuditAction(audit);
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

      if (!deps.books.getById(bookId)) {
        return {
          deleted: true as const,
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
      deps.progress.updatePhase(bookId, 'writing', {
        currentVolume: nextChapter.volumeIndex,
        currentChapter: nextChapter.chapterIndex,
        stepLabel: postChapterStepLabel,
      });
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

        const nextChapter = deps.chapters
          .listByBook(bookId)
          .find((chapter) => chapter.outline && !chapter.content);

        if (!nextChapter) {
          break;
        }

        const result = await this.writeNextChapter(bookId);
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

        completedChapters += 1;
      }

      if (!deps.books.getById(bookId)) {
        return {
          completedChapters,
          status: 'deleted' as const,
        };
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

      deps.chapters.clearGeneratedContent(bookId);
      deps.plotThreads.clearByBook(bookId);
      deps.characters.clearStatesByBook(bookId);
      deps.sceneRecords.clearByBook(bookId);
      deps.books.updateStatus(bookId, 'building_outline');
      deps.progress.reset(bookId, 'building_outline');

      return this.resumeBook(bookId);
    },
  };
}
