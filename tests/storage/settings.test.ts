import { describe, expect, it } from 'vitest';
import { createDatabase } from '@story-weaver/backend/storage/database';
import { createSettingsRepository } from '@story-weaver/backend/storage/settings';

describe('createSettingsRepository', () => {
  it('persists and reads back setting values', () => {
    const db = createDatabase(':memory:');
    const repo = createSettingsRepository(db);

    expect(repo.get('scheduler.concurrencyLimit')).toBeNull();

    repo.set('scheduler.concurrencyLimit', '2');

    expect(repo.get('scheduler.concurrencyLimit')).toBe('2');
  });
});
