import type { Database as SqliteDatabase } from 'better-sqlite3';

const bookScopedPlanningTables = [
  'narrative_checkpoints',
  'chapter_generation_audits',
  'chapter_relationship_actions',
  'chapter_tension_budgets',
  'chapter_character_pressures',
  'chapter_thread_actions',
  'chapter_cards',
  'volume_plans',
  'relationship_states',
  'relationship_edges',
  'narrative_threads',
  'world_rules',
  'character_arcs',
  'story_bibles',
] as const;

export function deleteBookPlanningData(
  db: SqliteDatabase,
  bookId: string
) {
  for (const table of bookScopedPlanningTables) {
    db.prepare(`DELETE FROM ${table} WHERE book_id = ?`).run(bookId);
  }
}
