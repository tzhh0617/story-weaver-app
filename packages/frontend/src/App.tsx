import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { flushSync } from 'react-dom';
import {
  Navigate,
  Routes,
  Route,
  useLocation,
} from 'react-router-dom';
import { AppSidebar } from './components/app-sidebar';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { ModelConfigProvider } from './contexts/ModelConfigContext';
import { BookProvider } from './contexts/BookContext';
import { SchedulerProvider } from './contexts/SchedulerContext';
import BookDetailRoute from './pages/BookDetailRoute';
import LibraryRoute from './pages/LibraryRoute';
import LogsRoute from './pages/LogsRoute';
import NewBookRoute from './pages/NewBookRoute';
import SettingsRoute from './pages/SettingsRoute';

const sidebarProviderStyle = {
  '--sidebar-width': '12.75rem',
} as CSSProperties;

type ToastTone = 'error' | 'success' | 'info';

export default function App() {
  const location = useLocation();
  const [toast, setToast] = useState<{
    id: number;
    tone: ToastTone;
    message: string;
  } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((tone: ToastTone, message: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    flushSync(() => {
      setToast({
        id: Date.now(),
        tone,
        message,
      });
    });

    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3600);
  }, []);

  const toastClassName = toast
    ? {
        info: 'border-primary/30 bg-background text-foreground shadow-[0_18px_45px_rgba(36,28,18,0.18)]',
        success:
          'border-emerald-500/30 bg-background text-foreground shadow-[0_18px_45px_rgba(36,28,18,0.18)]',
        error:
          'border-destructive/40 bg-background text-destructive shadow-[0_18px_45px_rgba(36,28,18,0.18)]',
      }[toast.tone]
    : '';

  const isBookDetailWorkbench =
    location.pathname.startsWith('/books/');

  return (
    <SidebarProvider
      defaultOpen
      style={sidebarProviderStyle}
      className="app-paper-background relative h-svh overflow-hidden"
    >
      <div aria-hidden="true" className="app-titlebar-drag-region" />
      <AppSidebar />
      {toast ? (
        <div
          role={toast.tone === 'error' ? 'alert' : 'status'}
          aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
          className={`fixed right-5 top-[calc(var(--app-titlebar-height)+1rem)] z-50 max-w-sm rounded-lg border px-4 py-3 text-sm font-medium ${toastClassName}`}
        >
          {toast.message}
        </div>
      ) : null}
      <SidebarInset className="app-paper-background min-w-0 flex-1 overflow-hidden">
        <main
          data-testid="app-content-scrollport"
          className={`app-content-scrollport h-svh w-full px-5 pb-5 pt-[calc(var(--app-titlebar-height)+1.25rem)] ${
            isBookDetailWorkbench ? 'overflow-hidden' : 'overflow-y-auto'
          }`}
        >
          <div
            data-testid="app-view-frame"
            className={`w-full gap-5 ${
              isBookDetailWorkbench
                ? 'flex h-full min-h-0 flex-col'
                : 'grid content-start'
            }`}
          >
          <ModelConfigProvider toast={showToast}>
            <BookProvider>
              <SchedulerProvider>
                <AppErrorBoundary onToast={showToast}>
                  <Routes>
                    <Route path="/" element={<LibraryRoute showToast={showToast} />} />
                    <Route path="/books/:bookId" element={<BookDetailRoute showToast={showToast} />} />
                    <Route path="/new-book" element={<NewBookRoute showToast={showToast} />} />
                    <Route path="/logs" element={<LogsRoute />} />
                    <Route path="/settings" element={<SettingsRoute showToast={showToast} />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </AppErrorBoundary>
              </SchedulerProvider>
            </BookProvider>
          </ModelConfigProvider>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
