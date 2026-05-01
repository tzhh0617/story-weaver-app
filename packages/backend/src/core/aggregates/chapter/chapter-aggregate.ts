import type { BookGenerationEvent, BookRecord, BookStatus } from '@story-weaver/shared/contracts';
import { buildStoredChapterContext } from '../../consistency.js';
import {
  buildChapterDraftPrompt,
  buildNarrativeDraftPrompt,
} from '../../prompt-builder.js';
import { decideAuditAction } from '../../narrative/audit.js';
import {
  buildTensionCheckpoint,
  shouldRunNarrativeCheckpoint,
} from '../../narrative/checkpoint.js';
import { buildNarrativeCommandContext } from '../../narrative/context.js';
import { buildOpeningRetentionContextLines } from '../../narrative/opening-retention.js';
import { formatViralProtocolForPrompt } from '../../narrative/viral-story-protocol.js';
import {
  formatStoryRoutePlanForPrompt,
  routeStoryTask,
} from '../../story-router/index.js';
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
} from '../../narrative/types.js';
import {
  countStoryCharacters,
} from '../../story-constraints.js';
import type { OutlineBundle } from '../../types.js';
import { isBookPaused } from '../book/index.js';

const CHAPTER_CONTEXT_MAX_CHARACTERS = 6000;

