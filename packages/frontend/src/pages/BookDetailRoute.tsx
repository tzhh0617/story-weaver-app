import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { BookExportFormat } from '@story-weaver/shared/contracts';
import { useBookContext } from '../contexts/BookContext';
import { useSchedulerContext } from '../contexts/SchedulerContext';
import { useStoryWeaverApi } from '../hooks/useStoryWeaverApi';
import { useBookGenerationEvents } from '../hooks/useBookGenerationEvents';
import type { BookDetailData } from '../types/book-detail';
import type { ToastFn } from './route-utils';
import BookDetail from './BookDetail';

export default function BookDetailRoute({ showToast }: { showToast: ToastFn }) {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const api = useStoryWeaverApi();
  const {
    books,
    selectedBookId,
    selectedBookIdRef,
    selectedBookDetail,
    setSelectedBookDetail,
    loadBooks,
    loadBookDetail: loadBookDetailRecord,
    clearSelectedBook,
  } = useBookContext();
  const { progress, executionLogs } = useSchedulerContext();

  const liveOutput = useBookGenerationEvents({
    api,
    selectedBookId,
    selectedBookIdRef,
    setSelectedBookDetail,
    loadBookDetail: loadBookDetailRecord,
  });

  useEffect(() => {
    if (bookId) void loadBookDetailRecord(bookId);
  }, [bookId, loadBookDetailRecord]);

  // Reload books and detail when progress changes
  useEffect(() => {
    void (async () => {
      await loadBooks();

      if (selectedBookId) {
        await loadBookDetailRecord(selectedBookId, {
          preserveExistingOnMissing: true,
        });
      }
    })();
  }, [progress, selectedBookId, loadBooks, loadBookDetailRecord]);

  // Clear selected book if it disappears from the list
  useEffect(() => {
    if (!books.length) {
      if (selectedBookDetail) {
        return;
      }
      clearSelectedBook();
      return;
    }

    if (selectedBookId && !books.some((book) => book.id === selectedBookId)) {
      clearSelectedBook();
    }
  }, [books, clearSelectedBook, selectedBookDetail, selectedBookId]);

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

  if (!selectedBookDetail) {
    return null;
  }

  const isActive = selectedBookId
    ? progress.runningBookIds.includes(selectedBookId) ||
      progress.queuedBookIds.includes(selectedBookId)
    : false;

  return (
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
      isActive={isActive}
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
  );
}
