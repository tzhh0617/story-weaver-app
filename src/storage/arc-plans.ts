import { asc, eq } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import { arcPlans } from '../db/schema/index.js';

export function createArcPlanRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  return {
    upsertMany(
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
    ) {
      for (const plan of plans) {
        drizzleDb
          .insert(arcPlans)
          .values({
            bookId,
            arcIndex: plan.arcIndex,
            stageIndex: plan.stageIndex,
            chapterStart: plan.chapterStart,
            chapterEnd: plan.chapterEnd,
            chapterBudget: plan.chapterBudget,
            primaryThreadsJson: JSON.stringify(plan.primaryThreads),
            characterTurnsJson: JSON.stringify(plan.characterTurns),
            threadActionsJson: JSON.stringify(plan.threadActions),
            targetOutcome: plan.targetOutcome,
            escalationMode: plan.escalationMode,
            turningPoint: plan.turningPoint,
            requiredPayoff: plan.requiredPayoff,
            resultingInstability: plan.resultingInstability,
            titleIdeaFocus: plan.titleIdeaFocus,
            minChapterCount: plan.minChapterCount,
            maxChapterCount: plan.maxChapterCount,
            status: plan.status ?? 'planned',
          })
          .onConflictDoUpdate({
            target: [arcPlans.bookId, arcPlans.arcIndex],
            set: {
              stageIndex: plan.stageIndex,
              chapterStart: plan.chapterStart,
              chapterEnd: plan.chapterEnd,
              chapterBudget: plan.chapterBudget,
              primaryThreadsJson: JSON.stringify(plan.primaryThreads),
              characterTurnsJson: JSON.stringify(plan.characterTurns),
              threadActionsJson: JSON.stringify(plan.threadActions),
              targetOutcome: plan.targetOutcome,
              escalationMode: plan.escalationMode,
              turningPoint: plan.turningPoint,
              requiredPayoff: plan.requiredPayoff,
              resultingInstability: plan.resultingInstability,
              titleIdeaFocus: plan.titleIdeaFocus,
              minChapterCount: plan.minChapterCount,
              maxChapterCount: plan.maxChapterCount,
              status: plan.status ?? 'planned',
            },
          })
          .run();
      }
    },

    listByBook(bookId: string) {
      const rows = drizzleDb
        .select({
          arcIndex: arcPlans.arcIndex,
          stageIndex: arcPlans.stageIndex,
          chapterStart: arcPlans.chapterStart,
          chapterEnd: arcPlans.chapterEnd,
          chapterBudget: arcPlans.chapterBudget,
          primaryThreadsJson: arcPlans.primaryThreadsJson,
          characterTurnsJson: arcPlans.characterTurnsJson,
          threadActionsJson: arcPlans.threadActionsJson,
          targetOutcome: arcPlans.targetOutcome,
          escalationMode: arcPlans.escalationMode,
          turningPoint: arcPlans.turningPoint,
          requiredPayoff: arcPlans.requiredPayoff,
          resultingInstability: arcPlans.resultingInstability,
          titleIdeaFocus: arcPlans.titleIdeaFocus,
          minChapterCount: arcPlans.minChapterCount,
          maxChapterCount: arcPlans.maxChapterCount,
          status: arcPlans.status,
        })
        .from(arcPlans)
        .where(eq(arcPlans.bookId, bookId))
        .orderBy(asc(arcPlans.arcIndex))
        .all() as Array<{
        arcIndex: number;
        stageIndex: number;
        chapterStart: number;
        chapterEnd: number;
        chapterBudget: number;
        primaryThreadsJson: string;
        characterTurnsJson: string;
        threadActionsJson: string;
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

      return rows.map((row) => ({
        arcIndex: row.arcIndex,
        stageIndex: row.stageIndex,
        chapterStart: row.chapterStart,
        chapterEnd: row.chapterEnd,
        chapterBudget: row.chapterBudget,
        primaryThreads: JSON.parse(row.primaryThreadsJson) as unknown,
        characterTurns: JSON.parse(row.characterTurnsJson) as unknown,
        threadActions: JSON.parse(row.threadActionsJson) as unknown,
        targetOutcome: row.targetOutcome,
        escalationMode: row.escalationMode,
        turningPoint: row.turningPoint,
        requiredPayoff: row.requiredPayoff,
        resultingInstability: row.resultingInstability,
        titleIdeaFocus: row.titleIdeaFocus,
        minChapterCount: row.minChapterCount,
        maxChapterCount: row.maxChapterCount,
        status: row.status,
      }));
    },
  };
}
