import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../../renderer/App';

describe('renderer entry styling', () => {
  it('still renders the main workspace heading with the active style entry', async () => {
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

    const { container } = render(<App />);

    expect(
      await screen.findByRole('heading', {
        name: '作品库',
      })
    ).toBeInTheDocument();

    const main = container.querySelector('main.h-svh');
    const cappedChildren = Array.from(main?.children ?? []).filter((child) =>
      child.className.includes('max-w-[1100px]')
    );

    expect(main).toHaveClass('h-svh', 'overflow-y-auto', 'w-full');
    expect(cappedChildren).toHaveLength(0);
  });
});
