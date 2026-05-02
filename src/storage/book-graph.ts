import type { Database as SqliteDatabase } from 'better-sqlite3';

const bookScopedPlanningTables = [
  'story_state_snapshots',
  'chapter_plans',
  'arc_plans',
  'stage_plans',
  'endgame_plans',
  'title_idea_contracts',
  'narrative_checkpoints',
  'chapter_generation_audits',
  'relationship_states',
  'chapter_tension_budgets',
] as const;

export function deleteBookPlanningData(
  db: SqliteDatabase,
  bookId: string
) {
  for (const table of bookScopedPlanningTables) {
    db.prepare(`DELETE FROM ${table} WHERE book_id = ?`).run(bookId);
  }
}
