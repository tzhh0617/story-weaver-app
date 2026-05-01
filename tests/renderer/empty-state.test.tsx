import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from '@story-weaver/frontend/components/EmptyState';

describe('EmptyState', () => {
  it('renders a titled empty-state container with supporting copy', () => {
    const { container } = render(
      <EmptyState title="暂无作品" description="先创建第一本书。" />
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('暂无作品')).toBeInTheDocument();
    expect(screen.getByText('先创建第一本书。')).toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });
});
