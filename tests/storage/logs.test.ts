import { describe, expect, it } from 'vitest';
import { createExecutionLogStream } from '@story-weaver/backend/storage/logs';

describe('execution log stream', () => {
  it('emits realtime logs to current subscribers without exposing history', () => {
    const stream = createExecutionLogStream();
    const received: unknown[] = [];
    const unsubscribe = stream.subscribe((log) => {
      received.push(log);
    });

    stream.emit({
      bookId: 'book-1',
      bookTitle: 'Archive',
      level: 'info',
      eventType: 'book_started',
      phase: 'writing',
      message: '开始后台写作',
    });
    unsubscribe();
    stream.emit({
      bookId: 'book-2',
      bookTitle: 'Compass',
      level: 'info',
      eventType: 'book_started',
      message: '另一本书开始',
    });

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      id: 1,
      bookId: 'book-1',
      bookTitle: 'Archive',
      eventType: 'book_started',
      message: '开始后台写作',
      createdAt: expect.any(String),
    });
    expect('list' in stream).toBe(false);
  });

  it('does not replay previous logs to later subscribers', () => {
    const stream = createExecutionLogStream();

    stream.emit({
      bookId: 'book-1',
      bookTitle: 'Archive',
      level: 'info',
      eventType: 'book_started',
      message: '订阅前发生的日志',
    });

    const received: unknown[] = [];
    stream.subscribe((log) => {
      received.push(log);
    });

    expect(received).toEqual([]);

    stream.emit({
      bookId: 'book-1',
      bookTitle: 'Archive',
      level: 'success',
      eventType: 'book_completed',
      message: '订阅后发生的日志',
    });

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      id: 2,
      eventType: 'book_completed',
      message: '订阅后发生的日志',
    });
  });
});
