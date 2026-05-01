import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ipcChannels } from '../../src/shared/contracts';
import { useIpc } from '../../renderer/hooks/useIpc';

function Probe() {
  const ipc = useIpc();

  void ipc.invoke(ipcChannels.bookList).then((books) => {
    document.body.dataset.bookCount = String(books.length);
  });

  return <div>{ipc.isAvailable ? 'available' : 'unavailable'}</div>;
}

function ExportProbe() {
  const ipc = useIpc();

  void ipc
    .invoke(ipcChannels.bookExport, { bookId: 'book-1', format: 'txt' })
    .then((message) => {
      document.body.dataset.exportMessage = message;
    });

  return <div>exporting</div>;
}

describe('browser HTTP transport', () => {
  it('uses /api/invoke when the Electron preload bridge is absent', async () => {
    delete window.storyWeaver;
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ data: [] }), {
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
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('/api/invoke', window.location.href),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'book:list', payload: undefined }),
      }
    );
  });

  it('formats browser export responses with a download URL', async () => {
    delete window.storyWeaver;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            data: {
              filePath: '/tmp/story-weaver/exports/Book.txt',
              downloadUrl: '/api/exports/export-1',
            },
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
});
