import type {
  BookGenerationEvent,
  BookRecord,
  BookStatus,
} from '@story-weaver/shared/contracts';
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
import { formatViralProtocolForPrompt } from './narrative/viral-story-protocol.js';
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
  ViralStoryProtocol,
} from './narrative/types.js';
import {
  countStoryCharacters,
} from './story-constraints.js';
import type { OutlineBundle, OutlineGenerationInput } from './types.js';
import { createBookAggregate, isBookPaused } from './aggregates/book/index.js';
import { createOutlineAggregate } from './aggregates/outline/index.js';

const CHAPTER_CONTEXT_MAX_CHARACTERS = 6000;

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
    'Do not include any chapter title, heading, Markdown title, or title line in the body text.',
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
    resolveThread: (bookId: string, id: string, resolvedAt: number) => void;
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
  shouldRewriteShortChapter?: (input: {
    content: string;
    wordsPerChapter: number;
  }) => boolean;
  resolveModelId?: () => string;
  onBookUpdated?: (bookId: string) => void;
  onGenerationEvent?: (event: BookGenerationEvent) => void;
}) {
  const resolveModelId =
    deps.resolveModelId ??
    (() => {
      throw new Error('No model configured');
    });

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

  const aggregate = createBookAggregate(deps);
  const outlineAggregate = createOutlineAggregate({
    books: {
      getById: deps.books.getById,
      updateStatus: deps.books.updateStatus,
      updateTitle: deps.books.updateTitle,
      saveContext: deps.books.saveContext,
      getContext: deps.books.getContext,
    },
    chapters: deps.chapters,
    progress: deps.progress,
    outlineService: deps.outlineService,
    storyBibles: deps.storyBibles,
    volumePlans: deps.volumePlans,
    chapterCards: deps.chapterCards,
    chapterTensionBudgets: deps.chapterTensionBudgets,
    resolveModelId,
    onBookUpdated: deps.onBookUpdated,
    onGenerationEvent: deps.onGenerationEvent,
  });

  return {
    createBook(input: {
      idea: string;
      targetChapters: number;
      wordsPerChapter: number;
      modelId?: string;
      viralStrategy?: BookRecord['viralStrategy'];
    }) {
      return aggregate.createBook(input);
    },

    listBooks() {
      return aggregate.listBooks();
    },

    getBookDetail(bookId: string) {
      return aggregate.getBookDetail(bookId);
    },

    async startBook(bookId: string) {
      const book = deps.books.getById(bookId);
      if (!book) {
        throw new Error(`Book not found: ${bookId}`);
      }

      deps.books.updateStatus(bookId, 'building_world');
      await outlineAggregate.generateFromIdea(bookId);
    },

    pauseBook(bookId: string) {
      aggregate.pauseBook(bookId);
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
      const chapterCards = deps.chapterCards?.listByBook?.(bookId) ?? [];
      const nextChapter = chapters.find(
        (chapter) =>
          !chapter.content &&
          (Boolean(chapter.outline?.trim()) ||
            chapterCards.some(
              (card) =>
                card.volumeIndex === chapter.volumeIndex &&
                card.chapterIndex === chapter.chapterIndex
            ))
      );

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
        deps.plotThreads.resolveThread(bookId, threadId, nextChapter.chapterIndex);
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
          .find((chapter) => !chapter.content);

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
      aggregate.deleteBook(bookId);
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
