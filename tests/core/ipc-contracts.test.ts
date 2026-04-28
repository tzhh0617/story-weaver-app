import { describe, expect, it } from 'vitest';
import { ipcChannels } from '../../src/shared/contracts';

describe('ipcChannels', () => {
  it('defines the required book and scheduler channels', () => {
    expect(ipcChannels.bookCreate).toBe('book:create');
    expect(ipcChannels.schedulerStatus).toBe('scheduler:status');
    expect(ipcChannels.bookError).toBe('book:error');
  });
});
