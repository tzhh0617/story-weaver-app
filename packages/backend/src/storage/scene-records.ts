import type { Database as SqliteDatabase } from 'better-sqlite3';

export function createSceneRecordRepository(db: SqliteDatabase) {
  return {
    save(input: {
      bookId: string;
      volumeIndex: number;
      chapterIndex: number;
      location: string;
      timeInStory: string;
      charactersPresent: string[];
      events?: string | null;
    }) {
      db.prepare(
        `
          INSERT INTO scene_records (
            book_id,
            volume_index,
            chapter_index,
            location,
            time_in_story,
            characters_present,
            events
          )
          VALUES (
            @bookId,
            @volumeIndex,
            @chapterIndex,
            @location,
            @timeInStory,
            @charactersPresent,
            @events
          )
        `
      ).run({
        ...input,
        charactersPresent: JSON.stringify(input.charactersPresent),
        events: input.events ?? null,
      });
    },

    getLatestByBook(bookId: string) {
      const row = db
        .prepare(
          `
            SELECT
              book_id AS bookId,
              volume_index AS volumeIndex,
              chapter_index AS chapterIndex,
              location,
              time_in_story AS timeInStory,
              characters_present AS charactersPresentJson,
              events
            FROM scene_records
            WHERE book_id = ?
            ORDER BY volume_index DESC, chapter_index DESC, id DESC
            LIMIT 1
          `
        )
        .get(bookId) as
        | {
            bookId: string;
            volumeIndex: number;
            chapterIndex: number;
            location: string;
            timeInStory: string;
            charactersPresentJson: string;
            events: string | null;
          }
        | undefined;

      if (!row) {
        return null;
      }

      return {
        bookId: row.bookId,
        volumeIndex: row.volumeIndex,
        chapterIndex: row.chapterIndex,
        location: row.location,
        timeInStory: row.timeInStory,
        charactersPresent: JSON.parse(row.charactersPresentJson) as string[],
        events: row.events,
      };
    },

    clearByBook(bookId: string) {
      db.prepare('DELETE FROM scene_records WHERE book_id = ?').run(bookId);
    },
  };
}
