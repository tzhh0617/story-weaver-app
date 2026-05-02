import { asc, eq } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import { stagePlans } from '../db/schema/index.js';
import type { VolumePlan } from '../core/narrative/types.js';

type StageBridgePayload = Pick<
  VolumePlan,
  'title' | 'roleInStory' | 'mainPressure' | 'promisedPayoff' | 'characterArcMovement' | 'relationshipMovement' | 'worldExpansion' | 'endingTurn'
>;

function encodePlanPayload(plan: VolumePlan) {
  const payload: StageBridgePayload = {
    title: plan.title,
    roleInStory: plan.roleInStory,
    mainPressure: plan.mainPressure,
    promisedPayoff: plan.promisedPayoff,
    characterArcMovement: plan.characterArcMovement,
    relationshipMovement: plan.relationshipMovement,
    worldExpansion: plan.worldExpansion,
    endingTurn: plan.endingTurn,
  };

  return {
    objective: plan.title,
    primaryResistance: plan.mainPressure,
    pressureCurve: plan.roleInStory,
    escalation: plan.characterArcMovement,
    climax: plan.endingTurn,
    payoff: plan.promisedPayoff,
    irreversibleChange: plan.relationshipMovement,
    nextQuestion: plan.worldExpansion,
    titleIdeaFocus: plan.title,
    compressionTrigger: JSON.stringify(payload),
  };
}

function decodePlanRow(row: {
  stageIndex: number;
  chapterStart: number;
  chapterEnd: number;
  pressureCurve: string;
  compressionTrigger: string;
}): VolumePlan {
  const payload = JSON.parse(row.compressionTrigger) as StageBridgePayload;

  return {
    volumeIndex: row.stageIndex,
    title: payload.title,
    chapterStart: row.chapterStart,
    chapterEnd: row.chapterEnd,
    roleInStory: payload.roleInStory ?? row.pressureCurve,
    mainPressure: payload.mainPressure,
    promisedPayoff: payload.promisedPayoff,
    characterArcMovement: payload.characterArcMovement,
    relationshipMovement: payload.relationshipMovement,
    worldExpansion: payload.worldExpansion,
    endingTurn: payload.endingTurn,
  };
}

export function createVolumePlanRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  return {
    upsertMany(bookId: string, plans: VolumePlan[]) {
      for (const plan of plans) {
        const encoded = encodePlanPayload(plan);
        drizzleDb
          .insert(stagePlans)
          .values({
            bookId,
            stageIndex: plan.volumeIndex,
            chapterStart: plan.chapterStart,
            chapterEnd: plan.chapterEnd,
            chapterBudget: Math.max(0, plan.chapterEnd - plan.chapterStart + 1),
            ...encoded,
            status: 'planned',
          })
          .onConflictDoUpdate({
            target: [stagePlans.bookId, stagePlans.stageIndex],
            set: {
              chapterStart: plan.chapterStart,
              chapterEnd: plan.chapterEnd,
              chapterBudget: Math.max(0, plan.chapterEnd - plan.chapterStart + 1),
              ...encoded,
              status: 'planned',
            },
          })
          .run();
      }
    },

    listByBook(bookId: string): VolumePlan[] {
      const rows = drizzleDb
        .select({
          stageIndex: stagePlans.stageIndex,
          chapterStart: stagePlans.chapterStart,
          chapterEnd: stagePlans.chapterEnd,
          pressureCurve: stagePlans.pressureCurve,
          compressionTrigger: stagePlans.compressionTrigger,
        })
        .from(stagePlans)
        .where(eq(stagePlans.bookId, bookId))
        .orderBy(asc(stagePlans.stageIndex))
        .all() as Array<{
        stageIndex: number;
        chapterStart: number;
        chapterEnd: number;
        pressureCurve: string;
        compressionTrigger: string;
      }>;

      return rows.map(decodePlanRow);
    },
  };
}
