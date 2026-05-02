import { and, asc, desc, eq } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import { characterStates, characters } from '../db/schema/index.js';

export function createCharacterRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  return {
    saveState(input: {
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
    }) {
      drizzleDb
        .insert(characters)
        .values({
          id: input.characterId,
          bookId: input.bookId,
          name: input.characterName,
          roleType: 'supporting',
          personality: '',
          isActive: 1,
        })
        .onConflictDoUpdate({
          target: characters.id,
          set: {
            name: input.characterName,
            bookId: input.bookId,
          },
        })
        .run();

      drizzleDb
        .insert(characterStates)
        .values({
          bookId: input.bookId,
          characterId: input.characterId,
          characterName: input.characterName,
          volumeIndex: input.volumeIndex,
          chapterIndex: input.chapterIndex,
          location: input.location ?? null,
          status: input.status ?? null,
          knowledge: input.knowledge ?? null,
          emotion: input.emotion ?? null,
          powerLevel: input.powerLevel ?? null,
        })
        .onConflictDoUpdate({
          target: [
            characterStates.bookId,
            characterStates.characterId,
            characterStates.volumeIndex,
            characterStates.chapterIndex,
          ],
          set: {
            location: input.location ?? null,
            status: input.status ?? null,
            knowledge: input.knowledge ?? null,
            emotion: input.emotion ?? null,
            powerLevel: input.powerLevel ?? null,
          },
        })
        .run();
    },

    listLatestStatesByBook(bookId: string) {
      const rows = drizzleDb
        .select({
          characterId: characterStates.characterId,
          fallbackCharacterName: characterStates.characterName,
          volumeIndex: characterStates.volumeIndex,
          chapterIndex: characterStates.chapterIndex,
          location: characterStates.location,
          status: characterStates.status,
          knowledge: characterStates.knowledge,
          emotion: characterStates.emotion,
          powerLevel: characterStates.powerLevel,
          characterName: characters.name,
        })
        .from(characterStates)
        .leftJoin(characters, eq(characters.id, characterStates.characterId))
        .where(eq(characterStates.bookId, bookId))
        .orderBy(
          asc(characterStates.characterId),
          desc(characterStates.volumeIndex),
          desc(characterStates.chapterIndex)
        )
        .all();

      return rows
        .filter(
          (row, index, allRows) =>
            index === 0 || allRows[index - 1]?.characterId !== row.characterId
        )
        .map((row) => ({
          characterId: row.characterId,
          characterName:
            row.characterName ?? row.fallbackCharacterName ?? row.characterId,
          volumeIndex: row.volumeIndex,
          chapterIndex: row.chapterIndex,
          location: row.location,
          status: row.status,
          knowledge: row.knowledge,
          emotion: row.emotion,
          powerLevel: row.powerLevel,
        }));
    },

    clearStatesByBook(bookId: string) {
      drizzleDb.delete(characterStates).where(eq(characterStates.bookId, bookId)).run();
    },

    deleteByBook(bookId: string) {
      drizzleDb.delete(characterStates).where(eq(characterStates.bookId, bookId)).run();
      drizzleDb.delete(characters).where(eq(characters.bookId, bookId)).run();
    },
  };
}
