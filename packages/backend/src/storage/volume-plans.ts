import type { Database as SqliteDatabase } from 'better-sqlite3';
import type { VolumePlan } from '../core/narrative/types.js';

export function createVolumePlanRepository(db: SqliteDatabase) {
  return {
    upsertMany(bookId: string, plans: VolumePlan[]) {
      const statement = db.prepare(
        `
          INSERT INTO volume_plans (
            book_id, volume_index, title, chapter_start, chapter_end,
            role_in_story, main_pressure, promised_payoff, character_arc_movement,
            relationship_movement, world_expansion, ending_turn
          )
          VALUES (
            @bookId, @volumeIndex, @title, @chapterStart, @chapterEnd,
            @roleInStory, @mainPressure, @promisedPayoff, @characterArcMovement,
            @relationshipMovement, @worldExpansion, @endingTurn
          )
          ON CONFLICT(book_id, volume_index) DO UPDATE SET
            title = excluded.title,
            chapter_start = excluded.chapter_start,
            chapter_end = excluded.chapter_end,
            role_in_story = excluded.role_in_story,
            main_pressure = excluded.main_pressure,
            promised_payoff = excluded.promised_payoff,
            character_arc_movement = excluded.character_arc_movement,
            relationship_movement = excluded.relationship_movement,
            world_expansion = excluded.world_expansion,
            ending_turn = excluded.ending_turn
        `
      );

      for (const plan of plans) statement.run({ ...plan, bookId });
    },

    listByBook(bookId: string): VolumePlan[] {
      return db
        .prepare(
          `
            SELECT
              volume_index AS volumeIndex,
              title,
              chapter_start AS chapterStart,
              chapter_end AS chapterEnd,
              role_in_story AS roleInStory,
              main_pressure AS mainPressure,
              promised_payoff AS promisedPayoff,
              character_arc_movement AS characterArcMovement,
              relationship_movement AS relationshipMovement,
              world_expansion AS worldExpansion,
              ending_turn AS endingTurn
            FROM volume_plans
            WHERE book_id = ?
            ORDER BY volume_index ASC
          `
        )
        .all(bookId) as VolumePlan[];
    },
  };
}
