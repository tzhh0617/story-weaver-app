import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppErrorBoundary } from '@story-weaver/frontend/components/AppErrorBoundary';
import { PageErrorBoundary } from '@story-weaver/frontend/components/PageErrorBoundary';

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>Content rendered</div>;
}

describe('AppErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <AppErrorBoundary onToast={vi.fn()}>
        <ThrowingChild shouldThrow={false} />
      </AppErrorBoundary>
    );
    expect(screen.getByText('Content rendered')).toBeInTheDocument();
  });

  it('renders error state when child throws', () => {
    const spy = vi.fn();
    render(
      <AppErrorBoundary onToast={spy}>
        <ThrowingChild shouldThrow={true} />
      </AppErrorBoundary>
    );
    expect(screen.getByText(/出了点问题/)).toBeInTheDocument();
  });
});

describe('PageErrorBoundary', () => {
  it('renders error card when child throws', () => {
    const spy = vi.fn();
    render(
      <PageErrorBoundary onToast={spy}>
        <ThrowingChild shouldThrow={true} />
      </PageErrorBoundary>
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
