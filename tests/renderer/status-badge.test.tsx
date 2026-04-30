import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StatusBadge from '../../renderer/components/StatusBadge';

describe('StatusBadge', () => {
  it('renders a user-facing Chinese label for internal status values', () => {
    render(<StatusBadge status="completed" />);

    expect(screen.getByText('已完成')).toHaveClass('inline-flex');
  });

  it('renders a label for the title generation phase', () => {
    render(<StatusBadge status="naming_title" />);

    expect(screen.getByText('生成书名')).toHaveClass(
      'text-muted-foreground'
    );
  });

  it('renders a label for the chapter planning phase', () => {
    render(<StatusBadge status="planning_chapters" />);

    expect(screen.getByText('规划章节')).toHaveClass(
      'text-muted-foreground'
    );
  });

  it('renders labels for narrative review phases', () => {
    const { rerender } = render(<StatusBadge status="auditing_chapter" />);

    expect(screen.getByText('章节审校')).toHaveClass('text-muted-foreground');

    rerender(<StatusBadge status="extracting_state" />);
    expect(screen.getByText('提取叙事状态')).toHaveClass(
      'text-muted-foreground'
    );

    rerender(<StatusBadge status="checkpoint_review" />);
    expect(screen.getByText('叙事复盘')).toHaveClass(
      'text-muted-foreground'
    );
  });
});
