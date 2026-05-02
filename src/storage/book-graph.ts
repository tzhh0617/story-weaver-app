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
] as const;

const legacyNarrativeTables = [
  'character_arcs',
  'relationship_edges',
  'world_rules',
  'narrative_threads',
  'chapter_thread_actions',
  'chapter_character_pressures',
  'chapter_relationship_actions',
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

export function deleteLegacyNarrativeData(
  db: SqliteDatabase,
  bookId: string
) {
  for (const table of legacyNarrativeTables) {
    db.prepare(`DELETE FROM ${table} WHERE book_id = ?`).run(bookId);
  }
}
