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
import { Alert } from './components/ui/alert';
import Dashboard from './pages/Dashboard';
import BookDetail from './pages/BookDetail';
import NewBook from './pages/NewBook';
import Settings from './pages/Settings';

const defaultScheduler: SchedulerStatus = {
  runningBookIds: [],
  queuedBookIds: [],
  pausedBookIds: [],
  concurrencyLimit: null,
};

const fallbackModels = [
  { id: 'openai:gpt-4o-mini', label: 'GPT-4o mini' },
  { id: 'anthropic:claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' },
];

type BannerTone = 'error' | 'success' | 'info';

type BookDetailData = {
  book: BookRecord;
  context: {
    worldSetting?: string | null;
    outline?: string | null;
    styleGuide?: string | null;
  } | null;
  latestScene: {
    location: string;
    timeInStory: string;
    charactersPresent: string[];
    events: string | null;
  } | null;
  characterStates: Array<{
    characterId: string;
    characterName: string;
    volumeIndex: number;
    chapterIndex: number;
    location: string | null;
    status: string | null;
    knowledge: string | null;
    emotion: string | null;
    powerLevel: string | null;
  }>;
  plotThreads: Array<{
    id: string;
    description: string;
    plantedAt: number;
    expectedPayoff: number | null;
    resolvedAt: number | null;
    importance: string;
  }>;
  chapters: Array<{
    bookId: string;
    volumeIndex: number;
    chapterIndex: number;
    title: string | null;
    outline: string | null;
    content: string | null;
    summary: string | null;
    wordCount: number;
  }>;
  progress: {
    phase?: string | null;
  } | null;
};

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
  const [models, setModels] = useState<Array<{ id: string; label: string }>>(
    fallbackModels
  );
  const [banner, setBanner] = useState<{
    tone: BannerTone;
    message: string;
  } | null>(null);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [selectedBookDetail, setSelectedBookDetail] = useState<BookDetailData | null>(
    null
  );

  async function loadBooks() {
    const nextBooks = await ipc.invoke<BookRecord[]>(ipcChannels.bookList);
    const nextBooksWithProgress = await Promise.all(
      nextBooks.map(async (book) => {
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

    setModelConfigs(nextConfigs);

    if (!nextConfigs.length) {
      setModels(fallbackModels);
      return;
    }

    setModels(
      nextConfigs.map((config) => ({
        id: config.id,
        label: config.modelName,
      }))
    );
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

  return (
    <main className="grid min-h-screen content-start gap-6 px-8 py-8">
      <section className="w-full max-w-[1100px] rounded-[28px] border border-border/70 bg-card/90 px-9 py-8 shadow-panel">
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
          Story Weaver
        </p>
        <h1 className="text-[clamp(2.5rem,7vw,4.75rem)] leading-[0.95] tracking-tight">
          AI Long-Form Fiction Studio
        </h1>
        <p className="mt-4 max-w-4xl text-base leading-7 text-muted-foreground">
          Coordinate worldbuilding, outline generation, and chapter writing from one desktop console.
        </p>
      </section>
      {banner ? (
        <Alert tone={banner.tone} className="max-w-[1100px]">
          {banner.message}
        </Alert>
      ) : null}
      <div className="grid w-full max-w-[1100px] gap-6 lg:grid-cols-[1.4fr_0.9fr]">
        <Dashboard
          books={books}
          scheduler={progress ?? defaultScheduler}
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
        />
        <NewBook
          onCreate={async (input) => {
            try {
              flushSync(() => {
                setBanner({
                  tone: 'info',
                  message: '正在生成大纲...',
                });
              });
              const bookId = await ipc.invoke<string>(ipcChannels.bookCreate, input);
              await ipc.invoke(ipcChannels.bookStart, { bookId });
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
                      : 'Failed to start book',
                });
              });
            }
          }}
        />
      </div>
      <section className="grid w-full max-w-[1100px] gap-6">
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
                    error instanceof Error ? error.message : 'Failed to delete model',
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
      </section>
      {selectedBookDetail ? (
        <section className="grid w-full max-w-[1100px] gap-6">
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
            onResume={async () => {
              if (!selectedBookId) {
                return;
              }

              try {
                flushSync(() => {
                  setBanner({
                    tone: 'info',
                    message: '正在恢复写作...',
                  });
                });
                await ipc.invoke(ipcChannels.bookResume, {
                  bookId: selectedBookId,
                });
                await loadBooks();
                await loadBookDetail(selectedBookId);
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
                        : 'Failed to resume book',
                  });
                });
              }
            }}
            onRestart={async () => {
              if (!selectedBookId) {
                return;
              }

              try {
                flushSync(() => {
                  setBanner({
                    tone: 'info',
                    message: '正在重新开始写作...',
                  });
                });
                await ipc.invoke(ipcChannels.bookRestart, {
                  bookId: selectedBookId,
                });
                await loadBooks();
                await loadBookDetail(selectedBookId);
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
                        : 'Failed to restart book',
                  });
                });
              }
            }}
            chapters={selectedBookDetail.chapters.map((chapter) => ({
              id: `${chapter.volumeIndex}-${chapter.chapterIndex}`,
              volumeIndex: chapter.volumeIndex,
              chapterIndex: chapter.chapterIndex,
              title:
                chapter.title ??
                `Chapter ${chapter.volumeIndex}.${chapter.chapterIndex}`,
              wordCount: chapter.wordCount,
              status: chapter.content ? 'done' : 'queued',
              content: chapter.content,
              summary: chapter.summary,
            }))}
            onPause={async () => {
              if (!selectedBookId) {
                return;
              }

              try {
                flushSync(() => {
                  setBanner(null);
                });
                await ipc.invoke(ipcChannels.bookPause, {
                  bookId: selectedBookId,
                });
                await loadBooks();
                await loadBookDetail(selectedBookId);
              } catch (error) {
                flushSync(() => {
                  setBanner({
                    tone: 'error',
                    message:
                      error instanceof Error
                        ? error.message
                        : 'Failed to pause book',
                  });
                });
              }
            }}
            onWriteNext={async () => {
              if (!selectedBookId) {
                return;
              }

              try {
                flushSync(() => {
                  setBanner({
                    tone: 'info',
                    message: '正在生成章节正文...',
                  });
                });
                await ipc.invoke(ipcChannels.bookWriteNext, {
                  bookId: selectedBookId,
                });
                await loadBooks();
                await loadBookDetail(selectedBookId);
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
                        : 'Failed to write next chapter',
                  });
                });
              }
            }}
            onWriteAll={async () => {
              if (!selectedBookId) {
                return;
              }

              try {
                flushSync(() => {
                  setBanner({
                    tone: 'info',
                    message: '正在连续生成章节正文...',
                  });
                });
                await ipc.invoke(ipcChannels.bookWriteAll, {
                  bookId: selectedBookId,
                });
                await loadBooks();
                await loadBookDetail(selectedBookId);
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
                        : 'Failed to continue writing',
                  });
                });
              }
            }}
            onExport={async (format: BookExportFormat) => {
              if (!selectedBookId) {
                return;
              }

              try {
                flushSync(() => {
                  setBanner({
                    tone: 'info',
                    message: `正在导出 ${format.toUpperCase()}...`,
                  });
                });
                const filePath = await ipc.invoke<string>(ipcChannels.bookExport, {
                  bookId: selectedBookId,
                  format,
                });
                flushSync(() => {
                  setBanner({
                    tone: 'success',
                    message: `导出完成：${filePath}`,
                  });
                });
              } catch (error) {
                flushSync(() => {
                  setBanner({
                    tone: 'error',
                    message:
                      error instanceof Error ? error.message : 'Failed to export book',
                  });
                });
              }
            }}
            onDelete={async () => {
              if (!selectedBookId) {
                return;
              }

              try {
                flushSync(() => {
                  setBanner({
                    tone: 'info',
                    message: '正在删除作品...',
                  });
                });
                await ipc.invoke(ipcChannels.bookDelete, {
                  bookId: selectedBookId,
                });
                setSelectedBookId(null);
                setSelectedBookDetail(null);
                await loadBooks();
                flushSync(() => {
                  setBanner({
                    tone: 'success',
                    message: '作品已删除',
                  });
                });
              } catch (error) {
                flushSync(() => {
                  setBanner({
                    tone: 'error',
                    message:
                      error instanceof Error ? error.message : 'Failed to delete book',
                  });
                });
              }
            }}
          />
        </section>
      ) : null}
    </main>
  );
}
