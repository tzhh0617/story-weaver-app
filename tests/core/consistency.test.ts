import { describe, expect, it } from 'vitest';
import { selectOpenThreads } from '../../src/core/consistency';

describe('selectOpenThreads', () => {
  it('returns unresolved threads ordered by nearest expected payoff', () => {
    const result = selectOpenThreads([
      { id: 'late', expectedPayoff: 40, resolvedAt: null },
      { id: 'soon', expectedPayoff: 12, resolvedAt: null },
      { id: 'closed', expectedPayoff: 8, resolvedAt: 8 },
    ]);

    expect(result.map((thread) => thread.id)).toEqual(['soon', 'late']);
  });
});
