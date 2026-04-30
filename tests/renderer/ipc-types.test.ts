import { describe, expect, it } from 'vitest';
import {
  ipcChannels,
} from '../../src/shared/contracts';
import type { StoryWeaverIpc } from '../../renderer/hooks/useIpc';

declare const ipc: StoryWeaverIpc;

function assertRendererIpcTypes() {
  void ipc.invoke(ipcChannels.bookList).then((books) => {
    books[0]?.progress.toFixed(0);
  });
  void ipc.invoke(ipcChannels.bookDetail, { bookId: 'book-1' }).then((detail) => {
    detail?.chapters[0]?.chapterIndex.toFixed(0);
  });
  void ipc.invoke(ipcChannels.bookExport, {
    bookId: 'book-1',
    format: 'md',
  }).then((filePath) => filePath.toUpperCase());

  // @ts-expect-error scheduler progress is a push event, not an invoke channel.
  void ipc.invoke(ipcChannels.schedulerProgress, {
    runningBookIds: [],
    queuedBookIds: [],
    pausedBookIds: [],
    concurrencyLimit: null,
  });
  // @ts-expect-error book generation is a push event, not an invoke channel.
  void ipc.invoke(ipcChannels.bookGeneration, {
    bookId: 'book-1',
    type: 'chapter-complete',
    volumeIndex: 1,
    chapterIndex: 1,
    title: 'Chapter 1',
  });
  // @ts-expect-error execution logs are push events, not invoke channels.
  void ipc.invoke(ipcChannels.executionLog, {
    id: 1,
    bookId: null,
    bookTitle: null,
    level: 'info',
    eventType: 'book_progress',
    phase: null,
    message: 'Progress',
    volumeIndex: null,
    chapterIndex: null,
    errorMessage: null,
    createdAt: '2026-04-30T00:00:00.000Z',
  });
  // @ts-expect-error book detail requires a payload.
  void ipc.invoke(ipcChannels.bookDetail);
  // @ts-expect-error book export format only supports txt and md.
  void ipc.invoke(ipcChannels.bookExport, { bookId: 'book-1', format: 'pdf' });
  void ipc.invoke(ipcChannels.bookCreate, {
    idea: 'Archive',
    // @ts-expect-error book creation requires numeric limits.
    targetChapters: '2',
    wordsPerChapter: 2500,
  });
}

void assertRendererIpcTypes;

describe('renderer IPC types', () => {
  it('keeps compile-time IPC assertions in the typecheck suite', () => {
    expect(true).toBe(true);
  });
});
