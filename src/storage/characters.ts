import type { Database as SqliteDatabase } from 'better-sqlite3';

export function createCharacterRepository(db: SqliteDatabase) {
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
      db.prepare(
        `
          INSERT INTO characters (
            id,
            book_id,
            name,
            role_type,
            personality,
            is_active
          )
          VALUES (
            @characterId,
            @bookId,
            @characterName,
            'supporting',
            '',
            1
          )
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            book_id = excluded.book_id
        `
      ).run({
        characterId: input.characterId,
        bookId: input.bookId,
        characterName: input.characterName,
      });

      db.prepare(
        `
          INSERT INTO character_states (
            book_id,
            character_id,
            volume_index,
            chapter_index,
            location,
            status,
            knowledge,
            emotion,
            power_level
          )
          VALUES (
            @bookId,
            @characterId,
            @volumeIndex,
            @chapterIndex,
            @location,
            @status,
            @knowledge,
            @emotion,
            @powerLevel
          )
          ON CONFLICT(book_id, character_id, volume_index, chapter_index) DO UPDATE SET
            location = excluded.location,
            status = excluded.status,
            knowledge = excluded.knowledge,
            emotion = excluded.emotion,
            power_level = excluded.power_level
        `
      ).run({
        ...input,
        location: input.location ?? null,
        status: input.status ?? null,
        knowledge: input.knowledge ?? null,
        emotion: input.emotion ?? null,
        powerLevel: input.powerLevel ?? null,
      });
    },

    listLatestStatesByBook(bookId: string) {
      return db
        .prepare(
          `
            SELECT
              latest.character_id AS characterId,
              COALESCE(characters.name, latest.character_id) AS characterName,
              latest.volume_index AS volumeIndex,
              latest.chapter_index AS chapterIndex,
              latest.location,
              latest.status,
              latest.knowledge,
              latest.emotion,
              latest.power_level AS powerLevel
            FROM character_states latest
            INNER JOIN (
              SELECT
                character_id,
                MAX(volume_index * 100000 + chapter_index) AS latestMarker
              FROM character_states
              WHERE book_id = ?
              GROUP BY character_id
            ) grouped
              ON grouped.character_id = latest.character_id
             AND grouped.latestMarker = (latest.volume_index * 100000 + latest.chapter_index)
            LEFT JOIN characters
              ON characters.id = latest.character_id
            WHERE latest.book_id = ?
            ORDER BY latest.character_id ASC
          `
        )
        .all(bookId, bookId) as Array<{
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
    },

    clearStatesByBook(bookId: string) {
      db.prepare('DELETE FROM character_states WHERE book_id = ?').run(bookId);
    },

    deleteByBook(bookId: string) {
      db.prepare('DELETE FROM character_states WHERE book_id = ?').run(bookId);
      db.prepare('DELETE FROM characters WHERE book_id = ?').run(bookId);
    },
  };
}
