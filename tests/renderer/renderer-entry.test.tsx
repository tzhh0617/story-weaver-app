import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from '../../renderer/App';
import type { StoryWeaverInvoke } from '../../renderer/hooks/useIpc';

describe('renderer entry styling', () => {
  it('still renders the main workspace heading with the active style entry', async () => {
    window.storyWeaver = {
      invoke: (async function (channel: string) {
        switch (channel) {
          case 'book:list':
            return [];
          case 'model:list':
            return [];
          case 'scheduler:status':
            return {
              runningBookIds: [],
              queuedBookIds: [],
              pausedBookIds: [],
              concurrencyLimit: null,
            };
          default:
            return null;
        }
      }) as StoryWeaverInvoke,
      onProgress: () => () => undefined,
      onBookGeneration: () => () => undefined,
      onExecutionLog: () => () => undefined,
    };

    const { container } = render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );

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
