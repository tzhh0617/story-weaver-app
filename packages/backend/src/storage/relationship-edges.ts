import type { Database as SqliteDatabase } from 'better-sqlite3';
import type { RelationshipEdge } from '../core/narrative/types.js';

export function createRelationshipEdgeRepository(db: SqliteDatabase) {
  return {
    upsertMany(bookId: string, edges: RelationshipEdge[]) {
      const statement = db.prepare(
        `
          INSERT INTO relationship_edges (
            id, book_id, from_character_id, to_character_id, visible_label,
            hidden_truth, dependency, debt, misunderstanding, affection,
            harm_pattern, shared_goal, value_conflict, trust_level,
            tension_level, current_state, planned_turns_json
          )
          VALUES (
            @id, @bookId, @fromCharacterId, @toCharacterId, @visibleLabel,
            @hiddenTruth, @dependency, @debt, @misunderstanding, @affection,
            @harmPattern, @sharedGoal, @valueConflict, @trustLevel,
            @tensionLevel, @currentState, @plannedTurnsJson
          )
          ON CONFLICT(book_id, id) DO UPDATE SET
            visible_label = excluded.visible_label,
            hidden_truth = excluded.hidden_truth,
            dependency = excluded.dependency,
            debt = excluded.debt,
            misunderstanding = excluded.misunderstanding,
            affection = excluded.affection,
            harm_pattern = excluded.harm_pattern,
            shared_goal = excluded.shared_goal,
            value_conflict = excluded.value_conflict,
            trust_level = excluded.trust_level,
            tension_level = excluded.tension_level,
            current_state = excluded.current_state,
            planned_turns_json = excluded.planned_turns_json
        `
      );

      for (const edge of edges) {
        statement.run({
          ...edge,
          bookId,
          plannedTurnsJson: JSON.stringify(edge.plannedTurns),
        });
      }
    },

    listByBook(bookId: string): RelationshipEdge[] {
      const rows = db
        .prepare(
          `
            SELECT
              id,
              from_character_id AS fromCharacterId,
              to_character_id AS toCharacterId,
              visible_label AS visibleLabel,
              hidden_truth AS hiddenTruth,
              dependency,
              debt,
              misunderstanding,
              affection,
              harm_pattern AS harmPattern,
              shared_goal AS sharedGoal,
              value_conflict AS valueConflict,
              trust_level AS trustLevel,
              tension_level AS tensionLevel,
              current_state AS currentState,
              planned_turns_json AS plannedTurnsJson
            FROM relationship_edges
            WHERE book_id = ?
            ORDER BY id ASC
          `
        )
        .all(bookId) as Array<Omit<RelationshipEdge, 'plannedTurns'> & { plannedTurnsJson: string }>;

      return rows.map((row) => ({
        ...row,
        plannedTurns: JSON.parse(row.plannedTurnsJson) as RelationshipEdge['plannedTurns'],
      }));
    },
  };
}
