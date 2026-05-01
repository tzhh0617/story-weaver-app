import { createContext, useContext, type ReactNode } from 'react';
import { useBooksController } from '../hooks/useBooksController';
import { useStoryWeaverApi } from '../hooks/useStoryWeaverApi';

type BookContextValue = ReturnType<typeof useBooksController>;

const BookContext = createContext<BookContextValue | null>(null);

export function BookProvider({ children }: { children: ReactNode }) {
  const api = useStoryWeaverApi();
  const controller = useBooksController(api);
  return (
    <BookContext.Provider value={controller}>
      {children}
    </BookContext.Provider>
  );
}

export function useBookContext() {
  const ctx = useContext(BookContext);
  if (!ctx) throw new Error('useBookContext must be used within BookProvider');
  return ctx;
}
