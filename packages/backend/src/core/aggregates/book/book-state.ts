export const INITIAL_BOOK_TITLE = '新作品';

export function deriveTitleFromIdea(idea: string) {
  const cleaned = idea.trim().replace(/\s+/g, ' ');

  if (!cleaned) {
    return 'Untitled Story';
  }

  return cleaned.length > 48 ? `${cleaned.slice(0, 48)}...` : cleaned;
}

export function isBookPaused(
  deps: {
    books: {
      getById: (bookId: string) => { status: string } | undefined;
    };
  },
  bookId: string
) {
  return deps.books.getById(bookId)?.status === 'paused';
}
