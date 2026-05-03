import { describe, expect, it } from 'vitest';
import { createDatabase } from '../../src/storage/database';

describe('narrative schema', () => {
  it('creates ultra-longform autopilot tables', () => {
    const db = createDatabase(':memory:');
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tables).toEqual(
      expect.arrayContaining([
        'book_contracts',
        'story_ledgers',
        'story_events',
        'story_checkpoints',
      ])
    );
  });

  it('stores run-state control fields on writing_progress', () => {
    const db = createDatabase(':memory:');
    const columns = db
      .prepare('PRAGMA table_info(writing_progress)')
      .all()
      .map((row) => (row as { name: string }).name);

    expect(columns).toEqual(
      expect.arrayContaining([
        'drift_level',
        'last_healthy_checkpoint_chapter',
        'cooldown_until',
        'starvation_score',
      ])
    );
  });
});
