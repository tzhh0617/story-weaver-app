# Story Library Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the renderer into a desktop-first story library where the home screen is a large-card archive for books and the selected title opens into a dedicated single-book dossier view.

**Architecture:** Keep Electron, IPC, and storage behavior unchanged. Concentrate the redesign inside the renderer by first separating library browsing from single-book detail routing, then rebuilding the library cards and detail hierarchy, and finally harmonizing the global visual system and supporting views so the whole app feels like one designed product instead of a stitched-together utility shell.

**Tech Stack:** Electron 33, React 19, TypeScript, Vite 6, Tailwind CSS 4, shadcn/ui, Radix UI, Vitest, Testing Library

---

## File Structure

- Modify: `renderer/App.tsx`
  Own the top-level app shell, compact library header, view switching between `library`, `book-detail`, `new-book`, and `settings`, and the selected-book orchestration.
- Modify: `renderer/components/app-sidebar.tsx`
  Keep the left navigation but restyle it to match the quieter archive tone and treat `book-detail` as part of the `作品` section.
- Modify: `renderer/pages/Library.tsx`
  Turn the current list-detail workspace into a true library view with a toolbar, summary metrics, and a book-card grid only.
- Modify: `renderer/components/BookCard.tsx`
  Replace the narrow list row with a desktop-scale archive card that combines a book-spine anchor, title block, stage summary, and production metadata.
- Modify: `renderer/pages/BookDetail.tsx`
  Convert the current inline detail panel into a standalone dossier page with a stronger header and chapters-first hierarchy.
- Modify: `renderer/components/EmptyState.tsx`
  Align empty states with the calmer archive card language.
- Modify: `renderer/pages/NewBook.tsx`
  Restyle the create flow so it belongs to the new shell without changing submission behavior.
- Modify: `renderer/pages/Settings.tsx`
  Restyle settings to share the same typography, border, and spacing language.
- Modify: `renderer/index.css`
  Define the new global color, border, radius, surface, and typography tokens.
- Modify: `tests/renderer/app-shell.test.tsx`
  Cover the dedicated library/detail navigation and the compact library toolbar.
- Modify: `tests/renderer/library.test.tsx`
  Cover the new book-card metadata and the library-only empty state.
- Modify: `tests/renderer/book-detail.test.tsx`
  Cover the dossier layout defaults, especially making chapters the primary first view.
- Re-run: `tests/renderer/new-book.test.tsx`
- Re-run: `tests/renderer/settings.test.tsx`
- Re-run: `tests/renderer/empty-state.test.tsx`
- Re-run: `tests/renderer/layout-constraints.test.ts`

## Task 1: Split Library Browsing From Dedicated Book Detail Routing

**Files:**
- Modify: `renderer/App.tsx`
- Modify: `renderer/components/app-sidebar.tsx`
- Modify: `tests/renderer/app-shell.test.tsx`
- Test: `tests/renderer/app-shell.test.tsx`

- [ ] **Step 1: Write the failing shell test for dedicated detail routing**

Add a new test near the existing selection coverage in `tests/renderer/app-shell.test.tsx`:

```tsx
  it('opens a dedicated detail view for the selected book and returns to the library through the sidebar', async () => {
    const books = [
      {
        id: 'book-1',
        title: 'First Book',
        idea: 'First idea',
        status: 'writing',
        targetWords: 500000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'book-2',
        title: 'Second Book',
        idea: 'Second idea',
        status: 'paused',
        targetWords: 500000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    installIpcMock(async (channel, payload) => {
      switch (channel) {
        case 'book:list':
          return copy(books);
        case 'model:list':
          return [];
        case 'book:detail': {
          const { bookId } = payload as { bookId: string };
          const book = books.find((item) => item.id === bookId) ?? books[0];

          return {
            book,
            context: null,
            latestScene: null,
            characterStates: [],
            plotThreads: [],
            chapters: [],
            progress: { phase: book.status },
          };
        }
        default:
          return null;
      }
    });

    render(<App />);

    expect(await screen.findByRole('button', { name: 'Second Book' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Second Book' }));

    expect(await screen.findByRole('heading', { name: 'Second Book' })).toBeInTheDocument();
    expect(screen.queryByText('暂无作品')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '作品' }));

    expect(await screen.findByRole('button', { name: 'Second Book' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Second Book' })).toBeNull();
  });
```

