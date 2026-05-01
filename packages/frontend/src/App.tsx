import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { flushSync } from 'react-dom';
import {
  Navigate,
  Routes,
  Route,
  useParams,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import {
  parseBooleanSetting,
  serializeBooleanSetting,
  SHORT_CHAPTER_REVIEW_ENABLED_KEY,
} from '@story-weaver/shared/settings';
import {
  type BookExportFormat,
  type ExecutionLogRecord,
  type SchedulerStatus,
} from '@story-weaver/shared/contracts';
import { useStoryWeaverApi } from './hooks/useStoryWeaverApi';
import { useProgress } from './hooks/useProgress';
import { useBookGenerationEvents } from './hooks/useBookGenerationEvents';
import { useBooksController } from './hooks/useBooksController';
import { AppSidebar } from './components/app-sidebar';
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

type ToastTone = 'error' | 'success' | 'info';
type ModelConfigView = {
  id: string;
  provider: string;
  modelName: string;
  apiKey: string;
  baseUrl: string;
  config: Record<string, unknown>;
};

function BookDetailLoader({
  onLoad,
}: {
  onLoad: (bookId: string) => void;
}) {
  const { bookId } = useParams<{ bookId: string }>();
  useEffect(() => {
    if (bookId) onLoad(bookId);
  }, [bookId, onLoad]);
  return null;
}

export default function App() {
  const api = useStoryWeaverApi();
  const progress = useProgress();
  const navigate = useNavigate();
  const location = useLocation();
  const [modelConfigs, setModelConfigs] = useState<ModelConfigView[]>([]);
  const [toast, setToast] = useState<{
    id: number;
    tone: ToastTone;
    message: string;
  } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [executionLogs, setExecutionLogs] = useState<ExecutionLogRecord[]>([]);
  const [shortChapterReviewEnabled, setShortChapterReviewEnabled] =
    useState(true);
  const {
    books,
    selectedBookId,
    selectedBookIdRef,
    selectedBookDetail,
    setSelectedBookDetail,
    loadBooks,
    loadBookDetail: loadBookDetailRecord,
    clearSelectedBook,
  } = useBooksController(api);

  const liveOutput = useBookGenerationEvents({
    api,
    selectedBookId,
    selectedBookIdRef,
    setSelectedBookDetail,
    loadBookDetail: loadBookDetailRecord,
  });

  const handleLoadBookFromUrl = useCallback(
    (bookId: string) => {
      void loadBookDetailRecord(bookId);
    },
    [loadBookDetailRecord]
  );

  async function loadModels() {
    const nextConfigs = await api.listModels();
    const safeConfigs = Array.isArray(nextConfigs) ? nextConfigs : [];

    setModelConfigs(safeConfigs);
  }

  async function loadSettings() {
    const nextValue = await api.getSetting(SHORT_CHAPTER_REVIEW_ENABLED_KEY);

    setShortChapterReviewEnabled(
      parseBooleanSetting(typeof nextValue === 'string' ? nextValue : null)
    );
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
        await loadBookDetailRecord(selectedBookId, {
          preserveExistingOnMissing: true,
        });
      }
    })();
  }, [progress, selectedBookId]);

  useEffect(() => {
    const unsubscribe = api.onExecutionLog((payload) => {
      setExecutionLogs((currentLogs) => [
        ...currentLogs,
        payload as ExecutionLogRecord,
      ]);
    });

    return unsubscribe;
  }, [api]);

  useEffect(() => {
    if (!books.length) {
      if (location.pathname.startsWith('/books/') && selectedBookDetail) {
        return;
      }
      clearSelectedBook();
      return;
    }

    if (selectedBookId && !books.some((book) => book.id === selectedBookId)) {
      clearSelectedBook();
    }
  }, [books, clearSelectedBook, selectedBookDetail, selectedBookId, location.pathname]);

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
    run,
    successMessage,
    clearSelection,
  }: {
    startMessage: string | null;
    errorMessage: string;
    run: (bookId: string) => Promise<void>;
    successMessage?: string | null;
    clearSelection?: boolean;
  }) {
    if (!selectedBookId) {
      return;
    }

    try {
      if (startMessage) {
        showToast('info', startMessage);
      }

      await run(selectedBookId);

      if (clearSelection) {
        clearSelectedBook();
      }

      await loadBooks();

      if (!clearSelection) {
        await loadBookDetailRecord(selectedBookId, {
          preserveExistingOnMissing: true,
        });
      }

      if (typeof successMessage === 'string') {
        showToast('success', successMessage);
      }
    } catch (error) {
      showToast(
        'error',
        error instanceof Error ? error.message : errorMessage
      );
    }
  }

  const isBookDetailWorkbench =
    location.pathname.startsWith('/books/') && Boolean(selectedBookDetail);

  return (
    <SidebarProvider
      defaultOpen
      style={sidebarProviderStyle}
      className="app-paper-background relative h-svh overflow-hidden"
    >
      <div aria-hidden="true" className="app-titlebar-drag-region" />
      <AppSidebar />
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
          <Routes>
            <Route path="/" element={
              <Library
                books={books}
                scheduler={progress ?? defaultScheduler}
                onSelectBook={(bookId) => {
                  navigate(`/books/${bookId}`);
                }}
                onCreateBook={() => navigate('/new-book')}
                onStartAll={async () => {
                  try {
                    showToast('info', '正在批量推进书籍写作...');
                    await api.startScheduler();
                    await loadBooks();
                    showToast('success', '批量写作已开始');
                  } catch (error) {
                    showToast(
                      'error',
                      error instanceof Error
                        ? error.message
                        : 'Failed to start all books'
                    );
                  }
                }}
                onPauseAll={async () => {
                  try {
                    showToast('info', '正在暂停所有书籍...');
                    await api.pauseScheduler();
                    await loadBooks();
                    if (selectedBookId) {
                      await loadBookDetailRecord(selectedBookId);
                    }
                    showToast('success', '全部书籍已暂停');
                  } catch (error) {
                    showToast(
                      'error',
                      error instanceof Error
                        ? error.message
                        : 'Failed to pause all books'
                    );
                  }
                }}
              />
            } />
            <Route path="/books/:bookId" element={
              <>
                <BookDetailLoader onLoad={handleLoadBookFromUrl} />
                {selectedBookDetail ? (
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
                    narrative={selectedBookDetail.narrative}
                    characterStates={selectedBookDetail.characterStates}
                    plotThreads={selectedBookDetail.plotThreads}
                    progress={selectedBookDetail.progress}
                    isActive={
                      selectedBookId
                        ? progress.runningBookIds.includes(selectedBookId) ||
                          progress.queuedBookIds.includes(selectedBookId)
                        : false
                    }
                    liveOutput={
                      liveOutput && liveOutput.bookId === selectedBookDetail.book.id
                        ? liveOutput
                        : null
                    }
                    executionLogs={executionLogs.filter(
                      (log) => log.bookId === selectedBookDetail.book.id
                    )}
                    onBackToLibrary={() => navigate('/')}
                    onResume={async () => {
                      await runSelectedBookAction({
                        startMessage: '正在恢复写作...',
                        errorMessage: 'Failed to resume book',
                        run: (bookId) => api.resumeBook(bookId),
                        successMessage: '作品已恢复写作',
                      });
                    }}
                    onRestart={async () => {
                      await runSelectedBookAction({
                        startMessage: '正在重新开始写作...',
                        errorMessage: 'Failed to restart book',
                        run: (bookId) => api.restartBook(bookId),
                        successMessage: '作品已重新开始',
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
                      auditScore: chapter.auditScore,
                      auditFlatnessScore: chapter.auditFlatnessScore,
                      auditFlatnessIssues: chapter.auditFlatnessIssues,
                      draftAttempts: chapter.draftAttempts,
                    }))}
                    onPause={async () => {
                      await runSelectedBookAction({
                        startMessage: '正在暂停作品...',
                        errorMessage: 'Failed to pause book',
                        run: (bookId) => api.pauseBook(bookId),
                        successMessage: '作品已暂停',
                      });
                    }}
                    onExport={async (format: BookExportFormat) => {
                      if (!selectedBookId) {
                        return;
                      }

                      try {
                        showToast('info', `正在导出 ${format.toUpperCase()}...`);
                        const filePath = await api.exportBook(selectedBookId, format);
                        showToast('success', `导出完成：${filePath}`);
                      } catch (error) {
                        showToast(
                          'error',
                          error instanceof Error ? error.message : 'Failed to export book'
                        );
                      }
                    }}
                    onDelete={async () => {
                      await runSelectedBookAction({
                        startMessage: '正在删除作品...',
                        errorMessage: 'Failed to delete book',
                        run: (bookId) => api.deleteBook(bookId),
                        successMessage: '作品已删除',
                        clearSelection: true,
                      });
                      navigate('/');
                    }}
                  />
                ) : null}
              </>
            } />
            <Route path="/new-book" element={
              <NewBook
                onCreate={async (input) => {
                  try {
                    showToast('info', '正在创建作品...');
                    const bookId = await api.createBook(input);
                    await loadBooks();
                    navigate(`/books/${bookId}`);
                    showToast('info', '书本已创建，正在生成书名...');

                    void (async () => {
                      try {
                        await api.startBook(bookId);
                        await loadBooks();
                        await loadBookDetailRecord(bookId, {
                          preserveExistingOnMissing: true,
                        });
                      } catch (error) {
                        showToast(
                          'error',
                          error instanceof Error
                            ? error.message
                            : 'Failed to start book'
                        );
                      }
                    })();
                  } catch (error) {
                    showToast(
                      'error',
                      error instanceof Error
                        ? error.message
                        : 'Failed to start book'
                    );
                  }
                }}
              />
            } />
            <Route path="/logs" element={
              <Logs
                logs={executionLogs}
                books={books}
              />
            } />
            <Route path="/settings" element={
              <Settings
                onSaveModel={async (input) => {
                  try {
                    showToast('info', '正在保存模型...');
                    await api.saveModel(input);
                    await loadModels();
                    showToast('success', '模型已保存');
                  } catch (error) {
                    showToast(
                      'error',
                      error instanceof Error ? error.message : 'Failed to save model'
                    );
                    throw error;
                  }
                }}
                onTestModel={async (input) => {
                  try {
                    showToast('info', '正在测试模型连接...');
                    await api.saveModel(input);
                    const result = await api.testModel(input.id);

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
                    showToast('info', '正在保存设置...');
                    await api.setSetting(
                      'scheduler.concurrencyLimit',
                      input.concurrencyLimit === null
                        ? ''
                        : String(input.concurrencyLimit)
                    );
                    await api.setSetting(
                      SHORT_CHAPTER_REVIEW_ENABLED_KEY,
                      serializeBooleanSetting(input.shortChapterReviewEnabled)
                    );
                    setShortChapterReviewEnabled(
                      input.shortChapterReviewEnabled
                    );
                    showToast('success', '设置已保存');
                  } catch (error) {
                    showToast(
                      'error',
                      error instanceof Error ? error.message : 'Failed to save settings'
                    );
                  }
                }}
              />
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
