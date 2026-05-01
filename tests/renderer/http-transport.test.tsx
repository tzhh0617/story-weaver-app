import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createHttpStoryWeaverClient } from '@story-weaver/frontend/lib/story-weaver-http-client';
import { useStoryWeaverApi } from '@story-weaver/frontend/hooks/useStoryWeaverApi';

function Probe() {
  const api = useStoryWeaverApi();

  void api.listBooks().then((books) => {
    document.body.dataset.bookCount = String(books.length);
  });

  return <div>available</div>;
}

function ExportProbe() {
  const api = useStoryWeaverApi();

  void api.exportBook('book-1', 'txt').then((message) => {
    document.body.dataset.exportMessage = message;
  });

  return <div>exporting</div>;
}

describe('browser HTTP transport', () => {
  it('uses concrete book routes even when the old Electron bridge exists', async () => {
    (window as typeof window & { storyWeaver?: unknown }).storyWeaver = {
      invoke: vi.fn(() => {
        throw new Error('old bridge should not be called');
      }),
      onProgress: vi.fn(),
      onBookGeneration: vi.fn(),
      onExecutionLog: vi.fn(),
    };
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<Probe />);

    expect(screen.getByText('available')).toBeInTheDocument();
    await waitFor(() => {
      expect(document.body.dataset.bookCount).toBe('0');
    });
    expect(fetchMock).toHaveBeenCalledWith(new URL('/api/books', window.location.href), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(
      ((window as typeof window & { storyWeaver: { invoke: ReturnType<typeof vi.fn> } })
        .storyWeaver.invoke)
    ).not.toHaveBeenCalled();
  });

  it('formats browser export responses with a download URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            filePath: '/tmp/story-weaver/exports/Book.txt',
            downloadUrl: '/api/exports/export-1',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
    );

    render(<ExportProbe />);

    await waitFor(() => {
      expect(document.body.dataset.exportMessage).toBe(
        '/tmp/story-weaver/exports/Book.txt（下载：/api/exports/export-1）'
      );
    });
  });

  it('uses an explicit API base URL for fetch endpoints', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const api = createHttpStoryWeaverClient({
      baseUrl: 'http://127.0.0.1:5174',
    });

    await api.listBooks();

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('/api/books', 'http://127.0.0.1:5174'),
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );
  });
});
