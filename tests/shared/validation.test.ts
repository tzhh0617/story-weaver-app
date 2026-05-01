import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { validate, safeValidate } from '@story-weaver/shared/validation';

const TestSchema = z.object({ name: z.string(), age: z.number() });

describe('validate', () => {
  it('returns typed data for valid input', () => {
    const result = validate(TestSchema, { name: 'Alice', age: 30 });
    expect(result).toEqual({ name: 'Alice', age: 30 });
  });

  it('throws ValidationError for invalid input', () => {
    expect(() => validate(TestSchema, { name: 'Alice' })).toThrow();
  });
});

describe('safeValidate', () => {
  it('returns success with data for valid input', () => {
    const result = safeValidate(TestSchema, { name: 'Bob', age: 25 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: 'Bob', age: 25 });
    }
  });

  it('returns failure with error details for invalid input', () => {
    const result = safeValidate(TestSchema, { name: 'Bob' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.details.length).toBeGreaterThan(0);
    }
  });
});
