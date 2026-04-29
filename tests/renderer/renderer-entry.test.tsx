import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../../renderer/App';

describe('renderer entry styling', () => {
  it('still renders the main workspace heading with the active style entry', async () => {
    window.storyWeaver = {
      invoke: async function <T>(channel: string) {
        switch (channel) {
          case 'book:list':
            return [] as T;
          case 'model:list':
            return [] as T;
          case 'scheduler:status':
            return {
              runningBookIds: [],
              queuedBookIds: [],
              pausedBookIds: [],
              concurrencyLimit: null,
            } as T;
          default:
            return null as T;
        }
      },
      onProgress: () => () => undefined,
      onBookGeneration: () => () => undefined,
    };

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
