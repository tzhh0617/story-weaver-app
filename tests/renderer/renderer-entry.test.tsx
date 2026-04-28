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
    };

    render(<App />);

    expect(
      await screen.findByRole('heading', {
        name: 'AI Long-Form Fiction Studio',
      })
    ).toBeInTheDocument();
  });
});
