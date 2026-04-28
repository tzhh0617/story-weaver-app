import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  ipcChannels,
  type BookExportFormat,
  type BookRecord,
  type SchedulerStatus,
} from '../src/shared/contracts';
import { useIpc } from './hooks/useIpc';
import { useProgress } from './hooks/useProgress';
import { AppSidebar, type AppView } from './components/app-sidebar';
import { Alert } from './components/ui/alert';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import Library from './pages/Library';
import NewBook from './pages/NewBook';
import Settings from './pages/Settings';
import type { BookDetailData } from './types/book-detail';

const defaultScheduler: SchedulerStatus = {
  runningBookIds: [],
  queuedBookIds: [],
  pausedBookIds: [],
  concurrencyLimit: null,
};

type BannerTone = 'error' | 'success' | 'info';

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
  const [currentView, setCurrentView] = useState<AppView>('library');
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [selectedBookDetail, setSelectedBookDetail] = useState<BookDetailData | null>(
    null
  );

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

  async function loadBookDetail(bookId: string) {
    const detail = await ipc.invoke<BookDetailData | null>(
      ipcChannels.bookDetail,
      { bookId }
    );
    setSelectedBookId(bookId);
    setSelectedBookDetail(detail);
  }

  useEffect(() => {
    void loadBooks();
    void loadModels();
  }, []);

  useEffect(() => {
    void loadBooks();
  }, [
    progress.runningBookIds.join(','),
    progress.queuedBookIds.join(','),
    progress.pausedBookIds.join(','),
  ]);

  useEffect(() => {
    if (!books.length) {
      setSelectedBookId(null);
      setSelectedBookDetail(null);
      return;
    }

    if (selectedBookId && books.some((book) => book.id === selectedBookId)) {
      return;
    }

    void loadBookDetail(books[0].id);
  }, [books, selectedBookId]);

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
        await loadBookDetail(selectedBookId);
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

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar currentView={currentView} onSelectView={setCurrentView} />
      <SidebarInset>
        <main className="grid w-full min-h-screen content-start gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <section className="w-full rounded-lg border bg-card px-8 py-7 shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">
              Story Weaver
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              AI Long-Form Fiction Studio
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
              Coordinate worldbuilding, outline generation, and chapter writing from
              one desktop console.
            </p>
          </section>
          {banner ? <Alert tone={banner.tone}>{banner.message}</Alert> : null}
          {currentView === 'library' ? (
            <Library
              books={books}
              scheduler={progress ?? defaultScheduler}
              selectedBookId={selectedBookId}
              selectedBookDetail={selectedBookDetail}
              onSelectBook={(bookId) => {
                void loadBookDetail(bookId);
              }}
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
                    await loadBookDetail(selectedBookId);
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
              onResume={async () => {
                await runSelectedBookAction({
                  startMessage: '正在恢复写作...',
                  errorMessage: 'Failed to resume book',
                  channel: ipcChannels.bookResume,
                });
              }}
              onRestart={async () => {
                await runSelectedBookAction({
                  startMessage: '正在重新开始写作...',
                  errorMessage: 'Failed to restart book',
                  channel: ipcChannels.bookRestart,
                });
              }}
              onPause={async () => {
                await runSelectedBookAction({
                  startMessage: null,
                  errorMessage: 'Failed to pause book',
                  channel: ipcChannels.bookPause,
                });
              }}
              onWriteNext={async () => {
                await runSelectedBookAction({
                  startMessage: '正在生成章节正文...',
                  errorMessage: 'Failed to write next chapter',
                  channel: ipcChannels.bookWriteNext,
                });
              }}
              onWriteAll={async () => {
                await runSelectedBookAction({
                  startMessage: '正在连续生成章节正文...',
                  errorMessage: 'Failed to continue writing',
                  channel: ipcChannels.bookWriteAll,
                });
              }}
              onExport={async (format: BookExportFormat) => {
                if (!selectedBookId) {
                  return;
                }

                try {
                  showBanner('info', `正在导出 ${format.toUpperCase()}...`);
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
                  startMessage: '正在删除作品...',
                  errorMessage: 'Failed to delete book',
                  channel: ipcChannels.bookDelete,
                  successMessage: '作品已删除',
                  clearSelection: true,
                });
              }}
            />
          ) : null}
          {currentView === 'new-book' ? (
            <NewBook
              onCreate={async (input) => {
                try {
                  flushSync(() => {
                    setBanner({
                      tone: 'info',
                      message: '正在生成大纲...',
                    });
                  });
                  const bookId = await ipc.invoke<string>(
                    ipcChannels.bookCreate,
                    input
                  );
                  await ipc.invoke(ipcChannels.bookStart, { bookId });
                  await loadBooks();
                  setCurrentView('library');
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
                  flushSync(() => {
                    setBanner({
                      tone: 'info',
                      message: '正在测试模型连接...',
                    });
                  });
                  await ipc.invoke(ipcChannels.modelSave, input);
                  const result = await ipc.invoke<{
                    ok: boolean;
                    latency: number;
                    error: string | null;
                  }>(ipcChannels.modelTest, {
                    modelId: input.id,
                  });

                  if (!result.ok) {
                    flushSync(() => {
                      setBanner({
                        tone: 'error',
                        message: result.error ?? 'Model test failed',
                      });
                    });
                  } else {
                    flushSync(() => {
                      setBanner({
                        tone: 'success',
                        message: `连接成功（${result.latency}ms）`,
                      });
                    });
                  }
                } catch (error) {
                  flushSync(() => {
                    setBanner({
                      tone: 'error',
                      message:
                        error instanceof Error ? error.message : 'Model test failed',
                    });
                  });
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
              onDeleteModel={async (modelId) => {
                try {
                  flushSync(() => {
                    setBanner({
                      tone: 'info',
                      message: '正在删除模型...',
                    });
                  });
                  await ipc.invoke(ipcChannels.modelDelete, {
                    id: modelId,
                  });
                  await loadModels();
                  flushSync(() => {
                    setBanner({
                      tone: 'success',
                      message: '模型已删除',
                    });
                  });
                } catch (error) {
                  flushSync(() => {
                    setBanner({
                      tone: 'error',
                      message:
                        error instanceof Error
                          ? error.message
                          : 'Failed to delete model',
                    });
                  });
                }
              }}
              concurrencyLimit={progress?.concurrencyLimit ?? null}
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
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
