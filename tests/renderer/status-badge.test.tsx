import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StatusBadge from '../../renderer/components/StatusBadge';

describe('StatusBadge', () => {
  it('renders a user-facing Chinese label for internal status values', () => {
    render(<StatusBadge status="completed" />);

    expect(screen.getByText('已完成')).toHaveClass('inline-flex');
  });
});
