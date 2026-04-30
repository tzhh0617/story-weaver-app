import { describe, expect, it } from 'vitest';
import {
  shouldRunCheckpoint,
  shouldRunNarrativeCheckpoint,
} from '../../src/core/narrative/checkpoint';

describe('shouldRunNarrativeCheckpoint', () => {
  it('runs arc checkpoint every 10 chapters', () => {
    expect(shouldRunNarrativeCheckpoint(9)).toBe(false);
    expect(shouldRunNarrativeCheckpoint(10)).toBe(true);
    expect(shouldRunNarrativeCheckpoint(20)).toBe(true);
  });

  it('keeps the configurable checkpoint helper for custom intervals', () => {
    expect(shouldRunCheckpoint({ chapterIndex: 6, interval: 3 })).toBe(true);
    expect(shouldRunCheckpoint({ chapterIndex: 7, interval: 3 })).toBe(false);
  });
});