- [ ] **Step 2: Run the focused shell test to verify it fails**

Run:

```bash
pnpm test -- --run tests/renderer/app-shell.test.tsx
```

Expected: FAIL because selecting a book still renders the detail panel inline inside `Library` instead of switching to a dedicated `book-detail` view.

- [ ] **Step 3: Implement top-level `book-detail` routing in the app shell**

Update `renderer/App.tsx` so selection and viewing are separate concerns. Keep the default preloading of the first book detail data, but only open the detail screen when a user explicitly selects a card:

```tsx
// renderer/App.tsx
import { AppSidebar, type AppView } from './components/app-sidebar';
import BookDetail from './pages/BookDetail';
import Library from './pages/Library';

async function loadBookDetail(
  bookId: string,
  options?: { openView?: boolean }
) {
  const detail = await ipc.invoke<BookDetailData | null>(
    ipcChannels.bookDetail,
    { bookId }
  );

  setSelectedBookId(bookId);
  setSelectedBookDetail(detail);

  if (options?.openView ?? true) {
    setCurrentView('book-detail');
  }
}

useEffect(() => {
  if (!books.length) {
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
}, [books, selectedBookId, currentView]);
```

Render the central view like this:

```tsx
          {currentView === 'library' ? (
            <Library
              books={books}
              scheduler={progress ?? defaultScheduler}
              onOpenBook={(bookId) => {
                void loadBookDetail(bookId, { openView: true });
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
                      message: '正在暂停全部书籍...',
                    });
                  });
                  await ipc.invoke(ipcChannels.schedulerPauseAll);
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
              onBackToLibrary={() => setCurrentView('library')}
              onResume={() =>
                void runSelectedBookAction({
                  startMessage: '正在恢复写作...',
                  errorMessage: 'Failed to resume book',
                  channel: ipcChannels.bookResume,
                })
              }
              onRestart={() =>
                void runSelectedBookAction({
                  startMessage: '正在重新生成作品...',
                  errorMessage: 'Failed to restart book',
                  channel: ipcChannels.bookRestart,
                  successMessage: '已重新开始生成作品',
                })
              }
              onPause={() =>
                void runSelectedBookAction({
                  startMessage: '正在暂停写作...',
                  errorMessage: 'Failed to pause book',
                  channel: ipcChannels.bookPause,
                  successMessage: '已暂停写作',
                })
              }
              onWriteNext={() =>
                void runSelectedBookAction({
                  startMessage: '正在写下一章...',
                  errorMessage: 'Failed to write next chapter',
                  channel: ipcChannels.bookWriteNext,
                  successMessage: '下一章已加入生成队列',
                })
              }
              onWriteAll={() =>
                void runSelectedBookAction({
                  startMessage: '正在连续写作...',
                  errorMessage: 'Failed to continue writing',
                  channel: ipcChannels.bookWriteAll,
                  successMessage: '连续写作已开始',
                })
              }
              onExport={(format) =>
                void runSelectedBookAction({
                  startMessage: null,
                  errorMessage: 'Failed to export book',
                  channel: ipcChannels.bookExport,
                  payload: {
                    bookId: selectedBookId,
                    format,
                  },
                  successMessage: `已导出 ${format.toUpperCase()}`,
                })
              }
              onDelete={() =>
                void runSelectedBookAction({
                  startMessage: null,
                  errorMessage: 'Failed to delete book',
                  channel: ipcChannels.bookDelete,
                  successMessage: '作品已删除',
                  clearSelection: true,
                })
              }
            />
          ) : null}
```

Update `renderer/components/app-sidebar.tsx` so the `作品` button stays highlighted for both library-facing views:

```tsx
export type AppView = 'library' | 'book-detail' | 'new-book' | 'settings';

const isLibraryView = currentView === 'library' || currentView === 'book-detail';

<SidebarMenuButton
  isActive={item.view === 'library' ? isLibraryView : currentView === item.view}
  onClick={() => onSelectView(item.view)}
>
  {item.label}
</SidebarMenuButton>
```

