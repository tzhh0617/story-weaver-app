import { routeStoryTask } from '../../story-router/index.js';
import type {
  ChapterCard,
  ChapterTensionBudget,
  NarrativeAudit,
} from '../../narrative/types.js';
import type { OutlineBundle } from '../../types.js';
import {
  FLATNESS_ISSUE_TYPES,
  VIRAL_ISSUE_TYPES,
  calculateFlatnessScore,
  calculateViralScore,
} from './book-scoring.js';
import { toStoryRoutePlanView } from './book-views.js';

type ProjectionDeps = {
  books: {
    getById: (bookId: string) =>
      | {
          id: string;
          title: string;
          idea: string;
          status: string;
          targetChapters: number;
          wordsPerChapter: number;
          viralStrategy?: import('@story-weaver/shared/contracts').BookRecord['viralStrategy'];
          createdAt: string;
          updatedAt: string;
        }
      | undefined;
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
  storyBibles?: {
    getByBook?: (bookId: string) =>
      | Omit<
          NonNullable<OutlineBundle['narrativeBible']>,
          'characterArcs' | 'relationshipEdges' | 'worldRules' | 'narrativeThreads'
        >
      | null;
  };
  characterArcs?: {
    listByBook: (bookId: string) => NonNullable<OutlineBundle['narrativeBible']>['characterArcs'];
  };
  relationshipEdges?: {
    listByBook: (bookId: string) => NonNullable<OutlineBundle['narrativeBible']>['relationshipEdges'];
  };
  worldRules?: {
    listByBook: (bookId: string) => NonNullable<OutlineBundle['narrativeBible']>['worldRules'];
  };
  narrativeThreads?: {
    listByBook: (bookId: string) => NonNullable<OutlineBundle['narrativeBible']>['narrativeThreads'];
  };
  volumePlans?: {
    listByBook?: (bookId: string) => NonNullable<OutlineBundle['volumePlans']>;
  };
  chapterCards?: {
    listByBook?: (bookId: string) => ChapterCard[];
  };
  chapterTensionBudgets?: {
    listByBook?: (bookId: string) => ChapterTensionBudget[];
  };
  chapterAudits?: {
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
  narrativeCheckpoints?: {
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
  };
};

export function buildBookDetailProjection(deps: ProjectionDeps, bookId: string) {
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
}
