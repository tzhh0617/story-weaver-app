import type { Database as SqliteDatabase } from 'better-sqlite3';
import type {
  RelationshipStateInput,
  RelationshipStateOutput,
} from '../core/narrative/types.js';

export function createRelationshipStateRepository(db: SqliteDatabase) {
  return {
    save(input: RelationshipStateInput) {
      db.prepare(
        `
          INSERT INTO relationship_states (
            book_id, relationship_id, volume_index, chapter_index, trust_level,
            tension_level, current_state, change_summary
          )
          VALUES (
            @bookId, @relationshipId, @volumeIndex, @chapterIndex, @trustLevel,
            @tensionLevel, @currentState, @changeSummary
          )
          ON CONFLICT(book_id, relationship_id, volume_index, chapter_index) DO UPDATE SET
            trust_level = excluded.trust_level,
            tension_level = excluded.tension_level,
            current_state = excluded.current_state,
            change_summary = excluded.change_summary
        `
      ).run({
        ...input,
        changeSummary: input.changeSummary ?? null,
      });
    },

    listLatestByBook(bookId: string): RelationshipStateOutput[] {
      return db
        .prepare(
          `
            SELECT
              latest.book_id AS bookId,
              latest.relationship_id AS relationshipId,
              latest.volume_index AS volumeIndex,
              latest.chapter_index AS chapterIndex,
              latest.trust_level AS trustLevel,
              latest.tension_level AS tensionLevel,
              latest.current_state AS currentState,
              latest.change_summary AS changeSummary
            FROM relationship_states latest
            INNER JOIN (
              SELECT relationship_id, MAX(volume_index * 100000 + chapter_index) AS latestMarker
              FROM relationship_states
              WHERE book_id = ?
              GROUP BY relationship_id
            ) grouped
              ON grouped.relationship_id = latest.relationship_id
             AND grouped.latestMarker = (latest.volume_index * 100000 + latest.chapter_index)
            WHERE latest.book_id = ?
            ORDER BY latest.relationship_id ASC
          `
        )
        .all(bookId, bookId) as RelationshipStateOutput[];
    },
  };
}
