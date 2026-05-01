import { useCallback, useEffect, useRef, useState } from 'react';
import type { BookListItem } from '../../src/shared/contracts';
import type { BookDetailData } from '../types/book-detail';
import type { StoryWeaverApi } from './useStoryWeaverApi';

function normalizeBookListItem(book: BookListItem): BookListItem {
  return {
    ...book,
    progress: book.progress ?? 0,
    completedChapters: book.completedChapters ?? 0,
    totalChapters: book.totalChapters ?? 0,
  };
}

export function useBooksController(api: StoryWeaverApi) {
  const [books, setBooks] = useState<BookListItem[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const selectedBookIdRef = useRef<string | null>(null);
  const [selectedBookDetail, setSelectedBookDetail] =
    useState<BookDetailData | null>(null);

  const loadBooks = useCallback(async () => {
    const nextBooks = await api.listBooks();
    const safeBooks = Array.isArray(nextBooks) ? nextBooks : [];

    setBooks(safeBooks.map(normalizeBookListItem));
  }, [api]);

  const loadBookDetail = useCallback(async (
    bookId: string,
    options?: { openView?: boolean; preserveExistingOnMissing?: boolean }
  ) => {
    setSelectedBookId(bookId);
    const detail = await api.getBookDetail(bookId);
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

    return options?.openView ?? true;
  }, [api]);

  const clearSelectedBook = useCallback(() => {
    setSelectedBookId(null);
    setSelectedBookDetail(null);
  }, []);

  useEffect(() => {
    selectedBookIdRef.current = selectedBookId;
  }, [selectedBookId]);

  return {
    books,
    setBooks,
    selectedBookId,
    selectedBookIdRef,
    setSelectedBookId,
    selectedBookDetail,
    setSelectedBookDetail,
    loadBooks,
    loadBookDetail,
    clearSelectedBook,
  };
}
