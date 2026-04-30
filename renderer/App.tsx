import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import {
  parseBooleanSetting,
  serializeBooleanSetting,
  SHORT_CHAPTER_REVIEW_ENABLED_KEY,
} from '../src/core/chapter-review';
import {
  ipcChannels,
  type BookGenerationEvent,
  type BookExportFormat,
  type BookRecord,
  type ExecutionLogRecord,
  type SchedulerStatus,
} from '../src/shared/contracts';
import { useIpc } from './hooks/useIpc';
import { useProgress } from './hooks/useProgress';
import { AppSidebar, type AppView } from './components/app-sidebar';
import { Alert } from './components/ui/alert';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import BookDetail from './pages/BookDetail';
import Library from './pages/Library';
import Logs from './pages/Logs';
import NewBook from './pages/NewBook';
import Settings from './pages/Settings';
import type { BookDetailData } from './types/book-detail';

const defaultScheduler: SchedulerStatus = {
  runningBookIds: [],
  queuedBookIds: [],
  pausedBookIds: [],
  concurrencyLimit: null,
};

const sidebarProviderStyle = {
  '--sidebar-width': '12.75rem',
} as CSSProperties;

type BannerTone = 'error' | 'success' | 'info';
type ToastTone = BannerTone;

export default function App() {
  const ipc = useIpc();
  const progress = useProgress();
  const [books, setBooks] = useState<
    Array<
      BookRecord & {
        progress?: number;
        completedChapters?: number;
        totalChapters?: number;
      }
    >
  >([]);
  const [modelConfigs, setModelConfigs] = useState<
    Array<{
      id: string;
      provider: string;
      modelName: string;
      apiKey: string;
      baseUrl: string;
      config: Record<string, unknown>;
    }>
  >([]);
  const [banner, setBanner] = useState<{
    tone: BannerTone;
    message: string;
  } | null>(null);
  const [toast, setToast] = useState<{
    id: number;
    tone: ToastTone;
    message: string;
  } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentView, setCurrentView] = useState<AppView>('library');
  const [executionLogs, setExecutionLogs] = useState<ExecutionLogRecord[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const selectedBookIdRef = useRef<string | null>(null);
  const [selectedBookDetail, setSelectedBookDetail] = useState<BookDetailData | null>(
    null
  );
  const [liveOutput, setLiveOutput] = useState<{
    bookId: string;
    volumeIndex: number;
    chapterIndex: number;
    title: string;
    content: string;
  } | null>(null);
  const [shortChapterReviewEnabled, setShortChapterReviewEnabled] =
    useState(true);

  async function loadBooks() {
    const nextBooks = await ipc.invoke<BookRecord[]>(ipcChannels.bookList);
    const safeBooks = Array.isArray(nextBooks) ? nextBooks : [];
    const nextBooksWithProgress = await Promise.all(
      safeBooks.map(async (book) => {
        const detail = await ipc.invoke<BookDetailData | null>(
          ipcChannels.bookDetail,
          { bookId: book.id }
        );

        if (!detail?.chapters.length) {
          return {
            ...book,
            progress: 0,
            completedChapters: 0,
            totalChapters: 0,
          };
        }

        const completedChapters = detail.chapters.filter(
          (chapter) => chapter.content
        ).length;
        const totalChapters = detail.chapters.length;

        return {
          ...book,
          progress: Math.round((completedChapters / totalChapters) * 100),
          completedChapters,
          totalChapters,
        };
      })
    );

    setBooks(nextBooksWithProgress);
  }

  async function loadModels() {
    const nextConfigs = await ipc.invoke<
      Array<{
        id: string;
        provider: string;
        modelName: string;
        apiKey: string;
        baseUrl: string;
        config: Record<string, unknown>;
      }>
    >(ipcChannels.modelList);
    const safeConfigs = Array.isArray(nextConfigs) ? nextConfigs : [];

    setModelConfigs(safeConfigs);
  }

  async function loadSettings() {
    const nextValue = await ipc.invoke<string | null>(
      ipcChannels.settingsGet,
      SHORT_CHAPTER_REVIEW_ENABLED_KEY
    );

    setShortChapterReviewEnabled(parseBooleanSetting(nextValue));
  }

  async function loadBookDetail(
    bookId: string,
    options?: { openView?: boolean; preserveExistingOnMissing?: boolean }
  ) {
    setSelectedBookId(bookId);
    const detail = await ipc.invoke<BookDetailData | null>(
      ipcChannels.bookDetail,
      { bookId }
    );
    setSelectedBookDetail((currentDetail) => {
      if (detail) {
        return detail;
      }

      if (
        options?.preserveExistingOnMissing &&
        currentDetail?.book.id === bookId
      ) {
        return currentDetail;
      }

      return null;
    });

    if (options?.openView ?? true) {
      setCurrentView('book-detail');
    }
  }

  useEffect(() => {
    void loadBooks();
    void loadModels();
    void loadSettings();

    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    void (async () => {
      await loadBooks();

      if (selectedBookId) {
        await loadBookDetail(selectedBookId, {
          openView: false,
          preserveExistingOnMissing: true,
        });
      }

    })();
  }, [progress, selectedBookId]);

  useEffect(() => {
    const unsubscribe = ipc.onExecutionLog((payload) => {
      setExecutionLogs((currentLogs) => [
        ...currentLogs,
        payload as ExecutionLogRecord,
      ]);
    });

    return unsubscribe;
  }, [ipc]);

  useEffect(() => {
    if (!books.length) {
      if (currentView === 'book-detail' && selectedBookDetail) {
        return;
      }

      setSelectedBookId(null);
      setSelectedBookDetail(null);
      if (currentView === 'book-detail') {
        setCurrentView('library');
      }
      return;
    }

    if (selectedBookId && books.some((book) => book.id === selectedBookId)) {
      return;
    }

    void loadBookDetail(books[0].id, { openView: false });
  }, [books, currentView, selectedBookDetail, selectedBookId]);

  useEffect(() => {
    selectedBookIdRef.current = selectedBookId;
  }, [selectedBookId]);

  useEffect(() => {
    setLiveOutput(null);
  }, [selectedBookId]);

  useEffect(() => {
    const unsubscribe = ipc.onBookGeneration((payload) => {
      const event = payload as BookGenerationEvent;

      setSelectedBookDetail((currentDetail) => {
        if (!currentDetail || event.bookId !== currentDetail.book.id) {
          return currentDetail;
        }

        if (event.type === 'progress') {
          return {
            ...currentDetail,
            progress: {
              ...(currentDetail.progress ?? {}),
              phase: event.phase,
              stepLabel: event.stepLabel,
              currentVolume: event.currentVolume ?? null,
              currentChapter: event.currentChapter ?? null,
            },
          };
        }

        if (event.type === 'error') {
          return {
            ...currentDetail,
            progress: {
              ...(currentDetail.progress ?? {}),
              phase: event.phase,
              stepLabel: event.stepLabel,
              currentVolume: event.currentVolume ?? null,
              currentChapter: event.currentChapter ?? null,
            },
          };
        }

        return currentDetail;
      });

      if (event.type === 'chapter-stream') {
        setLiveOutput((currentOutput) => {
          if (selectedBookIdRef.current !== event.bookId) {
            return currentOutput;
          }

          if (
            currentOutput &&
            currentOutput.bookId === event.bookId &&
            currentOutput.volumeIndex === event.volumeIndex &&
            currentOutput.chapterIndex === event.chapterIndex
          ) {
            return {
              ...currentOutput,
              content: event.replace
                ? event.delta
                : `${currentOutput.content}${event.delta}`,
            };
          }

          return {
            bookId: event.bookId,
            volumeIndex: event.volumeIndex,
            chapterIndex: event.chapterIndex,
            title: event.title,
            content: event.delta,
          };
        });
      }

      if (event.type === 'chapter-complete' || event.type === 'error') {
        if (selectedBookIdRef.current === event.bookId) {
          if (event.type === 'chapter-complete') {
            setLiveOutput(null);
          }
          void loadBookDetail(event.bookId, {
            openView: false,
            preserveExistingOnMissing: true,
          });
        }
      }
    });

    return unsubscribe;
  }, [ipc, selectedBookId]);

  function showBanner(tone: BannerTone, message: string) {
    flushSync(() => {
      setBanner({ tone, message });
    });
  }

  function clearBanner() {
    flushSync(() => {
      setBanner(null);
    });
  }

  function showToast(tone: ToastTone, message: string) {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    flushSync(() => {
      setToast({
        id: Date.now(),
        tone,
        message,
      });
    });

    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3600);
  }

  function getRenderedChapterStatus(chapter: BookDetailData['chapters'][number]) {
    if (chapter.content) {
      return 'done' as const;
    }

    const currentVolume =
      selectedBookDetail?.progress?.currentVolume ?? liveOutput?.volumeIndex;
    const currentChapter =
      selectedBookDetail?.progress?.currentChapter ?? liveOutput?.chapterIndex;

    if (
      selectedBookDetail?.book.status === 'writing' &&
      chapter.volumeIndex === currentVolume &&
      chapter.chapterIndex === currentChapter
    ) {
      return 'writing' as const;
    }

    return 'queued' as const;
  }

  const toastClassName = toast
    ? {
        info: 'border-primary/30 bg-background text-foreground shadow-[0_18px_45px_rgba(36,28,18,0.18)]',
        success:
          'border-emerald-500/30 bg-background text-foreground shadow-[0_18px_45px_rgba(36,28,18,0.18)]',
        error:
          'border-destructive/40 bg-background text-destructive shadow-[0_18px_45px_rgba(36,28,18,0.18)]',
      }[toast.tone]
    : '';

  async function runSelectedBookAction({
    startMessage,
    errorMessage,
    channel,
    payload,
    successMessage,
    clearSelection,
  }: {
    startMessage: string | null;
    errorMessage: string;
    channel: string;
    payload?: Record<string, unknown>;
    successMessage?: string | null;
    clearSelection?: boolean;
  }) {
    if (!selectedBookId) {
      return;
    }

    try {
      if (startMessage) {
        showBanner('info', startMessage);
      } else {
        clearBanner();
      }

      await ipc.invoke(channel, payload ?? { bookId: selectedBookId });

      if (clearSelection) {
        setSelectedBookId(null);
        setSelectedBookDetail(null);
      }

      await loadBooks();

      if (!clearSelection) {
        await loadBookDetail(selectedBookId, {
          preserveExistingOnMissing: true,
        });
      }

      if (typeof successMessage === 'string') {
        showBanner('success', successMessage);
      } else {
        clearBanner();
      }
    } catch (error) {
      showBanner(
        'error',
        error instanceof Error ? error.message : errorMessage
      );
    }
  }

  const isBookDetailWorkbench =
    currentView === 'book-detail' && Boolean(selectedBookDetail);

  return (
    <SidebarProvider
      defaultOpen
      style={sidebarProviderStyle}
      className="app-paper-background relative h-svh overflow-hidden"
    >
      <div aria-hidden="true" className="app-titlebar-drag-region" />
      <AppSidebar currentView={currentView} onSelectView={setCurrentView} />
      {toast ? (
        <div
          role={toast.tone === 'error' ? 'alert' : 'status'}
          aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
          className={`fixed right-5 top-[calc(var(--app-titlebar-height)+1rem)] z-50 max-w-sm rounded-lg border px-4 py-3 text-sm font-medium ${toastClassName}`}
        >
          {toast.message}
        </div>
      ) : null}
      <SidebarInset className="app-paper-background min-w-0 flex-1 overflow-hidden">
        <main
          data-testid="app-content-scrollport"
          className={`app-content-scrollport h-svh w-full px-5 pb-5 pt-[calc(var(--app-titlebar-height)+1.25rem)] ${
            isBookDetailWorkbench ? 'overflow-hidden' : 'overflow-y-auto'
          }`}
        >
          <div
            data-testid="app-view-frame"
            className={`w-full gap-5 ${
              isBookDetailWorkbench
                ? 'flex h-full min-h-0 flex-col'
                : 'grid content-start'
            }`}
          >
          {banner ? <Alert tone={banner.tone}>{banner.message}</Alert> : null}
          {currentView === 'library' ? (
            <Library
              books={books}
              scheduler={progress ?? defaultScheduler}
              onSelectBook={(bookId) => {
                void loadBookDetail(bookId, { openView: true });
              }}
              onCreateBook={() => setCurrentView('new-book')}
              onStartAll={async () => {
                try {
                  flushSync(() => {
                    setBanner({
                      tone: 'info',
                      message: '正在批量推进书籍写作...',
                    });
                  });
                  await ipc.invoke(ipcChannels.schedulerStartAll);
                  await loadBooks();
                  flushSync(() => {
                    setBanner(null);
                  });
                } catch (error) {
                  flushSync(() => {
                    setBanner({
                      tone: 'error',
                      message:
                        error instanceof Error
                          ? error.message
                          : 'Failed to start all books',
                    });
                  });
                }
              }}
              onPauseAll={async () => {
                try {
                  flushSync(() => {
                    setBanner({
                      tone: 'info',
                      message: '正在暂停所有书籍...',
                    });
                  });
                  await ipc.invoke(ipcChannels.schedulerPauseAll);
                  await loadBooks();
                  if (selectedBookId) {
                    await loadBookDetail(selectedBookId, { openView: false });
                  }
                  flushSync(() => {
                    setBanner(null);
                  });
                } catch (error) {
                  flushSync(() => {
                    setBanner({
                      tone: 'error',
                      message:
                        error instanceof Error
                          ? error.message
                          : 'Failed to pause all books',
                    });
                  });
                }
              }}
            />
          ) : null}
          {currentView === 'book-detail' && selectedBookDetail ? (
            <BookDetail
              book={{
                title: selectedBookDetail.book?.title ?? 'Unknown Book',
                status: selectedBookDetail.book?.status ?? 'error',
                wordCount: selectedBookDetail.chapters.reduce(
                  (sum, chapter) => sum + chapter.wordCount,
                  0
                ),
              }}
              context={selectedBookDetail.context}
              latestScene={selectedBookDetail.latestScene}
              characterStates={selectedBookDetail.characterStates}
              plotThreads={selectedBookDetail.plotThreads}
              progress={selectedBookDetail.progress}
              liveOutput={
                liveOutput && liveOutput.bookId === selectedBookDetail.book.id
                  ? liveOutput
                  : null
              }
              onBackToLibrary={() => setCurrentView('library')}
              onResume={async () => {
                await runSelectedBookAction({
                  startMessage: null,
                  errorMessage: 'Failed to resume book',
                  channel: ipcChannels.bookResume,
                });
              }}
              onRestart={async () => {
                await runSelectedBookAction({
                  startMessage: null,
                  errorMessage: 'Failed to restart book',
                  channel: ipcChannels.bookRestart,
                });
              }}
              chapters={selectedBookDetail.chapters.map((chapter) => ({
                id: `${chapter.volumeIndex}-${chapter.chapterIndex}`,
                volumeIndex: chapter.volumeIndex,
                chapterIndex: chapter.chapterIndex,
                title:
                  chapter.title ??
                  `Chapter ${chapter.volumeIndex}.${chapter.chapterIndex}`,
                wordCount: chapter.wordCount,
                status: getRenderedChapterStatus(chapter),
                content: chapter.content,
                summary: chapter.summary,
                outline: chapter.outline,
              }))}
              onPause={async () => {
                await runSelectedBookAction({
                  startMessage: null,
                  errorMessage: 'Failed to pause book',
                  channel: ipcChannels.bookPause,
                });
              }}
              onExport={async (format: BookExportFormat) => {
                if (!selectedBookId) {
                  return;
                }

                try {
                  const filePath = await ipc.invoke<string>(ipcChannels.bookExport, {
                    bookId: selectedBookId,
                    format,
                  });
                  showBanner('success', `导出完成：${filePath}`);
                } catch (error) {
                  showBanner(
                    'error',
                    error instanceof Error ? error.message : 'Failed to export book'
                  );
                }
              }}
              onDelete={async () => {
                await runSelectedBookAction({
                  startMessage: null,
                  errorMessage: 'Failed to delete book',
                  channel: ipcChannels.bookDelete,
                  successMessage: '作品已删除',
                  clearSelection: true,
                });
                setCurrentView('library');
              }}
            />
          ) : null}
          {currentView === 'logs' ? (
            <Logs
              logs={executionLogs}
              books={books}
            />
          ) : null}
          {currentView === 'new-book' ? (
            <NewBook
              onCreate={async (input) => {
                if (!ipc.isAvailable) {
                  showBanner('error', '请在桌面应用中创建作品。');
                  return;
                }

                try {
                  flushSync(() => {
                    setBanner({
                      tone: 'info',
                      message: '正在创建作品...',
                    });
                  });
                  const bookId = await ipc.invoke<string>(
                    ipcChannels.bookCreate,
                    input
                  );
                  await loadBooks();
                  await loadBookDetail(bookId, { openView: true });
                  flushSync(() => {
                    setBanner({
                      tone: 'info',
                      message: '书本已创建，正在生成书名...',
                    });
                  });

                  void (async () => {
                    try {
                      await ipc.invoke(ipcChannels.bookStart, { bookId });
                      await loadBooks();
                      await loadBookDetail(bookId, {
                        openView: false,
                        preserveExistingOnMissing: true,
                      });
                      flushSync(() => {
                        setBanner(null);
                      });
                    } catch (error) {
                      flushSync(() => {
                        setBanner({
                          tone: 'error',
                          message:
                            error instanceof Error
                              ? error.message
                              : 'Failed to start book',
                        });
                      });
                    }
                  })();
                } catch (error) {
                  flushSync(() => {
                    setBanner({
                      tone: 'error',
                      message:
                        error instanceof Error
                          ? error.message
                          : 'Failed to start book',
                    });
                  });
                }
              }}
            />
          ) : null}
          {currentView === 'settings' ? (
            <Settings
              onSaveModel={async (input) => {
                await ipc.invoke(ipcChannels.modelSave, input);
                await loadModels();
              }}
              onTestModel={async (input) => {
                try {
                  clearBanner();
                  showToast('info', '正在测试模型连接...');
                  await ipc.invoke(ipcChannels.modelSave, input);
                  const result = await ipc.invoke<{
                    ok: boolean;
                    latency: number;
                    error: string | null;
                  }>(ipcChannels.modelTest, {
                    modelId: input.id,
                  });

                  if (!result.ok) {
                    showToast('error', result.error ?? 'Model test failed');
                  } else {
                    showToast('success', `连接成功（${result.latency}ms）`);
                  }
                } catch (error) {
                  showToast(
                    'error',
                    error instanceof Error ? error.message : 'Model test failed'
                  );
                }
                await loadModels();
              }}
              models={modelConfigs.map((config) => ({
                id: config.id,
                modelName: config.modelName,
                provider: config.provider,
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                config: config.config,
              }))}
              concurrencyLimit={progress?.concurrencyLimit ?? null}
              shortChapterReviewEnabled={shortChapterReviewEnabled}
              onSaveSetting={async (input) => {
                try {
                  flushSync(() => {
                    setBanner({
                      tone: 'info',
                      message: '正在保存设置...',
                    });
                  });
                  await ipc.invoke(ipcChannels.settingsSet, {
                    key: 'scheduler.concurrencyLimit',
                    value:
                      input.concurrencyLimit === null
                        ? ''
                        : String(input.concurrencyLimit),
                  });
                  await ipc.invoke(ipcChannels.settingsSet, {
                    key: SHORT_CHAPTER_REVIEW_ENABLED_KEY,
                    value: serializeBooleanSetting(
                      input.shortChapterReviewEnabled
                    ),
                  });
                  setShortChapterReviewEnabled(
                    input.shortChapterReviewEnabled
                  );
                  flushSync(() => {
                    setBanner({
                      tone: 'success',
                      message: '设置已保存',
                    });
                  });
                } catch (error) {
                  flushSync(() => {
                    setBanner({
                      tone: 'error',
                      message:
                        error instanceof Error ? error.message : 'Failed to save settings',
                    });
                  });
                }
              }}
            />
          ) : null}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
