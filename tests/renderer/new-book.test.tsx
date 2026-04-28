import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import NewBook from '../../renderer/pages/NewBook';

describe('NewBook', () => {
  it('submits idea, model, and target word count', () => {
    const onCreate = vi.fn();

    render(<NewBook onCreate={onCreate} />);

    fireEvent.change(screen.getByLabelText('IDEA'), {
      target: { value: 'A map eats its explorers.' },
    });
    fireEvent.change(screen.getByLabelText('目标字数'), {
      target: { value: '500000' },
    });
    fireEvent.click(screen.getByText('开始写作'));

    expect(onCreate).toHaveBeenCalledWith({
      idea: 'A map eats its explorers.',
      targetWords: 500000,
    });
  });

  it('does not render a model selector in the creation form', () => {
    render(<NewBook onCreate={vi.fn()} />);

    expect(screen.queryByLabelText('模型')).toBeNull();
  });

  it('disables submit until the idea has content', () => {
    render(<NewBook onCreate={vi.fn()} />);

    expect(screen.getByRole('button', { name: '开始写作' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('IDEA'), {
      target: { value: 'A map eats its explorers.' },
    });

    expect(screen.getByRole('button', { name: '开始写作' })).toBeEnabled();
  });

  it('keeps submit disabled when target word count is invalid', () => {
    render(<NewBook onCreate={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('IDEA'), {
      target: { value: 'A map eats its explorers.' },
    });
    fireEvent.change(screen.getByLabelText('目标字数'), {
      target: { value: '0' },
    });

    expect(screen.getByRole('button', { name: '开始写作' })).toBeDisabled();
  });
});
