export type BookStatus =
  | 'creating'
  | 'building_world'
  | 'building_outline'
  | 'writing'
  | 'paused'
  | 'completed'
  | 'error';

export type BookRecord = {
  id: string;
  title: string;
  idea: string;
  status: BookStatus;
  targetChapters: number;
  wordsPerChapter: number;
  createdAt: string;
  updatedAt: string;
};

export type SchedulerStatus = {
  runningBookIds: string[];
  queuedBookIds: string[];
  pausedBookIds: string[];
  concurrencyLimit: number | null;
};

export type BookGenerationEvent =
  | {
      bookId: string;
      type: 'progress';
      phase: string;
      stepLabel: string;
      currentVolume?: number | null;
      currentChapter?: number | null;
    }
  | {
      bookId: string;
      type: 'chapter-stream';
      volumeIndex: number;
      chapterIndex: number;
      title: string;
      delta: string;
      replace?: boolean;
    }
  | {
      bookId: string;
      type: 'chapter-complete';
      volumeIndex: number;
      chapterIndex: number;
      title: string;
    }
  | {
      bookId: string;
      type: 'error';
      phase: string;
      stepLabel: string;
      error: string;
      currentVolume?: number | null;
      currentChapter?: number | null;
    };

export type BookExportFormat = 'txt' | 'md';

export const ipcChannels = {
  bookCreate: 'book:create',
  bookDelete: 'book:delete',
  bookList: 'book:list',
  bookDetail: 'book:detail',
  bookStart: 'book:start',
  bookPause: 'book:pause',
  bookWriteNext: 'book:writeNext',
  bookWriteAll: 'book:writeAll',
  bookResume: 'book:resume',
  bookRestart: 'book:restart',
  bookExport: 'book:export',
  schedulerStartAll: 'scheduler:startAll',
  schedulerPauseAll: 'scheduler:pauseAll',
  schedulerStatus: 'scheduler:status',
  schedulerProgress: 'scheduler:progress',
  bookGeneration: 'book:generation',
  bookChapterDone: 'book:chapterDone',
  bookError: 'book:error',
  modelList: 'model:list',
  modelSave: 'model:save',
  modelTest: 'model:test',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
} as const;
