import { describe, expect, it } from 'vitest';
import { buildWorldPrompt } from '../../src/core/prompt-builder';

describe('buildWorldPrompt', () => {
  it('anchors the worldbuilding prompt to the user idea and target word count', () => {
    const prompt = buildWorldPrompt({
      idea: 'A mountain archive decides who may remember history.',
      targetWords: 500000,
    });

    expect(prompt).toContain(
      'A mountain archive decides who may remember history.'
    );
    expect(prompt).toContain('500000');
  });
});
