import { randomUUID } from 'node:crypto';
import type { BookRecord, BookStatus, StoryRoutePlanView } from '@story-weaver/shared/contracts';
import { routeStoryTask } from '../../story-router/index.js';
import type { StoryRoutePlan, StorySkill } from '../../story-router/index.js';
import type {
  ChapterCard,
  ChapterTensionBudget,
  NarrativeAudit,
} from '../../narrative/types.js';
import type { OutlineBundle } from '../../types.js';
import { assertPositiveIntegerLimit } from '../../story-constraints.js';
import { INITIAL_BOOK_TITLE } from './book-state.js';

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

const FLATNESS_ISSUE_TYPES = new Set<NarrativeAudit['issues'][number]['type']>([
  'flat_chapter',
  'weak_choice_pressure',
  'missing_consequence',
  'soft_hook',
  'repeated_tension_pattern',
]);

const VIRAL_ISSUE_TYPES = new Set<NarrativeAudit['issues'][number]['type']>([
  'weak_reader_promise',
  'unclear_desire',
  'missing_payoff',
  'payoff_without_cost',
  'generic_trope',
  'weak_reader_question',
  'stale_hook_engine',
]);

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

export type BookAggregateDeps = {
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
    delete: (bookId: string) => void;
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
    listProgressByBookIds?: (
      bookIds: string[]
    ) => Map<string, { completedChapters: number; totalChapters: number }>;
    deleteByBook: (bookId: string) => void;
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
    clearByBook: (bookId: string) => void;
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
    clearStatesByBook: (bookId: string) => void;
    deleteByBook: (bookId: string) => void;
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
    clearByBook: (bookId: string) => void;
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
  onBookUpdated?: (bookId: string) => void;
};

export function createBookAggregate(deps: BookAggregateDeps) {
  return {
    createBook(input: {
      idea: string;
      targetChapters: number;
      wordsPerChapter: number;
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
    },

    pauseBook(bookId: string) {
      const book = deps.books.getById(bookId);
      if (!book) {
        throw new Error(`Book not found: ${bookId}`);
      }

      deps.books.updateStatus(bookId, 'paused');
      deps.progress.updatePhase(bookId, 'paused');
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
  };
}