- [ ] **Step 4: Run the shell test again**

Run:

```bash
pnpm test -- --run tests/renderer/app-shell.test.tsx
```

Expected: PASS, including the new dedicated-detail navigation test and the existing sidebar switching coverage.

- [ ] **Step 5: Commit**

```bash
git add renderer/App.tsx renderer/components/app-sidebar.tsx tests/renderer/app-shell.test.tsx
git commit -m "feat: split library and book detail views"
```

## Task 2: Rebuild the Home Screen as a Large-Card Story Library

**Files:**
- Modify: `renderer/pages/Library.tsx`
- Modify: `renderer/components/BookCard.tsx`
- Modify: `renderer/components/EmptyState.tsx`
- Modify: `tests/renderer/library.test.tsx`
- Test: `tests/renderer/library.test.tsx`

- [ ] **Step 1: Rewrite the library test around cards instead of inline detail**

Update `tests/renderer/library.test.tsx` so the component only owns the library surface and each card shows book identity plus archive metadata:

```tsx
  it('renders archive-style cards with story summary and production metadata', () => {
    render(
      <Library
        books={[
          {
            id: 'book-1',
            title: '北境遗城',
            idea: '旧王朝复苏，双主角在寒地边境争夺最后的王权。',
            status: 'writing',
            targetWords: 500000,
            updatedAt: '2026-04-28T12:00:00.000Z',
            createdAt: '2026-04-28T10:00:00.000Z',
            progress: 76,
            completedChapters: 38,
            totalChapters: 50,
          },
        ]}
        scheduler={{
          runningBookIds: ['book-1'],
          queuedBookIds: [],
          pausedBookIds: [],
          concurrencyLimit: 3,
        }}
        onOpenBook={vi.fn()}
        onStartAll={vi.fn()}
        onPauseAll={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: '北境遗城' })).toBeInTheDocument();
    expect(screen.getByText('旧王朝复苏，双主角在寒地边境争夺最后的王权。')).toBeInTheDocument();
    expect(screen.getByText('50 万字目标')).toBeInTheDocument();
    expect(screen.getByText('38 / 50 章')).toBeInTheDocument();
  });
```

Also update the empty-state test so it no longer expects inline detail text:

```tsx
    expect(screen.queryByText('暂无作品详情')).toBeNull();
    expect(screen.getByText('还没有作品，先创建第一本书。')).toBeInTheDocument();
```

- [ ] **Step 2: Run the focused library test to verify it fails**

Run:

```bash
pnpm test -- --run tests/renderer/library.test.tsx
```

Expected: FAIL because `Library` still expects detail-panel props and `BookCard` does not render the story summary or the archive metadata labels.

- [ ] **Step 3: Implement the large-card library grid**

Change `renderer/pages/Library.tsx` so it owns just the library view:

```tsx
// renderer/pages/Library.tsx
type LibraryBook = {
  id: string;
  title: string;
  idea: string;
  status: string;
  targetWords: number;
  updatedAt: string;
  progress?: number;
  completedChapters?: number;
  totalChapters?: number;
};

export default function Library({
  books,
  scheduler,
  onOpenBook,
  onStartAll,
  onPauseAll,
}: {
  books: LibraryBook[];
  scheduler: SchedulerStatus;
  onOpenBook: (bookId: string) => void;
  onStartAll: () => void;
  onPauseAll: () => void;
}) {
  const completedCount = books.filter((book) => book.status === 'completed').length;

  return (
    <section className="grid gap-6">
      <header className="grid gap-4 rounded-[28px] border border-border/70 bg-card/95 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Story Library
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">作品库</h1>
          </div>
          <div className="flex gap-3">
            <Button type="button" onClick={onStartAll} disabled={!books.length}>
              全部开始
            </Button>
            <Button type="button" variant="secondary" onClick={onPauseAll} disabled={!books.length}>
              全部暂停
            </Button>
          </div>
        </div>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_140px_140px_160px]">
          <Input aria-label="搜索作品" placeholder="搜索作品、设定或状态" />
          <Button type="button" variant="outline">全部状态</Button>
          <Button type="button" variant="outline">最近更新</Button>
          <Button type="button" variant="outline">{`${completedCount} 已完成`}</Button>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
        {books.length ? (
          books.map((book) => (
            <BookCard key={book.id} {...book} onView={onOpenBook} />
          ))
        ) : (
          <EmptyState
            title="暂无作品"
            description="还没有作品，先创建第一本书。"
          />
        )}
      </div>
    </section>
  );
}
```

