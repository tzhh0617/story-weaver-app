import { describe, expect, it } from 'vitest';
import {
  AppError,
  NotFoundError,
  ValidationError,
  NoModelConfiguredError,
  GenerationError,
  ConflictError,
} from '@story-weaver/shared/errors';

describe('AppError hierarchy', () => {
  it('NotFoundError has code NOT_FOUND and status 404', () => {
    const error = new NotFoundError('Book', 'book-1');
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.statusCode).toBe(404);
    expect(error.message).toContain('book-1');
  });

  it('ValidationError has code VALIDATION_ERROR and status 400 with details', () => {
    const details = [{ field: 'idea', reason: 'required' }];
    const error = new ValidationError(details);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.statusCode).toBe(400);
    expect(error.details).toEqual(details);
  });

  it('NoModelConfiguredError has code NO_MODEL_CONFIGURED', () => {
    const error = new NoModelConfiguredError();
    expect(error.code).toBe('NO_MODEL_CONFIGURED');
    expect(error.statusCode).toBe(400);
  });

  it('GenerationError has code GENERATION_ERROR and wraps original', () => {
    const error = new GenerationError('API rate limit exceeded');
    expect(error.code).toBe('GENERATION_ERROR');
    expect(error.statusCode).toBe(500);
    expect(error.details).toEqual({ originalError: 'API rate limit exceeded' });
  });

  it('ConflictError has code CONFLICT and status 409', () => {
    const error = new ConflictError('Book already running');
    expect(error.code).toBe('CONFLICT');
    expect(error.statusCode).toBe(409);
  });

  it('all errors serialize to JSON with code and message', () => {
    const error = new NotFoundError('Book', 'x');
    const json = error.toJSON();
    expect(json).toEqual({
      code: 'NOT_FOUND',
      message: error.message,
    });
  });
});