export type ChapterUpdate = {
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
    ChapterAggregateDeps,
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

export type ChapterAggregateDeps = {
  books: {
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
  storyBibles?: {
    getByBook?: (bookId: string) =>
      | Omit<
          NonNullable<OutlineBundle['narrativeBible']>,
          'characterArcs' | 'relationshipEdges' | 'worldRules' | 'narrativeThreads'
        >
      | null;
  };
  chapterCards?: {
    listByBook?: (bookId: string) => ChapterCard[];
    getNextUnwritten?: (bookId: string) => ChapterCard | null;
    listThreadActions?: (
      bookId: string,
      volumeIndex: number,
      chapterIndex: number
    ) => ChapterThreadAction[];
    listCharacterPressures?: (
      bookId: string,
      volumeIndex: number,
      chapterIndex: number
    ) => ChapterCharacterPressure[];
    listRelationshipActions?: (
      bookId: string,
      volumeIndex: number,
      chapterIndex: number
    ) => ChapterRelationshipAction[];
  };
  chapterTensionBudgets?: {
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
  worldRules?: {
    listByBook: (bookId: string) => NonNullable<OutlineBundle['narrativeBible']>['worldRules'];
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
  relationshipStates?: {
    save: (input: RelationshipStateInput) => void;
  };
  narrativeThreads?: {
    listByBook: (bookId: string) => NonNullable<OutlineBundle['narrativeBible']>['narrativeThreads'];
    upsertThread?: (
      bookId: string,
      thread: NonNullable<OutlineBundle['narrativeBible']>['narrativeThreads'][number]
    ) => void;
    resolveThread?: (bookId: string, threadId: string, resolvedAt: number) => void;
  };
  narrativeStateExtractor?: {
    extractState: (input: {
      modelId: string;
      content: string;
    }) => Promise<NarrativeStateDelta>;
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
  shouldRewriteShortChapter?: (input: {
    content: string;
    wordsPerChapter: number;
  }) => boolean;
  resolveModelId: () => string;
  onBookUpdated?: (bookId: string) => void;
  onGenerationEvent?: (event: BookGenerationEvent) => void;
};

export function createChapterAggregate(deps: ChapterAggregateDeps) {
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

  function findNextChapter(input: {
    bookId: string;
  }): {
    book: NonNullable<ReturnType<ChapterAggregateDeps['books']['getById']>>;
    context: ReturnType<ChapterAggregateDeps['books']['getContext']>;
    chapters: ReturnType<ChapterAggregateDeps['chapters']['listByBook']>;
    nextChapter: NonNullable<ReturnType<ChapterAggregateDeps['chapters']['listByBook']>[number]>;
    chapterCard: ChapterCard | null;
    outline: string;
    title: string;
  } {
    const book = deps.books.getById(input.bookId);
    if (!book) {
      throw new Error(`Book not found: ${input.bookId}`);
    }

    const context = deps.books.getContext(input.bookId);
    const chapters = deps.chapters.listByBook(input.bookId);
    const chapterCards = deps.chapterCards?.listByBook?.(input.bookId) ?? [];
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

    return {
      book,
      context,
      chapters,
      nextChapter,
      chapterCard,
      outline: nextChapterOutline,
      title: nextChapterTitle,
    };
  }

  function buildWriteContext(input: {
    bookId: string;
    book: { idea: string; wordsPerChapter: number; targetChapters: number };
    context: { worldSetting?: string | null; outline?: string | null } | undefined;
    chapters: Array<{
      bookId: string;
      volumeIndex: number;
      chapterIndex: number;
      title: string | null;
      outline: string | null;
      content: string | null;
      summary: string | null;
      wordCount: number;
    }>;
    nextChapter: {
      volumeIndex: number;
      chapterIndex: number;
    };
    nextChapterOutline: string;
    nextChapterTitle: string;
    chapterCard: ChapterCard | null;
  }) {
    const modelId = deps.resolveModelId();
    const storyBible = deps.storyBibles?.getByBook?.(input.bookId) ?? null;
    const effectiveChapterCard = input.chapterCard
      ? {
          ...input.chapterCard,
          title: input.nextChapterTitle,
          plotFunction:
            input.chapterCard.plotFunction.trim() || input.nextChapterOutline,
        }
      : null;
    const tensionBudget =
      effectiveChapterCard && deps.chapterTensionBudgets?.getByChapter
        ? deps.chapterTensionBudgets.getByChapter(
            input.bookId,
            input.nextChapter.volumeIndex,
            input.nextChapter.chapterIndex
          )
        : null;
    const legacyContinuityContext = buildStoredChapterContext({
      worldSetting: input.context?.worldSetting ?? null,
      characterStates: deps.characters.listLatestStatesByBook(input.bookId),
      plotThreads: deps.plotThreads.listByBook(input.bookId),
      latestScene: deps.sceneRecords.getLatestByBook(input.bookId),
      chapters: input.chapters,
      currentChapter: {
        volumeIndex: input.nextChapter.volumeIndex,
        chapterIndex: input.nextChapter.chapterIndex,
        outline: input.nextChapterOutline,
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
                input.bookId,
                input.nextChapter.volumeIndex,
                input.nextChapter.chapterIndex
              )
              .map(
                (pressure) =>
                  `${pressure.characterId}: ${pressure.desirePressure}; ${pressure.fearPressure}; ${pressure.flawTrigger}; expected=${pressure.expectedChoice}`
              ) ?? [],
          relationshipActions:
            deps.chapterCards
              ?.listRelationshipActions?.(
                input.bookId,
                input.nextChapter.volumeIndex,
                input.nextChapter.chapterIndex
              )
              .map(
                (action) =>
                  `${action.relationshipId} ${action.action}: ${action.requiredChange}`
              ) ?? [],
          threadActions:
            deps.chapterCards
              ?.listThreadActions?.(
                input.bookId,
                input.nextChapter.volumeIndex,
                input.nextChapter.chapterIndex
              )
              .map(
                (action) =>
                  `${action.threadId} ${action.action}: ${action.requiredEffect}`
              ) ?? [],
          worldRules:
            deps.worldRules
              ?.listByBook(input.bookId)
              .map((rule) => `${rule.id}: ${rule.ruleText}; cost=${rule.cost}`) ??
            [],
          recentSummaries: input.chapters
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
      input.nextChapter.chapterIndex
    );
    const routePlanText = formatStoryRoutePlanForPrompt({
      ...storyRoutePlan,
      openingRetentionLines,
      viralProtocolLines: storyBible?.viralStoryProtocol
        ? [
            formatViralProtocolForPrompt(storyBible.viralStoryProtocol, {
              chapterIndex: input.nextChapter.chapterIndex,
            }),
          ]
        : [],
    });
    const prompt = effectiveChapterCard
      ? buildNarrativeDraftPrompt({
          idea: input.book.idea,
          wordsPerChapter: input.book.wordsPerChapter,
          commandContext: commandContext ?? legacyContinuityContext,
          routePlanText,
          viralStoryProtocol: storyBible?.viralStoryProtocol ?? null,
          chapterIndex: input.nextChapter.chapterIndex,
        })
      : buildChapterDraftPrompt({
          idea: input.book.idea,
          worldSetting: input.context?.worldSetting ?? null,
          masterOutline: input.context?.outline ?? null,
          continuityContext: legacyContinuityContext,
          chapterTitle: input.nextChapterTitle,
          chapterOutline: input.nextChapterOutline,
          targetChapters: input.book.targetChapters,
          wordsPerChapter: input.book.wordsPerChapter,
          routePlanText,
        });
    return { modelId, storyBible, effectiveChapterCard, tensionBudget, legacyContinuityContext, commandContext, routePlanText, prompt };
  }

  async function writeDraft(input: {
    bookId: string;
    modelId: string;
    prompt: string;
    volumeIndex: number;
    chapterIndex: number;
    title: string;
    wordsPerChapter: number;
  }): Promise<{ result: { content: string; usage?: { inputTokens?: number; outputTokens?: number } }; deleted: boolean; paused: boolean }> {
    const writingStepLabel = `正在写第 ${input.chapterIndex} 章`;

    deps.progress.updatePhase(input.bookId, 'writing', {
      currentVolume: input.volumeIndex,
      currentChapter: input.chapterIndex,
      stepLabel: writingStepLabel,
    });
    deps.onGenerationEvent?.({
      bookId: input.bookId,
      type: 'progress',
      phase: 'writing',
      stepLabel: writingStepLabel,
      currentVolume: input.volumeIndex,
      currentChapter: input.chapterIndex,
    });

    let result = await deps.chapterWriter.writeChapter({
      modelId: input.modelId,
      prompt: input.prompt,
      onChunk: (delta) => {
        if (!isBookPaused(deps, input.bookId)) {
          deps.onGenerationEvent?.({
            bookId: input.bookId,
            type: 'chapter-stream',
            volumeIndex: input.volumeIndex,
            chapterIndex: input.chapterIndex,
            title: input.title,
            delta,
          });
        }
      },
    });

    const bookAfterDraft = deps.books.getById(input.bookId);
    if (!bookAfterDraft) {
      return {
        result,
        deleted: true,
        paused: false,
      };
    }
    if (bookAfterDraft.status === 'paused') {
      deps.progress.updatePhase(input.bookId, 'paused');
      deps.onBookUpdated?.(input.bookId);
      return {
        result,
        deleted: false,
        paused: true,
      };
    }

    if (
      deps.shouldRewriteShortChapter?.({
        content: result.content,
        wordsPerChapter: input.wordsPerChapter,
      })
    ) {
      const rewriteStepLabel = `正在重写第 ${input.chapterIndex} 章`;
      deps.progress.updatePhase(input.bookId, 'writing', {
        currentVolume: input.volumeIndex,
        currentChapter: input.chapterIndex,
        stepLabel: rewriteStepLabel,
      });
      deps.onGenerationEvent?.({
        bookId: input.bookId,
        type: 'progress',
        phase: 'writing',
        stepLabel: rewriteStepLabel,
        currentVolume: input.volumeIndex,
        currentChapter: input.chapterIndex,
      });

      let isFirstRewriteChunk = true;
      result = await deps.chapterWriter.writeChapter({
        modelId: input.modelId,
        prompt: buildShortChapterRewritePrompt({
          originalPrompt: input.prompt,
          wordsPerChapter: input.wordsPerChapter,
          actualWordCount: countStoryCharacters(result.content),
        }),
        onChunk: (delta) => {
          const streamEvent: BookGenerationEvent = {
            bookId: input.bookId,
            type: 'chapter-stream',
            volumeIndex: input.volumeIndex,
            chapterIndex: input.chapterIndex,
            title: input.title,
            delta,
            ...(isFirstRewriteChunk ? { replace: true } : {}),
          };
          if (!isBookPaused(deps, input.bookId)) {
            deps.onGenerationEvent?.(streamEvent);
          }
          isFirstRewriteChunk = false;
        },
      });
    }

    const bookAfterFinalDraft = deps.books.getById(input.bookId);
    if (!bookAfterFinalDraft) {
      return {
        result,
        deleted: true,
        paused: false,
      };
    }
    if (bookAfterFinalDraft.status === 'paused') {
      deps.progress.updatePhase(input.bookId, 'paused');
      deps.onBookUpdated?.(input.bookId);
      return {
        result,
        deleted: false,
        paused: true,
      };
    }

    return { result, deleted: false, paused: false };
  }

  async function auditAndRevise(input: {
    bookId: string;
    modelId: string;
    content: string;
    prompt: string;
    commandContext: string | null;
    legacyContinuityContext: string;
    routePlanText: string;
    storyBible: {
      viralStoryProtocol?: ViralStoryProtocol | null;
    } | null;
    volumeIndex: number;
    chapterIndex: number;
    effectiveChapterCard: ChapterCard | null;
  }): Promise<{ result: { content: string; usage?: { inputTokens?: number; outputTokens?: number } }; auditScore: number | null; draftAttempts: number }> {
    let result: { content: string; usage?: { inputTokens?: number; outputTokens?: number } } = { content: input.content, usage: undefined };
    let auditScore: number | null = null;
    let draftAttempts = 1;
    if (deps.chapterAuditor && input.effectiveChapterCard) {
      const auditContext = input.commandContext ?? input.legacyContinuityContext;
      const auditStepLabel = `正在审校第 ${input.chapterIndex} 章叙事质量`;
      updateTrackedPhase({
        bookId: input.bookId,
        phase: 'auditing_chapter',
        stepLabel: auditStepLabel,
        currentVolume: input.volumeIndex,
        currentChapter: input.chapterIndex,
      });
      let audit = await deps.chapterAuditor.auditChapter({
        modelId: input.modelId,
        draft: result.content,
        auditContext,
        routePlanText: input.routePlanText,
        viralStoryProtocol: input.storyBible?.viralStoryProtocol ?? null,
        chapterIndex: input.chapterIndex,
      });
      deps.chapterAudits?.save({
        bookId: input.bookId,
        volumeIndex: input.volumeIndex,
        chapterIndex: input.chapterIndex,
        attempt: draftAttempts,
        audit,
      });

      const auditAction = decideAuditAction(audit, {
        chapterIndex: input.chapterIndex,
      });
      if (auditAction !== 'accept' && deps.chapterRevision) {
        draftAttempts += 1;
        const revisionStepLabel = `正在修订第 ${input.chapterIndex} 章`;
        updateTrackedPhase({
          bookId: input.bookId,
          phase: 'revising_chapter',
          stepLabel: revisionStepLabel,
          currentVolume: input.volumeIndex,
          currentChapter: input.chapterIndex,
        });
        result = {
          ...result,
          content: await deps.chapterRevision.reviseChapter({
            modelId: input.modelId,
            originalPrompt: input.prompt,
            draft: result.content,
            issues: audit.issues,
          }),
        };
        const reauditStepLabel = `正在复审第 ${input.chapterIndex} 章叙事质量`;
        updateTrackedPhase({
          bookId: input.bookId,
          phase: 'auditing_chapter',
          stepLabel: reauditStepLabel,
          currentVolume: input.volumeIndex,
          currentChapter: input.chapterIndex,
        });
        audit = await deps.chapterAuditor.auditChapter({
          modelId: input.modelId,
          draft: result.content,
          auditContext,
          routePlanText: input.routePlanText,
          viralStoryProtocol: input.storyBible?.viralStoryProtocol ?? null,
          chapterIndex: input.chapterIndex,
        });
        deps.chapterAudits?.save({
          bookId: input.bookId,
          volumeIndex: input.volumeIndex,
          chapterIndex: input.chapterIndex,
          attempt: draftAttempts,
          audit,
        });
      }

      auditScore = audit.score;
    }
    return { result, auditScore, draftAttempts };
  }

  async function extractAndSaveContinuity(input: {
    bookId: string;
    modelId: string;
    content: string;
    volumeIndex: number;
    chapterIndex: number;
    auditScore: number | null;
    draftAttempts: number;
  }): Promise<{ deleted: boolean }> {
    const postChapterStepLabel = `正在生成第 ${input.chapterIndex} 章摘要与连续性`;
    updateTrackedPhase({
      bookId: input.bookId,
      phase: 'extracting_continuity',
      stepLabel: postChapterStepLabel,
      currentVolume: input.volumeIndex,
      currentChapter: input.chapterIndex,
    });

    const chapterUpdate = await extractChapterUpdate({
      modelId: input.modelId,
      chapterIndex: input.chapterIndex,
      content: input.content,
      deps,
    });

    if (!deps.books.getById(input.bookId)) {
      return {
        deleted: true as const,
      };
    }

    deps.chapters.saveContent({
      bookId: input.bookId,
      volumeIndex: input.volumeIndex,
      chapterIndex: input.chapterIndex,
      content: input.content,
      summary: chapterUpdate.summary,
      wordCount: countStoryCharacters(input.content),
      auditScore: input.auditScore,
      draftAttempts: input.draftAttempts,
    });

    for (const thread of chapterUpdate.openedThreads) {
      deps.plotThreads.upsertThread({
        id: thread.id,
        bookId: input.bookId,
        description: thread.description,
        plantedAt: thread.plantedAt,
        expectedPayoff: thread.expectedPayoff ?? null,
        importance: thread.importance ?? 'normal',
      });
    }

    for (const threadId of chapterUpdate.resolvedThreadIds) {
      deps.plotThreads.resolveThread(input.bookId, threadId, input.chapterIndex);
    }

    for (const state of chapterUpdate.characterStates) {
      deps.characters.saveState({
        bookId: input.bookId,
        characterId: state.characterId,
        characterName: state.characterName,
        volumeIndex: input.volumeIndex,
        chapterIndex: input.chapterIndex,
        location: state.location ?? null,
        status: state.status ?? null,
        knowledge: state.knowledge ?? null,
        emotion: state.emotion ?? null,
        powerLevel: state.powerLevel ?? null,
      });
    }

    if (chapterUpdate.scene) {
      deps.sceneRecords.save({
        bookId: input.bookId,
        volumeIndex: input.volumeIndex,
        chapterIndex: input.chapterIndex,
        location: chapterUpdate.scene.location,
        timeInStory: chapterUpdate.scene.timeInStory,
        charactersPresent: chapterUpdate.scene.charactersPresent,
        events: chapterUpdate.scene.events ?? null,
      });
    }

    return { deleted: false };
  }

  async function extractNarrativeState(input: {
    bookId: string;
    modelId: string;
    content: string;
    volumeIndex: number;
    chapterIndex: number;
  }): Promise<void> {
    if (deps.narrativeStateExtractor) {
      const stateStepLabel = `正在提取第 ${input.chapterIndex} 章叙事状态`;
      updateTrackedPhase({
        bookId: input.bookId,
        phase: 'extracting_state',
        stepLabel: stateStepLabel,
        currentVolume: input.volumeIndex,
        currentChapter: input.chapterIndex,
      });
      const delta = await deps.narrativeStateExtractor.extractState({
        modelId: input.modelId,
        content: input.content,
      });
      for (const state of delta.characterStates) {
        deps.characterArcs?.saveState?.({
          ...state,
          bookId: input.bookId,
          volumeIndex: input.volumeIndex,
          chapterIndex: input.chapterIndex,
        });
      }
      for (const state of delta.relationshipStates) {
        deps.relationshipStates?.save({
          ...state,
          bookId: input.bookId,
          volumeIndex: input.volumeIndex,
          chapterIndex: input.chapterIndex,
        });
      }
      for (const threadUpdate of delta.threadUpdates) {
        const existingThread = deps.narrativeThreads
          ?.listByBook(input.bookId)
          .find((thread) => thread.id === threadUpdate.threadId);
        if (existingThread && deps.narrativeThreads?.upsertThread) {
          deps.narrativeThreads.upsertThread(input.bookId, {
            ...existingThread,
            currentState: threadUpdate.currentState,
            resolvedAt: threadUpdate.resolvedAt ?? existingThread.resolvedAt,
            notes: threadUpdate.notes ?? existingThread.notes,
          });
        }
        if (threadUpdate.resolvedAt && deps.narrativeThreads?.resolveThread) {
          deps.narrativeThreads.resolveThread(
            input.bookId,
            threadUpdate.threadId,
            threadUpdate.resolvedAt
          );
        }
      }
    }
  }

  async function runCheckpoint(input: {
    bookId: string;
    volumeIndex: number;
    chapterIndex: number;
  }): Promise<void> {
    if (
      deps.narrativeCheckpoint &&
      deps.narrativeCheckpoints &&
      shouldRunNarrativeCheckpoint(input.chapterIndex)
    ) {
      const checkpointStepLabel = `正在复盘第 ${input.chapterIndex} 章叙事状态`;
      deps.progress.updatePhase(input.bookId, 'checkpoint_review', {
        currentVolume: input.volumeIndex,
        currentChapter: input.chapterIndex,
        stepLabel: checkpointStepLabel,
      });
      emitProgress({
        bookId: input.bookId,
        phase: 'checkpoint_review',
        stepLabel: checkpointStepLabel,
        currentVolume: input.volumeIndex,
        currentChapter: input.chapterIndex,
      });
      const checkpoint = await deps.narrativeCheckpoint.reviewCheckpoint({
        bookId: input.bookId,
        chapterIndex: input.chapterIndex,
      });
      const tensionCheckpoint =
        deps.chapterTensionBudgets?.listByBook &&
        deps.chapterAudits?.listLatestByBook
          ? buildTensionCheckpoint({
              chapterIndex: input.chapterIndex,
              budgets: deps.chapterTensionBudgets.listByBook(input.bookId),
              audits: deps.chapterAudits.listLatestByBook(input.bookId),
            })
          : null;
      deps.narrativeCheckpoints.save({
        bookId: input.bookId,
        chapterIndex: input.chapterIndex,
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
  }

  async function writeNext(bookId: string) {
    const {
      book,
      context,
      chapters,
      nextChapter,
      chapterCard,
      outline: nextChapterOutline,
      title: nextChapterTitle,
    } = findNextChapter({ bookId });

    const {
      modelId,
      storyBible,
      effectiveChapterCard,
      legacyContinuityContext,
      commandContext,
      routePlanText,
      prompt,
    } = buildWriteContext({
      bookId,
      book,
      context,
      chapters,
      nextChapter,
      nextChapterOutline,
      nextChapterTitle,
      chapterCard,
    });

    const draftResult = await writeDraft({
      bookId,
      modelId,
      prompt,
      volumeIndex: nextChapter.volumeIndex,
      chapterIndex: nextChapter.chapterIndex,
      title: nextChapterTitle,
      wordsPerChapter: book.wordsPerChapter,
    });
    if (draftResult.deleted) {
      return {
        deleted: true as const,
      };
    }
    if (draftResult.paused) {
      return {
        paused: true as const,
      };
    }
    let result = draftResult.result;

    const { result: auditedResult, auditScore, draftAttempts } = await auditAndRevise({
      bookId,
      modelId,
      content: result.content,
      prompt,
      commandContext,
      legacyContinuityContext,
      routePlanText,
      storyBible,
      volumeIndex: nextChapter.volumeIndex,
      chapterIndex: nextChapter.chapterIndex,
      effectiveChapterCard,
    });
    result = auditedResult;

    const continuityResult = await extractAndSaveContinuity({
      bookId,
      modelId,
      content: result.content,
      volumeIndex: nextChapter.volumeIndex,
      chapterIndex: nextChapter.chapterIndex,
      auditScore,
      draftAttempts,
    });
    if (continuityResult.deleted) {
      return {
        deleted: true as const,
      };
    }

    await extractNarrativeState({
      bookId,
      modelId,
      content: result.content,
      volumeIndex: nextChapter.volumeIndex,
      chapterIndex: nextChapter.chapterIndex,
    });

    await runCheckpoint({
      bookId,
      volumeIndex: nextChapter.volumeIndex,
      chapterIndex: nextChapter.chapterIndex,
    });

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
      stepLabel: `正在生成第 ${nextChapter.chapterIndex} 章摘要与连续性`,
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
  }

  return {
    writeNext,
  };
}