Update `renderer/components/BookCard.tsx` to render a larger archive card with a left spine marker:

```tsx
// renderer/components/BookCard.tsx
export default function BookCard({
  id,
  title,
  idea,
  status,
  progress,
  targetWords,
  updatedAt,
  completedChapters,
  totalChapters,
  onView,
}: {
  id: string;
  title: string;
  idea: string;
  status: string;
  progress: number;
  targetWords: number;
  updatedAt: string;
  completedChapters?: number;
  totalChapters?: number;
  onView?: (bookId: string) => void;
}) {
  return (
    <button
      type="button"
      aria-label={title}
      className="grid grid-cols-[88px_minmax(0,1fr)] gap-4 rounded-[26px] border border-border/70 bg-card/95 p-5 text-left shadow-[0_18px_60px_rgba(15,23,42,0.05)] transition-colors hover:border-primary/30 hover:bg-accent/20"
      onClick={() => onView?.(id)}
    >
      <div className="rounded-[18px] bg-[linear-gradient(160deg,hsl(var(--library-accent)),hsl(var(--library-accent-soft)))]" />
      <div className="grid gap-4">
        <div className="grid gap-2">
          <div className="flex items-start justify-between gap-3">
            <span className="text-xl font-semibold tracking-tight">{title}</span>
            <StatusBadge status={status} />
          </div>
          <p className="text-sm leading-6 text-muted-foreground">{idea}</p>
        </div>
        <div className="grid gap-3">
          <ProgressBar value={progress} />
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span>{`${Math.round(targetWords / 10000)} 万字目标`}</span>
            <span>{`${completedChapters ?? 0} / ${totalChapters ?? 0} 章`}</span>
            <span>{`最近更新 ${new Date(updatedAt).toLocaleDateString('zh-CN')}`}</span>
          </div>
        </div>
      </div>
    </button>
  );
}
```

So the library-only empty state stays visually compatible, update `renderer/components/EmptyState.tsx` to use the same calmer archive card shape:

```tsx
    <Card role="status" className="rounded-[26px] border-dashed border-border/70 bg-card/60 shadow-none">
```

- [ ] **Step 4: Run the library tests again**

Run:

```bash
pnpm test -- --run tests/renderer/library.test.tsx
```

Expected: PASS with the updated card assertions and the library-only empty-state expectations.

- [ ] **Step 5: Commit**

```bash
git add renderer/pages/Library.tsx renderer/components/BookCard.tsx renderer/components/EmptyState.tsx tests/renderer/library.test.tsx
git commit -m "feat: redesign story library cards"
```

## Task 3: Turn the Book Detail Screen Into a Single-Book Dossier

**Files:**
- Modify: `renderer/pages/BookDetail.tsx`
- Modify: `tests/renderer/book-detail.test.tsx`
- Test: `tests/renderer/book-detail.test.tsx`

- [ ] **Step 1: Rewrite the detail test so chapters are the default primary view**

Update the first two `BookDetail` tests in `tests/renderer/book-detail.test.tsx`:

```tsx
  it('defaults to chapters as the primary view while keeping outline, characters, and plot threads available', async () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 12000 }}
        progress={{ phase: 'writing' }}
        chapters={[
          {
            id: '1-1',
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
            content: 'Generated chapter content',
            summary: 'Chapter summary',
          },
        ]}
      />
    );

    expect(screen.getByRole('tab', { name: '章节' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByLabelText('章节滚动区')).toBeInTheDocument();
    expect(screen.getByText('大纲')).toBeInTheDocument();
    expect(screen.getByText('人物')).toBeInTheDocument();
    expect(screen.getByText('伏笔')).toBeInTheDocument();
  });
```

In the tab-switching test, start from the default chapter view and then verify the switch to outline explicitly:

