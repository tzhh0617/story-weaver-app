import { asc, eq } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import { stagePlans } from '../db/schema/index.js';

export function createStagePlanRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  return {
    upsertMany(
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
    ) {
      for (const plan of plans) {
        drizzleDb
          .insert(stagePlans)
          .values({
            bookId,
            stageIndex: plan.stageIndex,
            chapterStart: plan.chapterStart,
            chapterEnd: plan.chapterEnd,
            chapterBudget: plan.chapterBudget,
            objective: plan.objective,
            primaryResistance: plan.primaryResistance,
            pressureCurve: plan.pressureCurve,
            escalation: plan.escalation,
            climax: plan.climax,
            payoff: plan.payoff,
            irreversibleChange: plan.irreversibleChange,
            nextQuestion: plan.nextQuestion,
            titleIdeaFocus: plan.titleIdeaFocus,
            compressionTrigger: plan.compressionTrigger,
            status: plan.status ?? 'planned',
          })
          .onConflictDoUpdate({
            target: [stagePlans.bookId, stagePlans.stageIndex],
            set: {
              chapterStart: plan.chapterStart,
              chapterEnd: plan.chapterEnd,
              chapterBudget: plan.chapterBudget,
              objective: plan.objective,
              primaryResistance: plan.primaryResistance,
              pressureCurve: plan.pressureCurve,
              escalation: plan.escalation,
              climax: plan.climax,
              payoff: plan.payoff,
              irreversibleChange: plan.irreversibleChange,
              nextQuestion: plan.nextQuestion,
              titleIdeaFocus: plan.titleIdeaFocus,
              compressionTrigger: plan.compressionTrigger,
              status: plan.status ?? 'planned',
            },
          })
          .run();
      }
    },

    listByBook(bookId: string) {
      return drizzleDb
        .select({
          stageIndex: stagePlans.stageIndex,
          chapterStart: stagePlans.chapterStart,
          chapterEnd: stagePlans.chapterEnd,
          chapterBudget: stagePlans.chapterBudget,
          objective: stagePlans.objective,
          primaryResistance: stagePlans.primaryResistance,
          pressureCurve: stagePlans.pressureCurve,
          escalation: stagePlans.escalation,
          climax: stagePlans.climax,
          payoff: stagePlans.payoff,
          irreversibleChange: stagePlans.irreversibleChange,
          nextQuestion: stagePlans.nextQuestion,
          titleIdeaFocus: stagePlans.titleIdeaFocus,
          compressionTrigger: stagePlans.compressionTrigger,
          status: stagePlans.status,
        })
        .from(stagePlans)
        .where(eq(stagePlans.bookId, bookId))
        .orderBy(asc(stagePlans.stageIndex))
        .all();
    },
  };
}
