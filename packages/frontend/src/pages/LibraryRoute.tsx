import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBookContext } from '../contexts/BookContext';
import { useSchedulerContext } from '../contexts/SchedulerContext';
import { useStoryWeaverApi } from '../hooks/useStoryWeaverApi';
import type { ToastFn } from './route-utils';
import Library from './Library';

export default function LibraryRoute({ showToast }: { showToast: ToastFn }) {
  const navigate = useNavigate();
  const api = useStoryWeaverApi();
  const { books, loadBooks, loadBookDetail, selectedBookId } = useBookContext();
  const { progress, startScheduler, pauseScheduler } = useSchedulerContext();

  const handleStartAll = useCallback(async () => {
    try {
      showToast('info', '正在批量推进书籍写作...');
      await startScheduler();
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
  }, [showToast, startScheduler, loadBooks]);

  const handlePauseAll = useCallback(async () => {
    try {
      showToast('info', '正在暂停所有书籍...');
      await pauseScheduler();
      await loadBooks();
      if (selectedBookId) {
        await loadBookDetail(selectedBookId);
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
  }, [showToast, pauseScheduler, loadBooks, selectedBookId, loadBookDetail]);

  return (
    <Library
      books={books}
      scheduler={progress}
      onSelectBook={(bookId) => {
        navigate(`/books/${bookId}`);
      }}
      onCreateBook={() => navigate('/new-book')}
      onStartAll={handleStartAll}
      onPauseAll={handlePauseAll}
    />
  );
}
