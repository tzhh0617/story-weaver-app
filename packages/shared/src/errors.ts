export type ErrorDetail = { field: string; reason: string };

export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(code: string, statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      ...(this.details !== undefined ? { details: this.details } : {}),
    };
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super('NOT_FOUND', 404, `${resource} not found: ${id}`);
  }
}

export class ValidationError extends AppError {
  override readonly details: ErrorDetail[];

  constructor(details: ErrorDetail[]) {
    const message = details.map((d) => `${d.field}: ${d.reason}`).join('; ');
    super('VALIDATION_ERROR', 400, message, details);
    this.details = details;
  }
}

export class NoModelConfiguredError extends AppError {
  constructor() {
    super('NO_MODEL_CONFIGURED', 400, 'No model configured. Add a model in Settings.');
  }
}

export class GenerationError extends AppError {
  constructor(originalError: string) {
    super('GENERATION_ERROR', 500, `Generation failed: ${originalError}`, {
      originalError,
    });
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', 409, message);
  }
}
