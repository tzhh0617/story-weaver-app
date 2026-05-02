import { describe, expect, it } from 'vitest';
import { createDatabase } from '../../src/storage/database';
import { createSettingsRepository } from '../../src/storage/settings';

describe('createSettingsRepository', () => {
  it('persists and reads back setting values', () => {
    const db = createDatabase(':memory:');
    const repo = createSettingsRepository(db);

    expect(repo.get('scheduler.concurrencyLimit')).toBeNull();

    repo.set('scheduler.concurrencyLimit', '2');

    expect(repo.get('scheduler.concurrencyLimit')).toBe('2');
  });

  it('lists settings as a key-value object ordered by key', () => {
    const db = createDatabase(':memory:');
    const repo = createSettingsRepository(db);

    repo.set('b.key', '2');
    repo.set('a.key', '1');

    expect(repo.list()).toEqual({
      'a.key': '1',
      'b.key': '2',
    });
  });
});
