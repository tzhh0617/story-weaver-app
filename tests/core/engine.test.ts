import { describe, expect, it, vi } from 'vitest';
import { createNovelEngine } from '../../src/core/engine';

describe('createNovelEngine', () => {
  it('runs planning before writing and records planning_init, writing, and completed phases', async () => {
    const updatePhase = vi.fn();
    const initializePlanning = vi.fn().mockResolvedValue(undefined);
    const continueWriting = vi.fn().mockResolvedValue({
      completedChapters: 0,
      status: 'completed',
    });
    const engine = createNovelEngine({
      bookId: 'book-1',
      initializePlanning,
      continueWriting,
      repositories: {
        progress: {
          updatePhase,
        },
      },
    });

    await engine.start();

    expect(updatePhase).toHaveBeenNthCalledWith(1, 'book-1', 'planning_init');
    expect(updatePhase).toHaveBeenNthCalledWith(2, 'book-1', 'writing');
    expect(updatePhase).toHaveBeenNthCalledWith(3, 'book-1', 'completed');
    expect(initializePlanning).toHaveBeenCalledWith('book-1');
    expect(continueWriting).toHaveBeenCalledWith('book-1');
    expect(initializePlanning.mock.invocationCallOrder[0]).toBeLessThan(
      continueWriting.mock.invocationCallOrder[0]
    );
    expect(engine.getStatus()).toBe('completed');
  });

  it('continues writing remaining chapters and ends in completed', async () => {
    const continueWriting = vi.fn().mockResolvedValue({
      completedChapters: 2,
      status: 'completed',
    });
    const updatePhase = vi.fn();
    const initializePlanning = vi.fn().mockResolvedValue(undefined);

    const engine = createNovelEngine({
      bookId: 'book-1',
      initializePlanning,
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
    const initializePlanning = vi.fn().mockResolvedValue(undefined);
    const continueWriting = vi.fn().mockResolvedValue({
      completedChapters: 1,
      status: 'paused',
    });

    const engine = createNovelEngine({
      bookId: 'book-1',
      initializePlanning,
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
