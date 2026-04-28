import { describe, expect, it } from 'vitest';
import { cn } from '../../renderer/lib/utils';

describe('cn', () => {
  it('merges truthy class names into a single string', () => {
    expect(cn('base', false && 'hidden', 'active')).toBe('base active');
  });
});
