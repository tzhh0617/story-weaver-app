import type { ZodType } from 'zod';
import { ValidationError } from './errors.js';

export function validate<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  const details = result.error.issues.map((issue) => ({
    field: issue.path.join('.') || '_root',
    reason: issue.message,
  }));
  throw new ValidationError(details);
}

export function safeValidate<T>(
  schema: ZodType<T>,
  data: unknown,
): { success: true; data: T } | { success: false; error: ValidationError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const details = result.error.issues.map((issue) => ({
    field: issue.path.join('.') || '_root',
    reason: issue.message,
  }));
  return { success: false, error: new ValidationError(details) };
}
