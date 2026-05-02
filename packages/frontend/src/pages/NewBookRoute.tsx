import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBookContext } from '../contexts/BookContext';
import { useStoryWeaverApi } from '../hooks/useStoryWeaverApi';
import { useApiCall } from '../hooks/useApiCall';
import type { ToastFn } from './route-utils';
import NewBook from './NewBook';

export default function NewBookRoute({ showToast }: { showToast: ToastFn }) {
  const navigate = useNavigate();
  const api = useStoryWeaverApi();
  const { loadBooks, loadBookDetail } = useBookContext();
  const call = useApiCall(showToast);

  const handleCreate = useCallback(async (input: {
    title?: string;
    idea: string;
    targetChapters: number;
    wordsPerChapter: number;
    viralStrategy?: Record<string, unknown>;
  }) => {
    showToast('info', '正在创建作品...');
    const bookId = await call(() => api.createBook(input));
    if (bookId === undefined) return;

    await loadBooks();
    navigate(`/books/${bookId}`);
    showToast(
      'info',
      input.title ? '书本已创建，正在构建世界观...' : '书本已创建，正在生成书名...'
    );

    void (async () => {
      const result = await call(async () => { await api.startBook(bookId); return true as const; });
      if (result !== undefined) {
        await loadBooks();
        await loadBookDetail(bookId, {
          preserveExistingOnMissing: true,
        });
      }
    })();
  }, [showToast, call, api, loadBooks, navigate, loadBookDetail]);

  return <NewBook onCreate={handleCreate} />;
}