```tsx
    expect(screen.getByText('正文预览')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '大纲' }));

    expect(await screen.findByText('总纲')).toBeInTheDocument();
    expect(screen.queryByText('正文预览')).toBeNull();
```

- [ ] **Step 2: Run the focused detail test to verify it fails**

Run:

```bash
pnpm test -- --run tests/renderer/book-detail.test.tsx
```

Expected: FAIL because `BookDetail` still initializes `activeTab` to `outline` and the header hierarchy still reads like an inline side panel instead of a top-level page.

- [ ] **Step 3: Implement the dossier-style detail page**

Update the page signature to accept a return action:

```tsx
// renderer/pages/BookDetail.tsx
export default function BookDetail({
  book,
  context,
  latestScene,
  characterStates,
  plotThreads,
  chapters,
  progress,
  onBackToLibrary,
  onPause,
  onResume,
  onRestart,
  onWriteNext,
  onWriteAll,
  onExport,
  onDelete,
}: {
  book: { title: string; status: string; wordCount: number };
  context?: { worldSetting?: string | null; outline?: string | null } | null;
  latestScene?: { location: string; timeInStory: string; charactersPresent: string[]; events: string | null } | null;
  characterStates?: Array<{
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
  plotThreads?: Array<{
    id: string;
    description: string;
    plantedAt: number;
    expectedPayoff: number | null;
    resolvedAt: number | null;
    importance: string;
  }>;
  chapters?: Array<{
    id?: string;
    volumeIndex?: number;
    chapterIndex?: number;
    title: string;
    wordCount: number;
    status: 'done' | 'writing' | 'queued';
    content?: string | null;
    summary?: string | null;
  }>;
  progress?: { phase?: string | null } | null;
  onBackToLibrary?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onRestart?: () => void;
  onWriteNext?: () => void;
  onWriteAll?: () => void;
  onExport?: (format: BookExportFormat) => void;
  onDelete?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>('chapters');
```

Rebuild the header and content structure so it reads like a page, not an embedded card:

