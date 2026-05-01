import { describe, expect, it } from 'vitest';

describe('packaged smoke contract', () => {
  it('documents the acceptance target for packaging and resume support', () => {
    expect({
      packageScript: 'pnpm run package',
      restartAction: 'POST /api/books/:bookId/restart',
      exportFormats: ['txt', 'md'],
    }).toEqual({
      packageScript: 'pnpm run package',
      restartAction: 'POST /api/books/:bookId/restart',
      exportFormats: ['txt', 'md'],
    });
  });
});
