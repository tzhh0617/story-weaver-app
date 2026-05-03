import { describe, expect, it, vi } from 'vitest';
import { createScheduler } from '../../src/core/scheduler';

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
};

function createDeferred(): Deferred {
  let resolve = () => {};
  const promise = new Promise<void>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

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

    scheduler.register({ taskKey: 'a:write', bookId: 'a', taskType: 'book:write:chapter', start });
    scheduler.register({ taskKey: 'b:write', bookId: 'b', taskType: 'book:write:chapter', start });
    scheduler.register({ taskKey: 'c:write', bookId: 'c', taskType: 'book:write:chapter', start });

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
    scheduler.register({ taskKey: 'a:write', bookId: 'a', taskType: 'book:write:chapter', start: startA });
    scheduler.register({ taskKey: 'b:write', bookId: 'b', taskType: 'book:write:chapter', start: startB });
    scheduler.register({ taskKey: 'c:write', bookId: 'c', taskType: 'book:write:chapter', start: startC });

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
    scheduler.register({ taskKey: 'a:write', bookId: 'a', taskType: 'book:write:chapter', start: startA });
    scheduler.register({ taskKey: 'b:write', bookId: 'b', taskType: 'book:write:chapter', start: startB });

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
    scheduler.register({ taskKey: 'a:write', bookId: 'a', taskType: 'book:write:chapter', start: startA });
    scheduler.register({ taskKey: 'b:write', bookId: 'b', taskType: 'book:write:chapter', start: startB });
    scheduler.register({ taskKey: 'c:write', bookId: 'c', taskType: 'book:write:chapter', start: startC });

    await scheduler.start('a:write');
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
    scheduler.register({ taskKey: 'a:write', bookId: 'a', taskType: 'book:write:chapter', start: startA });
    scheduler.register({ taskKey: 'b:write', bookId: 'b', taskType: 'book:write:chapter', start: startB });

    await scheduler.startAll();
    expect(scheduler.getStatus().queuedBookIds).toEqual(['b']);

    scheduler.unregister('b');

    expect(scheduler.getStatus().queuedBookIds).toEqual([]);

    (resolveA as null | (() => void))?.();
  });

  it('prioritizes planning tasks and prevents concurrent tasks for the same book', async () => {
    const events: string[] = [];
    const planA = createDeferred();
    const writeA = createDeferred();
    const writeB = createDeferred();

    const scheduler = createScheduler({ concurrencyLimit: 2 });
    scheduler.register({
      taskKey: 'book-a:plan',
      bookId: 'book-a',
      taskType: 'book:plan:init',
      start: vi.fn().mockImplementation(async () => {
        events.push('plan-a:start');
        await planA.promise;
        events.push('plan-a:done');
      }),
    });
    scheduler.register({
      taskKey: 'book-a:write',
      bookId: 'book-a',
      taskType: 'book:write:chapter',
      start: vi.fn().mockImplementation(async () => {
        events.push('write-a:start');
        await writeA.promise;
        events.push('write-a:done');
      }),
    });
    scheduler.register({
      taskKey: 'book-b:write',
      bookId: 'book-b',
      taskType: 'book:write:chapter',
      start: vi.fn().mockImplementation(async () => {
        events.push('write-b:start');
        await writeB.promise;
        events.push('write-b:done');
      }),
    });

    await scheduler.start('book-a:write');
    await scheduler.start('book-b:write');
    await scheduler.start('book-a:plan');

    expect(events).toEqual(['plan-a:start', 'write-b:start']);
    expect(scheduler.getStatus().runningBookIds.sort()).toEqual(['book-a', 'book-b']);
    expect(scheduler.getStatus().queuedBookIds).toEqual(['book-a']);

    planA.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(events).toEqual(['plan-a:start', 'write-b:start', 'plan-a:done', 'write-a:start']);
    expect(scheduler.getStatus().runningBookIds.sort()).toEqual(['book-a', 'book-b']);
    expect(scheduler.getStatus().queuedBookIds).toEqual([]);

    writeA.resolve();
    writeB.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
});
