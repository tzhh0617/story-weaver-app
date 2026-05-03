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

  it('schedules higher run-score tasks first while respecting same-book exclusion', async () => {
    const events: string[] = [];
    const bookAFirst = createDeferred();
    const bookASecond = createDeferred();
    const bookB = createDeferred();
    const bookC = createDeferred();

    const scheduler = createScheduler({ concurrencyLimit: 1 });
    scheduler.register({
      taskKey: 'book-a:first',
      bookId: 'book-a',
      taskType: 'book:write:chapter',
      start: vi.fn().mockImplementation(async () => {
        events.push('book-a:first:start');
        await bookAFirst.promise;
        events.push('book-a:first:done');
      }),
    });
    scheduler.register({
      taskKey: 'book-a:second',
      bookId: 'book-a',
      taskType: 'book:write:chapter',
      priority: { urgency: 10, starvationBoost: 4 },
      start: vi.fn().mockImplementation(async () => {
        events.push('book-a:second:start');
        await bookASecond.promise;
        events.push('book-a:second:done');
      }),
    });
    scheduler.register({
      taskKey: 'book-b:write',
      bookId: 'book-b',
      taskType: 'book:write:chapter',
      priority: { urgency: 1 },
      start: vi.fn().mockImplementation(async () => {
        events.push('book-b:write:start');
        await bookB.promise;
        events.push('book-b:write:done');
      }),
    });
    scheduler.register({
      taskKey: 'book-c:write',
      bookId: 'book-c',
      taskType: 'book:write:chapter',
      priority: { urgency: 5, noveltyBalance: 1 },
      start: vi.fn().mockImplementation(async () => {
        events.push('book-c:write:start');
        await bookC.promise;
        events.push('book-c:write:done');
      }),
    });

    await scheduler.start('book-a:first');
    await scheduler.start('book-a:second');
    await scheduler.start('book-b:write');
    await scheduler.start('book-c:write');

    scheduler.setConcurrencyLimit(2);
    await Promise.resolve();
    await Promise.resolve();

    expect(events).toEqual(['book-a:first:start', 'book-c:write:start']);
    expect(scheduler.getStatus().runningBookIds.sort()).toEqual(['book-a', 'book-c']);
    expect(scheduler.getStatus().queuedBookIds).toEqual(['book-a', 'book-b']);
    expect(scheduler.getStatus().queuedTasks).toEqual([
      {
        taskKey: 'book-a:second',
        bookId: 'book-a',
        taskType: 'book:write:chapter',
        score: 14,
      },
      {
        taskKey: 'book-b:write',
        bookId: 'book-b',
        taskType: 'book:write:chapter',
        score: 1,
      },
    ]);

    bookAFirst.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(events).toEqual([
      'book-a:first:start',
      'book-c:write:start',
      'book-a:first:done',
      'book-a:second:start',
    ]);
    expect(scheduler.getStatus().runningBookIds.sort()).toEqual(['book-a', 'book-c']);
    expect(scheduler.getStatus().queuedBookIds).toEqual(['book-b']);
    expect(scheduler.getStatus().queuedTasks).toEqual([
      {
        taskKey: 'book-b:write',
        bookId: 'book-b',
        taskType: 'book:write:chapter',
        score: 1,
      },
    ]);

    bookASecond.resolve();
    bookB.resolve();
    bookC.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  it('keeps the book locked until a running unregistered task settles', async () => {
    const firstTask = createDeferred();
    const secondTask = createDeferred();
    const startFirst = vi.fn().mockImplementation(async () => {
      await firstTask.promise;
    });
    const startSecond = vi.fn().mockImplementation(async () => {
      await secondTask.promise;
    });

    const scheduler = createScheduler({ concurrencyLimit: 2 });
    scheduler.register({
      taskKey: 'book-a:first',
      bookId: 'book-a',
      taskType: 'book:write:chapter',
      start: startFirst,
    });
    scheduler.register({
      taskKey: 'book-a:second',
      bookId: 'book-a',
      taskType: 'book:write:chapter',
      start: startSecond,
    });

    await scheduler.start('book-a:first');
    expect(startFirst).toHaveBeenCalledTimes(1);

    scheduler.unregister('book-a:first');
    await scheduler.start('book-a:second');
    await Promise.resolve();
    await Promise.resolve();

    expect(startSecond).toHaveBeenCalledTimes(0);
    expect(scheduler.getStatus().runningBookIds).toEqual(['book-a']);

    firstTask.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(startSecond).toHaveBeenCalledTimes(1);

    secondTask.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  it('keeps unlimited mode throughput after unregistering a running task', async () => {
    const bookAFirst = createDeferred();
    const bookASecond = createDeferred();
    const bookB = createDeferred();
    const bookC = createDeferred();
    const startBookAFirst = vi.fn().mockImplementation(async () => {
      await bookAFirst.promise;
    });
    const startBookASecond = vi.fn().mockImplementation(async () => {
      await bookASecond.promise;
    });
    const startBookB = vi.fn().mockImplementation(async () => {
      await bookB.promise;
    });
    const startBookC = vi.fn().mockImplementation(async () => {
      await bookC.promise;
    });

    const scheduler = createScheduler({ concurrencyLimit: null });
    scheduler.register({
      taskKey: 'book-a:first',
      bookId: 'book-a',
      taskType: 'book:write:chapter',
      start: startBookAFirst,
    });
    scheduler.register({
      taskKey: 'book-a:second',
      bookId: 'book-a',
      taskType: 'book:write:chapter',
      start: startBookASecond,
    });
    scheduler.register({
      taskKey: 'book-b:write',
      bookId: 'book-b',
      taskType: 'book:write:chapter',
      start: startBookB,
    });
    scheduler.register({
      taskKey: 'book-c:write',
      bookId: 'book-c',
      taskType: 'book:write:chapter',
      start: startBookC,
    });

    await scheduler.start('book-a:first');
    expect(startBookAFirst).toHaveBeenCalledTimes(1);

    scheduler.unregister('book-a:first');
    await scheduler.start('book-a:second');
    await scheduler.start('book-b:write');
    await scheduler.start('book-c:write');
    await Promise.resolve();
    await Promise.resolve();

    expect(startBookASecond).toHaveBeenCalledTimes(0);
    expect(startBookB).toHaveBeenCalledTimes(1);
    expect(startBookC).toHaveBeenCalledTimes(1);
    expect(scheduler.getStatus().runningBookIds.sort()).toEqual(['book-a', 'book-b', 'book-c']);

    bookAFirst.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(startBookASecond).toHaveBeenCalledTimes(1);

    bookASecond.resolve();
    bookB.resolve();
    bookC.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
});
