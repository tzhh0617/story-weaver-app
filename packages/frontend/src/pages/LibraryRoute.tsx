import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBookContext } from '../contexts/BookContext';
import { useSchedulerContext } from '../contexts/SchedulerContext';
import { useApiCall } from '../hooks/useApiCall';
import type { ToastFn } from './route-utils';
import Library from './Library';

export default function LibraryRoute({ showToast }: { showToast: ToastFn }) {
  const navigate = useNavigate();
  const { books, loadBooks, loadBookDetail, selectedBookId } = useBookContext();
  const { progress, startScheduler, pauseScheduler } = useSchedulerContext();
  const call = useApiCall(showToast);

  const handleStartAll = useCallback(async () => {
    showToast('info', '正在批量推进书籍写作...');
    const result = await call(async () => { await startScheduler(); return true as const; });
    if (result !== undefined) {
      await loadBooks();
      showToast('success', '批量写作已开始');
    }
  }, [showToast, call, startScheduler, loadBooks]);

  const handlePauseAll = useCallback(async () => {
    showToast('info', '正在暂停所有书籍...');
    const result = await call(async () => { await pauseScheduler(); return true as const; });
    if (result !== undefined) {
      await loadBooks();
      if (selectedBookId) {
        await loadBookDetail(selectedBookId);
      }
      showToast('success', '全部书籍已暂停');
    }
  }, [showToast, call, pauseScheduler, loadBooks, selectedBookId, loadBookDetail]);

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
