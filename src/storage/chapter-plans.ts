import { asc, eq } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import { chapterPlans } from '../db/schema/index.js';

type CompatibleThreadActionsPayload = {
  title: string;
  plotFunction: string;
  povCharacterId: string | null;
  externalConflict: string;
  internalConflict: string;
  relationshipChange: string;
  worldRuleUsedOrTested: string;
  informationReveal: string;
  readerReward: string;
  endingHook: string;
  mustChange: string;
  forbiddenMoves: string[];
  plannerThreadActions: unknown;
};

function encodeThreadActions(plan: {
  batchGoal: string;
  goal: string;
  conflict: string;
  pressureSource: string;
  changeType: string;
  titleIdeaLink: string;
  reveal: string;
  requiredPayoffs: unknown;
  endingHook: string;
  payoffOrCost: string;
  forbiddenDrift: unknown;
  threadActions: unknown;
}) {
  const reward =
    Array.isArray(plan.requiredPayoffs) && typeof plan.requiredPayoffs[0] === 'string'
      ? plan.requiredPayoffs[0]
      : 'truth';
  const forbiddenMoves = Array.isArray(plan.forbiddenDrift)
    ? plan.forbiddenDrift.filter((item): item is string => typeof item === 'string')
    : [];

  const payload: CompatibleThreadActionsPayload = {
    title: plan.batchGoal,
    plotFunction: plan.goal,
    povCharacterId: null,
    externalConflict: plan.conflict,
    internalConflict: plan.pressureSource,
    relationshipChange: plan.changeType,
    worldRuleUsedOrTested: plan.titleIdeaLink,
    informationReveal: plan.reveal,
    readerReward: reward,
    endingHook: plan.endingHook,
    mustChange: plan.payoffOrCost,
    forbiddenMoves,
    plannerThreadActions: plan.threadActions,
  };

  return JSON.stringify(payload);
}

function decodeThreadActions(value: string) {
  const parsed = JSON.parse(value) as CompatibleThreadActionsPayload | unknown;

  if (
    parsed &&
    typeof parsed === 'object' &&
    'plannerThreadActions' in parsed
  ) {
    return parsed.plannerThreadActions;
  }

  return parsed;
}

export function createChapterPlanRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  return {
    upsertMany(
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
    ) {
      for (const plan of plans) {
        drizzleDb
          .insert(chapterPlans)
          .values({
            bookId,
            batchIndex: plan.batchIndex,
            chapterIndex: plan.chapterIndex,
            arcIndex: plan.arcIndex,
            goal: plan.goal,
            conflict: plan.conflict,
            pressureSource: plan.pressureSource,
            changeType: plan.changeType,
            threadActionsJson: encodeThreadActions(plan),
            reveal: plan.reveal,
            payoffOrCost: plan.payoffOrCost,
            endingHook: plan.endingHook,
            titleIdeaLink: plan.titleIdeaLink,
            batchGoal: plan.batchGoal,
            requiredPayoffsJson: JSON.stringify(plan.requiredPayoffs),
            forbiddenDriftJson: JSON.stringify(plan.forbiddenDrift),
            status: plan.status ?? 'planned',
          })
          .onConflictDoUpdate({
            target: [chapterPlans.bookId, chapterPlans.chapterIndex],
            set: {
              batchIndex: plan.batchIndex,
              arcIndex: plan.arcIndex,
              goal: plan.goal,
              conflict: plan.conflict,
              pressureSource: plan.pressureSource,
              changeType: plan.changeType,
              threadActionsJson: encodeThreadActions(plan),
              reveal: plan.reveal,
              payoffOrCost: plan.payoffOrCost,
              endingHook: plan.endingHook,
              titleIdeaLink: plan.titleIdeaLink,
              batchGoal: plan.batchGoal,
              requiredPayoffsJson: JSON.stringify(plan.requiredPayoffs),
              forbiddenDriftJson: JSON.stringify(plan.forbiddenDrift),
              status: plan.status ?? 'planned',
            },
          })
          .run();
      }
    },

    listByBook(bookId: string) {
      const rows = drizzleDb
        .select({
          batchIndex: chapterPlans.batchIndex,
          chapterIndex: chapterPlans.chapterIndex,
          arcIndex: chapterPlans.arcIndex,
          goal: chapterPlans.goal,
          conflict: chapterPlans.conflict,
          pressureSource: chapterPlans.pressureSource,
          changeType: chapterPlans.changeType,
          threadActionsJson: chapterPlans.threadActionsJson,
          reveal: chapterPlans.reveal,
          payoffOrCost: chapterPlans.payoffOrCost,
          endingHook: chapterPlans.endingHook,
          titleIdeaLink: chapterPlans.titleIdeaLink,
          batchGoal: chapterPlans.batchGoal,
          requiredPayoffsJson: chapterPlans.requiredPayoffsJson,
          forbiddenDriftJson: chapterPlans.forbiddenDriftJson,
          status: chapterPlans.status,
        })
        .from(chapterPlans)
        .where(eq(chapterPlans.bookId, bookId))
        .orderBy(asc(chapterPlans.batchIndex), asc(chapterPlans.chapterIndex))
        .all() as Array<{
        batchIndex: number;
        chapterIndex: number;
        arcIndex: number;
        goal: string;
        conflict: string;
        pressureSource: string;
        changeType: string;
        threadActionsJson: string;
        reveal: string;
        payoffOrCost: string;
        endingHook: string;
        titleIdeaLink: string;
        batchGoal: string;
        requiredPayoffsJson: string;
        forbiddenDriftJson: string;
        status: string;
      }>;

      return rows.map((row) => ({
        batchIndex: row.batchIndex,
        chapterIndex: row.chapterIndex,
        arcIndex: row.arcIndex,
        goal: row.goal,
        conflict: row.conflict,
        pressureSource: row.pressureSource,
        changeType: row.changeType,
        threadActions: decodeThreadActions(row.threadActionsJson),
        reveal: row.reveal,
        payoffOrCost: row.payoffOrCost,
        endingHook: row.endingHook,
        titleIdeaLink: row.titleIdeaLink,
        batchGoal: row.batchGoal,
        requiredPayoffs: JSON.parse(row.requiredPayoffsJson) as unknown,
        forbiddenDrift: JSON.parse(row.forbiddenDriftJson) as unknown,
        status: row.status,
      }));
    },
  };
}
