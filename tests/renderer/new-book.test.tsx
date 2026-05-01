import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import NewBook from '@story-weaver/frontend/pages/NewBook';

describe('NewBook', () => {
  it('associates visible labels with the form controls', () => {
    render(<NewBook onCreate={vi.fn()} />);

    expect(screen.getByLabelText('故事设想')).toBeInTheDocument();
    expect(screen.getByLabelText('目标章节数')).toBeInTheDocument();
    expect(screen.getByLabelText('每章字数')).toBeInTheDocument();
    expect(screen.queryByLabelText('目标字数')).toBeNull();
  });

  it('submits idea, target chapters, words per chapter, and derived total words', () => {
    const onCreate = vi.fn();

    render(<NewBook onCreate={onCreate} />);

    fireEvent.change(screen.getByLabelText('故事设想'), {
      target: { value: 'A map eats its explorers.' },
    });
    fireEvent.change(screen.getByLabelText('目标章节数'), {
      target: { value: '800' },
    });
    fireEvent.change(screen.getByLabelText('每章字数'), {
      target: { value: '3000' },
    });
    fireEvent.click(screen.getByText('开始写作'));

    expect(onCreate).toHaveBeenCalledWith({
      idea: 'A map eats its explorers.',
      targetChapters: 800,
      wordsPerChapter: 3000,
    });
  });

  it('submits optional viral strategy fields when provided', () => {
    const onCreate = vi.fn();

    render(<NewBook onCreate={onCreate} />);

    fireEvent.change(screen.getByLabelText('故事设想'), {
      target: { value: 'A map eats its explorers.' },
    });
    fireEvent.change(screen.getByLabelText('读者爽点'), {
      target: { value: '弱者反杀规则制定者' },
    });
    fireEvent.change(screen.getByLabelText('主角欲望'), {
      target: { value: '夺回被偷走的人生署名权' },
    });
    fireEvent.change(screen.getByLabelText('节奏偏好'), {
      target: { value: 'fast' },
    });
    fireEvent.change(screen.getByLabelText('反套路方向'), {
      target: { value: '每次变强都暴露新债务' },
    });
    fireEvent.click(screen.getByText('开始写作'));

    expect(onCreate).toHaveBeenCalledWith({
      idea: 'A map eats its explorers.',
      targetChapters: 500,
      wordsPerChapter: 2500,
      viralStrategy: {
        readerPayoff: '弱者反杀规则制定者',
        protagonistDesire: '夺回被偷走的人生署名权',
        cadenceMode: 'fast',
        antiClicheDirection: '每次变强都暴露新债务',
      },
    });
  });

  it('defaults to 500 chapters and 2500 words per chapter', () => {
    const onCreate = vi.fn();

    render(<NewBook onCreate={onCreate} />);

    fireEvent.change(screen.getByLabelText('故事设想'), {
      target: { value: 'A map eats its explorers.' },
    });
    fireEvent.click(screen.getByText('开始写作'));

    expect(onCreate).toHaveBeenCalledWith({
      idea: 'A map eats its explorers.',
      targetChapters: 500,
      wordsPerChapter: 2500,
    });
  });

  it('does not render a model selector in the creation form', () => {
    render(<NewBook onCreate={vi.fn()} />);

    expect(screen.queryByLabelText('模型')).toBeNull();
  });

  it('renders the intro and form shells with the shared layout card treatment', () => {
    render(<NewBook onCreate={vi.fn()} />);

    expect(screen.getByTestId('new-book-intro-panel').className).toContain(
      'rounded-[1.35rem]'
    );
    expect(screen.getByTestId('new-book-form-panel').className).toContain(
      'ring-1'
    );
  });

  it('gives the right-side creation fields their own top padding', () => {
    render(<NewBook onCreate={vi.fn()} />);

    expect(screen.getByTestId('new-book-fields-panel').className).toContain(
      'p-6'
    );
  });

  it('disables submit until the idea has content', () => {
    render(<NewBook onCreate={vi.fn()} />);

    expect(screen.getByRole('button', { name: '开始写作' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('故事设想'), {
      target: { value: 'A map eats its explorers.' },
    });

    expect(screen.getByRole('button', { name: '开始写作' })).toBeEnabled();
  });

  it('keeps submit disabled when words per chapter is invalid', () => {
    render(<NewBook onCreate={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('故事设想'), {
      target: { value: 'A map eats its explorers.' },
    });
    fireEvent.change(screen.getByLabelText('每章字数'), {
      target: { value: '0' },
    });

    expect(screen.getByRole('button', { name: '开始写作' })).toBeDisabled();
  });
});