```tsx
  return (
    <section className="grid gap-6">
      <header className="grid gap-5 rounded-[30px] border border-border/70 bg-card/95 p-7 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="grid gap-2">
            <button
              type="button"
              className="w-fit text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground"
              onClick={onBackToLibrary}
            >
              返回作品库
            </button>
            <h1 className="text-3xl font-semibold tracking-tight">{book.title}</h1>
            <p className="text-sm leading-6 text-muted-foreground">
              {`${getStatusLabel(progress?.phase ?? book.status)} · ${book.wordCount} 字`}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={onResume} disabled={!canResume}>恢复写作</Button>
            <Button type="button" variant="secondary" onClick={onPause} disabled={!canPause}>暂停</Button>
            <Button type="button" variant="outline" onClick={onWriteNext} disabled={!canWrite}>写下一章</Button>
            <Button type="button" variant="outline" onClick={onWriteAll} disabled={!canWrite}>连续写作</Button>
            <Button type="button" variant="outline" onClick={() => onExport?.('md')} disabled={!hasGeneratedContent}>导出 MD</Button>
            <Button type="button" variant="destructive" onClick={onDelete}>删除作品</Button>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
        <div className="grid gap-4 rounded-[28px] border border-border/70 bg-card/95 p-6">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DetailTab)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="chapters">章节</TabsTrigger>
              <TabsTrigger value="outline">大纲</TabsTrigger>
              <TabsTrigger value="characters">人物</TabsTrigger>
              <TabsTrigger value="threads">伏笔</TabsTrigger>
            </TabsList>
            <TabsContent value="chapters" className="grid gap-6">
              <ScrollArea aria-label="章节滚动区">
                <div className="grid gap-6">
                  {renderedChapters.length ? (
                    <ChapterList chapters={renderedChapters} />
                  ) : (
                    <DetailEmpty message="暂无章节内容" />
                  )}
                  {latestContent ? (
                    <DetailSection title="正文预览">
                      <p className="whitespace-pre-wrap">{latestContent}</p>
                    </DetailSection>
                  ) : null}
                  {latestSummary ? (
                    <DetailSection title="章节摘要">
                      <p>{latestSummary}</p>
                    </DetailSection>
                  ) : null}
                </div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="outline" className="grid gap-6">
              {context?.worldSetting ? (
                <DetailSection title="世界观">
                  <p>{context.worldSetting}</p>
                </DetailSection>
              ) : null}
              {context?.outline ? (
                <DetailSection title="总纲">
                  <p>{context.outline}</p>
                </DetailSection>
              ) : null}
              {!context?.worldSetting && !context?.outline ? (
                <DetailEmpty message="暂无大纲信息" />
              ) : null}
            </TabsContent>
            <TabsContent value="characters" className="grid gap-6">
              {characterStates?.length ? (
                <DetailSection title="人物状态">
                  <ul className="m-0 pl-5">
                    {characterStates.map((state) => (
                      <li key={state.characterId}>
                        {state.characterName}
                        {state.location ? ` · ${state.location}` : ''}
                        {state.status ? ` · ${state.status}` : ''}
                      </li>
                    ))}
                  </ul>
                </DetailSection>
              ) : (
                <DetailEmpty message="暂无人物状态" />
              )}
            </TabsContent>
            <TabsContent value="threads" className="grid gap-6">
              {plotThreads?.length ? (
                <DetailSection title="伏笔追踪">
                  <ul className="m-0 pl-5">
                    {plotThreads.map((thread) => (
                      <li key={thread.id}>
                        {thread.description}
                        {thread.resolvedAt
                          ? ` · 已回收（第 ${thread.resolvedAt} 章）`
                          : ` · 待回收（预计第 ${thread.expectedPayoff ?? '?'} 章）`}
                      </li>
                    ))}
                  </ul>
                </DetailSection>
              ) : (
                <DetailEmpty message="暂无伏笔追踪" />
              )}
            </TabsContent>
          </Tabs>
        </div>

        <aside className="grid gap-4">
          {latestScene ? (
            <DetailSection title="最近场景">
              <p>{`${latestScene.location} · ${latestScene.timeInStory}`}</p>
              {latestScene.events ? <p>{latestScene.events}</p> : null}
            </DetailSection>
          ) : (
            <DetailEmpty message="暂无场景记录" />
          )}
          <DetailSection title="写作上下文">
            <p>{context?.outline ?? '大纲生成后会在这里显示主线摘要。'}</p>
          </DetailSection>
        </aside>
      </div>
    </section>
  );
```

Keep the current content renderers, but move the chapter tab to the top of the mental model by leaving `DetailSection`, `DetailEmpty`, and `ChapterList` in place and reusing them inside the new page shell.

- [ ] **Step 4: Run the detail test again**

Run:

```bash
pnpm test -- --run tests/renderer/book-detail.test.tsx
```

Expected: PASS with the new chapters-first default and the existing action-enable/disable coverage still green.

- [ ] **Step 5: Commit**

```bash
git add renderer/pages/BookDetail.tsx tests/renderer/book-detail.test.tsx
git commit -m "feat: redesign book detail dossier"
```

## Task 4: Harmonize the Global Visual System and Supporting Screens

**Files:**
- Modify: `renderer/index.css`
- Modify: `renderer/components/app-sidebar.tsx`
- Modify: `renderer/pages/NewBook.tsx`
- Modify: `renderer/pages/Settings.tsx`
- Modify: `tests/renderer/app-shell.test.tsx`
- Test: `tests/renderer/app-shell.test.tsx`
- Test: `tests/renderer/new-book.test.tsx`
- Test: `tests/renderer/settings.test.tsx`
- Test: `tests/renderer/empty-state.test.tsx`
- Test: `tests/renderer/layout-constraints.test.ts`

- [ ] **Step 1: Add a failing shell assertion for the compact library toolbar**

Extend the “safe empty preview” test in `tests/renderer/app-shell.test.tsx`:

```tsx
  it('renders a safe empty library shell when Electron IPC is unavailable', async () => {
    delete window.storyWeaver;

    render(<App />);

    expect((await screen.findAllByText('Story Weaver')).length).toBeGreaterThan(0);
    expect(await screen.findByPlaceholderText('搜索作品、设定或状态')).toBeInTheDocument();
    expect(await screen.findByText('暂无作品')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '全部开始' })).toBeDisabled();
  });
```

