import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createExecutionLogStream } from '../../src/storage/logs';

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

  it('writes each log to disk immediately as ndjson with debug metadata', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'story-weaver-logs-'));
    const stream = createExecutionLogStream({
      logDir: tempDir,
      runId: 'run-test',
    });

    const log = stream.emit({
      bookId: 'book-1',
      bookTitle: 'Archive',
      level: 'debug',
      eventType: 'runtime_checkpoint',
      phase: 'writing',
      message: '记录调试节点',
      durationMs: 27,
      debugContext: {
        schedulerTaskKey: 'book:book-1:write',
        modelId: 'mock:model',
      },
    });

    const files = fs.readdirSync(tempDir);
    expect(files).toHaveLength(1);

    const logFile = path.join(tempDir, files[0]);
    const lines = fs
      .readFileSync(logFile, 'utf8')
      .trim()
      .split('\n');
    expect(lines).toHaveLength(1);

    expect(JSON.parse(lines[0])).toMatchObject({
      id: log.id,
      sequence: 1,
      runId: 'run-test',
      bookId: 'book-1',
      level: 'debug',
      eventType: 'runtime_checkpoint',
      durationMs: 27,
      debugContext: {
        schedulerTaskKey: 'book:book-1:write',
        modelId: 'mock:model',
      },
    });
  });

  it('rotates to a new file when the daily log exceeds the max byte size', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'story-weaver-logs-'));
    const stream = createExecutionLogStream({
      logDir: tempDir,
      runId: 'run-rotate',
      maxFileSizeBytes: 260,
    });

    stream.emit({
      level: 'debug',
      eventType: 'rotation_first',
      message: '第一条日志用于填充文件尺寸',
      debugContext: {
        payload: 'x'.repeat(140),
      },
    });
    stream.emit({
      level: 'debug',
      eventType: 'rotation_second',
      message: '第二条日志应该写入新分片',
      debugContext: {
        payload: 'y'.repeat(140),
      },
    });

    const files = fs.readdirSync(tempDir);
    expect(files).toHaveLength(2);
    expect(files).toEqual(
      expect.arrayContaining(['2026-05-03.log', '2026-05-03.1.log'])
    );

    const primaryLog = fs.readFileSync(path.join(tempDir, '2026-05-03.log'), 'utf8').trim();
    const rotatedLog = fs.readFileSync(
      path.join(tempDir, '2026-05-03.1.log'),
      'utf8'
    ).trim();

    expect(primaryLog).toContain('"eventType":"rotation_first"');
    expect(rotatedLog).toContain('"eventType":"rotation_second"');
  });

  it('prunes log files older than the retention window', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'story-weaver-logs-'));
    fs.writeFileSync(path.join(tempDir, '2026-04-20.log'), 'old\n', 'utf8');
    fs.writeFileSync(path.join(tempDir, '2026-04-25.1.log'), 'recent-old\n', 'utf8');
    fs.writeFileSync(path.join(tempDir, 'notes.txt'), 'keep-me\n', 'utf8');

    const stream = createExecutionLogStream({
      logDir: tempDir,
      runId: 'run-retain',
      retentionDays: 7,
      now: () => new Date('2026-05-03T12:00:00.000Z'),
    });

    stream.emit({
      level: 'info',
      eventType: 'retention_checkpoint',
      message: '触发清理',
    });

    const files = fs.readdirSync(tempDir).sort();
    expect(files).toEqual(['2026-05-03.log', 'notes.txt']);
  });
});
