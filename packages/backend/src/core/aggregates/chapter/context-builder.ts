import { buildStoredChapterContext } from '../../consistency.js';
import {
  buildChapterDraftPrompt,
  buildNarrativeDraftPrompt,
} from '../../prompt-builder.js';
import { buildNarrativeCommandContext } from '../../narrative/context.js';
import { buildOpeningRetentionContextLines } from '../../narrative/opening-retention.js';
import type {
  ChapterCard,
  ChapterCharacterPressure,
  ChapterRelationshipAction,
  ChapterTensionBudget,
  ChapterThreadAction,
} from '../../narrative/types.js';
import { formatViralProtocolForPrompt } from '../../narrative/viral-story-protocol.js';
import {
  formatStoryRoutePlanForPrompt,
  routeStoryTask,
} from '../../story-router/index.js';
import type { OutlineBundle } from '../../types.js';
import { CHAPTER_CONTEXT_MAX_CHARACTERS } from './chapter-types.js';

export type ContextBuilderDeps = {
  resolveModelId: () => string;
  storyBibles?: {
    getByBook?: (bookId: string) =>
      | Omit<
          NonNullable<OutlineBundle['narrativeBible']>,
          'characterArcs' | 'relationshipEdges' | 'worldRules' | 'narrativeThreads'
        >
      | null;
  };
  chapterCards?: {
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
  };
  characters: {
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
  sceneRecords: {
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
  worldRules?: {
    listByBook: (bookId: string) => NonNullable<OutlineBundle['narrativeBible']>['worldRules'];
  };
};

export type WriteContextResult = {
  modelId: string;
  storyBible: Omit<
    NonNullable<OutlineBundle['narrativeBible']>,
    'characterArcs' | 'relationshipEdges' | 'worldRules' | 'narrativeThreads'
  > | null;
  effectiveChapterCard: (ChapterCard & { title: string; plotFunction: string }) | null;
  tensionBudget: ChapterTensionBudget | null;
  legacyContinuityContext: string;
  commandContext: string | null;
  routePlanText: string;
  prompt: string;
};

export function createContextBuilder(deps: ContextBuilderDeps) {
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
  }): WriteContextResult {
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

  return { buildWriteContext };
}