- [ ] **Step 2: Run the shell test to verify it fails**

Run:

```bash
pnpm test -- --run tests/renderer/app-shell.test.tsx
```

Expected: FAIL because the current shell still renders the large hero card and does not expose the compact archive search toolbar.

- [ ] **Step 3: Apply the archive-wide visual tokens and supporting-page restyles**

Update `renderer/index.css` with the calmer archive palette and custom library accents:

```css
@layer base {
  :root {
    --background: 40 23% 95%;
    --foreground: 220 24% 16%;
    --card: 38 24% 98%;
    --card-foreground: 220 24% 16%;
    --border: 35 16% 80%;
    --muted: 36 18% 91%;
    --muted-foreground: 220 10% 38%;
    --accent: 145 20% 88%;
    --accent-foreground: 150 28% 21%;
    --primary: 154 28% 31%;
    --primary-foreground: 42 40% 97%;
    --radius: 1.4rem;
    --library-accent: 145 20% 40%;
    --library-accent-soft: 150 30% 76%;
  }

  body {
    margin: 0;
    min-height: 100vh;
    background:
      radial-gradient(circle at top left, hsl(40 30% 97%), transparent 28%),
      linear-gradient(180deg, hsl(var(--background)), hsl(42 18% 93%));
    @apply text-foreground antialiased;
  }
}
```

Use the same design language in `renderer/components/app-sidebar.tsx`:

```tsx
    <Sidebar collapsible="none" className="border-r border-sidebar-border/70 bg-sidebar/90">
      <SidebarHeader className="border-b border-sidebar-border/70">
        <div className="grid gap-2 px-3 py-4">
          <img
            src={logoImage}
            alt="Story Weaver logo"
            className="h-20 w-full object-contain object-left"
          />
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sidebar-foreground/60">
            Story Library
          </p>
        </div>
      </SidebarHeader>
```

Restyle `renderer/pages/NewBook.tsx` into a single calm archive form:

```tsx
    <section className="grid gap-6">
      <header className="grid gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          New Story
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">新建作品</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          输入故事钩子、核心冲突或主角目标，开始一条新的长篇创作线。
        </p>
      </header>
      <Card className="rounded-[28px] border-border/70 bg-card/95 shadow-[0_18px_60px_rgba(15,23,42,0.05)]">
```

Restyle `renderer/pages/Settings.tsx` to match the same shell rhythm:

```tsx
      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="rounded-[28px] border-border/70 bg-card/95 shadow-[0_18px_60px_rgba(15,23,42,0.05)]">
```

Also remove the old hero section from `renderer/App.tsx`; the library header added in Task 2 becomes the primary first-screen identity.

- [ ] **Step 4: Run the focused regressions, typecheck, and build**

Run:

```bash
pnpm test -- --run tests/renderer/app-shell.test.tsx tests/renderer/new-book.test.tsx tests/renderer/settings.test.tsx tests/renderer/empty-state.test.tsx tests/renderer/layout-constraints.test.ts
pnpm run typecheck
pnpm run build
```

Expected:

- all targeted renderer tests PASS
- `typecheck` exits with code `0`
- `build` completes without renderer compile errors

- [ ] **Step 5: Commit**

```bash
git add renderer/index.css renderer/components/app-sidebar.tsx renderer/pages/NewBook.tsx renderer/pages/Settings.tsx renderer/App.tsx tests/renderer/app-shell.test.tsx
git commit -m "feat: apply archive visual system"
```

## Self-Review

### Spec Coverage

- Home screen as a desktop story library: Task 2
- Large cards with archive/bookcase tone: Task 2 + Task 4
- Dedicated single-book detail page: Task 1 + Task 3
- Chapters-first work emphasis in detail: Task 3
- Supporting screens and global visual system alignment: Task 4

No spec gaps found.

### Placeholder Scan

- No `TODO`, `TBD`, or “implement later” placeholders remain.
- Each task includes exact files, commands, and concrete code snippets.

### Type Consistency

- `AppView` expands consistently to include `book-detail`.
- `Library` uses `onOpenBook` as the sole selection action.
- `BookDetail` consistently accepts `onBackToLibrary` for returning to the library shell.
