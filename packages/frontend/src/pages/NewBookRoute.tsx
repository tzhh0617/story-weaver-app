import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBookContext } from '../contexts/BookContext';
import { useStoryWeaverApi } from '../hooks/useStoryWeaverApi';
import type { ToastFn } from './route-utils';
import NewBook from './NewBook';

export default function NewBookRoute({ showToast }: { showToast: ToastFn }) {
  const navigate = useNavigate();
  const api = useStoryWeaverApi();
  const { loadBooks, loadBookDetail } = useBookContext();

  const handleCreate = useCallback(async (input: {
    idea: string;
    targetChapters: number;
    wordsPerChapter: number;
    viralStrategy?: Record<string, unknown>;
  }) => {
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
          await loadBookDetail(bookId, {
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
  }, [showToast, api, loadBooks, navigate, loadBookDetail]);

  return <NewBook onCreate={handleCreate} />;
}
