import { describe, expect, it } from 'vitest';
import { createDatabase } from '../../src/storage/database';

describe('narrative schema', () => {
  it('creates structured narrative planning and audit tables', () => {
    const db = createDatabase(':memory:');
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tables).toEqual(
      expect.arrayContaining([
        'story_bibles',
        'character_arcs',
        'relationship_edges',
        'world_rules',
        'narrative_threads',
        'volume_plans',
        'chapter_cards',
        'chapter_generation_audits',
        'relationship_states',
        'narrative_checkpoints',
      ])
    );
  });

  it('stores audit metadata on chapters without legacy outline ownership', () => {
    const db = createDatabase(':memory:');
    const columns = db
      .prepare('PRAGMA table_info(chapters)')
      .all()
      .map((row) => (row as { name: string }).name);

    expect(columns).toEqual(expect.arrayContaining(['audit_score', 'draft_attempts', 'updated_at']));
    expect(columns).not.toContain('outline');
  });
});
