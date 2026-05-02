import { asc, eq } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import { volumePlans } from '../db/schema/index.js';
import type { VolumePlan } from '../core/narrative/types.js';

export function createVolumePlanRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  return {
    upsertMany(bookId: string, plans: VolumePlan[]) {
      for (const plan of plans) {
        drizzleDb
          .insert(volumePlans)
          .values({ ...plan, bookId })
          .onConflictDoUpdate({
            target: [volumePlans.bookId, volumePlans.volumeIndex],
            set: {
              title: plan.title,
              chapterStart: plan.chapterStart,
              chapterEnd: plan.chapterEnd,
              roleInStory: plan.roleInStory,
              mainPressure: plan.mainPressure,
              promisedPayoff: plan.promisedPayoff,
              characterArcMovement: plan.characterArcMovement,
              relationshipMovement: plan.relationshipMovement,
              worldExpansion: plan.worldExpansion,
              endingTurn: plan.endingTurn,
            },
          })
          .run();
      }
    },

    listByBook(bookId: string): VolumePlan[] {
      return drizzleDb
        .select({
          volumeIndex: volumePlans.volumeIndex,
          title: volumePlans.title,
          chapterStart: volumePlans.chapterStart,
          chapterEnd: volumePlans.chapterEnd,
          roleInStory: volumePlans.roleInStory,
          mainPressure: volumePlans.mainPressure,
          promisedPayoff: volumePlans.promisedPayoff,
          characterArcMovement: volumePlans.characterArcMovement,
          relationshipMovement: volumePlans.relationshipMovement,
          worldExpansion: volumePlans.worldExpansion,
          endingTurn: volumePlans.endingTurn,
        })
        .from(volumePlans)
        .where(eq(volumePlans.bookId, bookId))
        .orderBy(asc(volumePlans.volumeIndex))
        .all() as VolumePlan[];
    },
  };
}
