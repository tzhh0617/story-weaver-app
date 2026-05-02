import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import {
  characterArcs,
  characterStates,
} from '../db/schema/index.js';
import type {
  CharacterArc,
  CharacterStateInput,
  CharacterStateOutput,
} from '../core/narrative/types.js';

export function createCharacterArcRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  return {
    upsertMany(bookId: string, arcs: CharacterArc[]) {
      for (const arc of arcs) {
        drizzleDb
          .insert(characterArcs)
          .values({ ...arc, bookId })
          .onConflictDoUpdate({
            target: characterArcs.id,
            set: {
              name: arc.name,
              roleType: arc.roleType,
              desire: arc.desire,
              fear: arc.fear,
              flaw: arc.flaw,
              misbelief: arc.misbelief,
              wound: arc.wound ?? null,
              externalGoal: arc.externalGoal,
              internalNeed: arc.internalNeed,
              arcDirection: arc.arcDirection,
              decisionLogic: arc.decisionLogic,
              lineWillNotCross: arc.lineWillNotCross ?? null,
              lineMayEventuallyCross: arc.lineMayEventuallyCross ?? null,
              currentArcPhase: arc.currentArcPhase,
            },
          })
          .run();
      }
    },

    listByBook(bookId: string): CharacterArc[] {
      return drizzleDb
        .select({
          id: characterArcs.id,
          name: characterArcs.name,
          roleType: characterArcs.roleType,
          desire: characterArcs.desire,
          fear: characterArcs.fear,
          flaw: characterArcs.flaw,
          misbelief: characterArcs.misbelief,
          wound: characterArcs.wound,
          externalGoal: characterArcs.externalGoal,
          internalNeed: characterArcs.internalNeed,
          arcDirection: characterArcs.arcDirection,
          decisionLogic: characterArcs.decisionLogic,
          lineWillNotCross: characterArcs.lineWillNotCross,
          lineMayEventuallyCross: characterArcs.lineMayEventuallyCross,
          currentArcPhase: characterArcs.currentArcPhase,
        })
        .from(characterArcs)
        .where(eq(characterArcs.bookId, bookId))
        .orderBy(asc(characterArcs.id))
        .all() as CharacterArc[];
    },

    saveState(input: CharacterStateInput) {
      drizzleDb
        .insert(characterStates)
        .values({
          ...input,
          location: input.location ?? null,
          status: input.status ?? null,
          knowledge: input.knowledge ?? null,
          emotion: input.emotion ?? null,
          powerLevel: input.powerLevel ?? null,
          arcPhase: input.arcPhase ?? null,
        })
        .onConflictDoUpdate({
          target: [
            characterStates.bookId,
            characterStates.characterId,
            characterStates.volumeIndex,
            characterStates.chapterIndex,
          ],
          set: {
            characterName: input.characterName,
            location: input.location ?? null,
            status: input.status ?? null,
            knowledge: input.knowledge ?? null,
            emotion: input.emotion ?? null,
            powerLevel: input.powerLevel ?? null,
            arcPhase: input.arcPhase ?? null,
          },
        })
        .run();
    },

    listLatestStatesByBook(bookId: string): CharacterStateOutput[] {
      return drizzleDb
        .select({
          bookId: characterStates.bookId,
          characterId: characterStates.characterId,
          characterName: characterStates.characterName,
          volumeIndex: characterStates.volumeIndex,
          chapterIndex: characterStates.chapterIndex,
          location: characterStates.location,
          status: characterStates.status,
          knowledge: characterStates.knowledge,
          emotion: characterStates.emotion,
          powerLevel: characterStates.powerLevel,
          arcPhase: characterStates.arcPhase,
        })
        .from(characterStates)
        .where(eq(characterStates.bookId, bookId))
        .orderBy(
          asc(characterStates.characterId),
          desc(characterStates.volumeIndex),
          desc(characterStates.chapterIndex)
        )
        .all()
        .filter(
          (row, index, rows) =>
            index === 0 || rows[index - 1]?.characterId !== row.characterId
        ) as CharacterStateOutput[];
    },
  };
}
