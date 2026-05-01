import { describe, expect, it, vi } from 'vitest';
import { createNovelEngine } from '@story-weaver/backend/core/engine';

describe('createNovelEngine', () => {
  it('runs the book through outline and writing phases when start is called', async () => {
    const updatePhase = vi.fn();
    const buildOutline = vi.fn().mockResolvedValue(undefined);
    const engine = createNovelEngine({
      bookId: 'book-1',
      buildOutline,
      continueWriting: vi.fn().mockResolvedValue({
        completedChapters: 0,
      }),
      repositories: {
        progress: {
          updatePhase,
        },
      },
    });

    await engine.start();

    expect(updatePhase).toHaveBeenNthCalledWith(1, 'book-1', 'building_world');
    expect(updatePhase).toHaveBeenNthCalledWith(2, 'book-1', 'writing');
    expect(updatePhase).toHaveBeenNthCalledWith(3, 'book-1', 'completed');
    expect(buildOutline).toHaveBeenCalledWith('book-1');
    expect(engine.getStatus()).toBe('completed');
  });

  it('continues writing remaining chapters and ends in completed', async () => {
    const continueWriting = vi.fn().mockResolvedValue({
      completedChapters: 2,
      status: 'completed',
    });
    const updatePhase = vi.fn();
    const buildOutline = vi.fn().mockResolvedValue(undefined);

    const engine = createNovelEngine({
      bookId: 'book-1',
      buildOutline,
      continueWriting,
      repositories: {
        progress: {
          updatePhase,
        },
      },
    });

    await engine.start();

    expect(continueWriting).toHaveBeenCalledWith('book-1');
    expect(updatePhase).toHaveBeenCalledWith('book-1', 'completed');
    expect(engine.getStatus()).toBe('completed');
  });

  it('ends in paused when the writing loop is paused before completion', async () => {
    const updatePhase = vi.fn();
    const buildOutline = vi.fn().mockResolvedValue(undefined);
    const continueWriting = vi.fn().mockResolvedValue({
      completedChapters: 1,
      status: 'paused',
    });

    const engine = createNovelEngine({
      bookId: 'book-1',
      buildOutline,
      continueWriting,
      repositories: {
        progress: {
          updatePhase,
        },
      },
    });

    await engine.start();

    expect(updatePhase).toHaveBeenCalledWith('book-1', 'paused');
    expect(engine.getStatus()).toBe('paused');
  });
});
