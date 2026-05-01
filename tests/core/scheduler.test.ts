import { describe, expect, it, vi } from 'vitest';
import { createScheduler } from '@story-weaver/backend/core/scheduler';

describe('createScheduler', () => {
  it('starts only up to the concurrency limit', async () => {
    let resolveA: (() => void) | null = null;
    let resolveB: (() => void) | null = null;
    let resolveC: (() => void) | null = null;
    const start = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveA = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveB = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveC = resolve;
          })
      );
    const scheduler = createScheduler({ concurrencyLimit: 2 });

    scheduler.register({ bookId: 'a', start });
    scheduler.register({ bookId: 'b', start });
    scheduler.register({ bookId: 'c', start });

    await scheduler.startAll();

    expect(start).toHaveBeenCalledTimes(2);
    expect(scheduler.getStatus().runningBookIds).toEqual(['a', 'b']);
    expect(scheduler.getStatus().queuedBookIds).toEqual(['c']);

    (resolveA as null | (() => void))?.();
    (resolveB as null | (() => void))?.();
    (resolveC as null | (() => void))?.();
  });

  it('starts queued books as running slots free up', async () => {
    let resolveA: (() => void) | null = null;
    let resolveB: (() => void) | null = null;
    let resolveC: (() => void) | null = null;

    const startA = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveA = resolve;
        })
    );
    const startB = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveB = resolve;
        })
    );
    const startC = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveC = resolve;
        })
    );

    const scheduler = createScheduler({ concurrencyLimit: 1 });
    scheduler.register({ bookId: 'a', start: startA });
    scheduler.register({ bookId: 'b', start: startB });
    scheduler.register({ bookId: 'c', start: startC });

    await scheduler.startAll();

    expect(startA).toHaveBeenCalledTimes(1);
    expect(startB).toHaveBeenCalledTimes(0);
    expect(scheduler.getStatus().queuedBookIds).toEqual(['b', 'c']);

    (resolveA as null | (() => void))?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(startB).toHaveBeenCalledTimes(1);
    expect(scheduler.getStatus().queuedBookIds).toEqual(['c']);

    (resolveB as null | (() => void))?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(startC).toHaveBeenCalledTimes(1);
    expect(scheduler.getStatus().queuedBookIds).toEqual([]);

    (resolveC as null | (() => void))?.();
  });

  it('clears queued books when pauseAll is called', async () => {
    let resolveA: (() => void) | null = null;
    const startA = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveA = resolve;
        })
    );
    const startB = vi.fn().mockResolvedValue(undefined);

    const scheduler = createScheduler({ concurrencyLimit: 1 });
    scheduler.register({ bookId: 'a', start: startA });
    scheduler.register({ bookId: 'b', start: startB });

    await scheduler.startAll();

    expect(scheduler.getStatus().runningBookIds).toEqual(['a']);
    expect(scheduler.getStatus().queuedBookIds).toEqual(['b']);

    scheduler.pauseAll();

    expect(scheduler.getStatus().runningBookIds).toEqual(['a']);
    expect(scheduler.getStatus().queuedBookIds).toEqual([]);

    (resolveA as null | (() => void))?.();
  });

  it('uses an updated concurrency limit for later starts', async () => {
    let resolveA: (() => void) | null = null;
    let resolveB: (() => void) | null = null;
    const startA = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveA = resolve;
        })
    );
    const startB = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveB = resolve;
        })
    );
    const startC = vi.fn().mockResolvedValue(undefined);

    const scheduler = createScheduler({ concurrencyLimit: 1 });
    scheduler.register({ bookId: 'a', start: startA });
    scheduler.register({ bookId: 'b', start: startB });
    scheduler.register({ bookId: 'c', start: startC });

    await scheduler.start('a');
    expect(scheduler.getStatus().runningBookIds).toEqual(['a']);

    scheduler.setConcurrencyLimit(2);
    await scheduler.startAll();

    expect(startB).toHaveBeenCalledTimes(1);
    expect(scheduler.getStatus().runningBookIds).toEqual(['a', 'b']);
    expect(scheduler.getStatus().concurrencyLimit).toBe(2);

    (resolveA as null | (() => void))?.();
    (resolveB as null | (() => void))?.();
  });

  it('removes an unstarted book from the queue when unregistered', async () => {
    let resolveA: (() => void) | null = null;
    const startA = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveA = resolve;
        })
    );
    const startB = vi.fn().mockResolvedValue(undefined);

    const scheduler = createScheduler({ concurrencyLimit: 1 });
    scheduler.register({ bookId: 'a', start: startA });
    scheduler.register({ bookId: 'b', start: startB });

    await scheduler.startAll();
    expect(scheduler.getStatus().queuedBookIds).toEqual(['b']);

    scheduler.unregister('b');

    expect(scheduler.getStatus().queuedBookIds).toEqual([]);

    (resolveA as null | (() => void))?.();
  });
});
