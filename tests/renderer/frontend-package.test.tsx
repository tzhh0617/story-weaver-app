import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '@story-weaver/frontend/App';

describe('frontend package entry', () => {
  it('exports the React app from the frontend package', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: URL | string) => {
        const pathname = new URL(String(url)).pathname;
        if (pathname === '/api/scheduler/status') {
          return new Response(
            JSON.stringify({
              runningBookIds: [],
              queuedBookIds: [],
              pausedBookIds: [],
              concurrencyLimit: null,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        if (pathname === '/api/books' || pathname === '/api/models') {
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (pathname.startsWith('/api/settings/')) {
          return new Response(JSON.stringify({ key: pathname, value: null }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );

    render(<App />);

    expect(
      await screen.findByRole('heading', {
        name: '作品库',
      })
    ).toBeInTheDocument();
  });
});
