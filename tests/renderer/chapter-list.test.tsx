import { act, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import ChapterList from '../../renderer/components/ChapterList';

describe('ChapterList', () => {
  it('shows audit score when a chapter has been audited', () => {
    render(
      <ChapterList
        chapters={[
          {
            id: '1-1',
            volumeIndex: 1,
            chapterIndex: 1,
            title: '旧页初鸣',
            wordCount: 1200,
            status: 'done',
            auditScore: 88,
            draftAttempts: 1,
          },
        ]}
      />
    );

    expect(screen.getByText(/审计 88/)).toBeInTheDocument();
  });

  it('keeps full chapter metadata in the accessible row name', () => {
    const { container } = render(
      <ChapterList
        chapters={[
          {
            id: '1',
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
          },
          {
            id: '2',
            title: 'Chapter 2',
            wordCount: 0,
            status: 'queued',
          },
        ]}
      />
    );

    expect(
      screen.getByRole('button', { name: '第 1 章 · Chapter 1 1.2 千字 已完成' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '第 2 章 · Chapter 2 0 千字 待写作' })
    ).toBeInTheDocument();
    expect(screen.getByText('Chapter 1')).toBeInTheDocument();
    expect(screen.getByText('1.2 千字')).toBeInTheDocument();
    expect(screen.queryByText('0 千字')).toBeNull();
    expect(screen.queryByText('已完成')).toBeNull();
    expect(screen.queryByText('待写作')).toBeNull();
    expect(screen.getByText('待写')).toBeInTheDocument();
    expect(container.querySelector('[data-status-dot]')).toBeNull();
  });

  it('renders visual rows like a compact table of contents', () => {
    render(
      <ChapterList
        chapters={[
          {
            id: '1',
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
          },
          {
            id: '2',
            title: 'Chapter 2',
            wordCount: 0,
            status: 'queued',
          },
        ]}
      />
    );

    expect(screen.getByText('第 1 章')).toBeInTheDocument();
    expect(screen.getByText('第 2 章')).toBeInTheDocument();
    expect(screen.getByText('Chapter 1')).toBeInTheDocument();
    expect(screen.getByText('Chapter 2')).toBeInTheDocument();
  });

  it('marks the selected chapter as pressed with a visible selected treatment', () => {
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = vi.fn();

    render(
      <ChapterList
        selectedChapterId="2"
        chapters={[
          {
            id: '1',
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
          },
          {
            id: '2',
            title: 'Chapter 2',
            wordCount: 0,
            status: 'queued',
          },
        ]}
      />
    );

    try {
      expect(screen.getByRole('button', { name: /Chapter 1/ })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
      expect(screen.getByRole('button', { name: /Chapter 2/ })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      const selectedChapterButton = screen.getByRole('button', { name: /Chapter 2/ });
      const selectedInkWash = selectedChapterButton.querySelector('[data-ink-wash]');

      expect(selectedChapterButton.className).toContain('group/chapter-row');
      expect(selectedChapterButton.className).toContain('bg-transparent');
      expect(selectedChapterButton.className).not.toContain('bg-muted/55');
      expect(selectedChapterButton.className).not.toContain('bg-primary/[0.035]');
      expect(selectedChapterButton.className).not.toContain('ring-1');
      expect(selectedChapterButton.querySelector('[data-selection-marker]')).toBeNull();
      expect(selectedInkWash).toBeInTheDocument();
      expect(selectedInkWash?.className).toContain('chapter-ink-wash');
      expect(selectedInkWash?.className).toContain('opacity-90');
      expect(selectedInkWash?.className).not.toContain('repeating-linear-gradient');
      expect(selectedChapterButton.querySelector('[data-ink-bristles]')).toBeNull();
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it('shows a brush-shadow hover treatment without block backgrounds', () => {
    render(
      <ChapterList
        chapters={[
          {
            id: '1',
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
          },
        ]}
      />
    );

    const chapterButton = screen.getByRole('button', { name: /Chapter 1/ });
    const hoverInk = chapterButton.querySelector('[data-ink-wash]');

    expect(chapterButton.className).toContain('group/chapter-row');
    expect(chapterButton.className).not.toContain('hover:bg-muted');
    expect(hoverInk).toBeInTheDocument();
    expect(hoverInk?.className).toContain('chapter-ink-wash');
    expect(hoverInk?.className).toContain('opacity-0');
    expect(hoverInk?.className).toContain('group-hover/chapter-row:opacity-70');
  });

  it('defines the ink wash with soft masks and irregular edges instead of square texture artifacts', () => {
    const css = readFileSync(
      join(process.cwd(), 'renderer/index.css'),
      'utf8'
    );
    const inkWashRule = css.slice(
      css.indexOf('.chapter-ink-wash'),
      css.indexOf('.chapter-ink-wash::before')
    );

    expect(inkWashRule).toContain('mask-image');
    expect(inkWashRule).toContain('radial-gradient');
    expect(inkWashRule).toContain('clip-path: polygon');
    expect(inkWashRule).not.toContain('repeating-linear-gradient');
    expect(inkWashRule).not.toContain('linear-gradient(0deg');
  });

  it('uses compact toc spacing so long chapter plans stay scannable', () => {
    const { container } = render(
      <ChapterList
        chapters={[
          {
            id: '1',
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
          },
        ]}
      />
    );

    expect(container.querySelector('ul')?.className).toContain('gap-0');
    const chapterButton = screen.getByRole('button', { name: /Chapter 1/ });

    expect(chapterButton.className).toContain('flex');
    expect(chapterButton.className).toContain('h-9');
    expect(chapterButton.className).not.toContain('grid-cols');
    expect(chapterButton.className).toContain('px-1.5');
    expect(chapterButton.querySelector('.grid')).toBeNull();
  });

  it('separates rows with quiet dividers instead of empty gaps', () => {
    const { container } = render(
      <ChapterList
        chapters={[
          {
            id: '1',
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
          },
          {
            id: '2',
            title: 'Chapter 2',
            wordCount: 0,
            status: 'queued',
          },
        ]}
      />
    );

    const chapterItems = container.querySelectorAll('li');

    expect(chapterItems[0]?.className).not.toContain('border-b');
    expect(chapterItems[0]?.querySelector('[data-row-divider]')?.className).toContain('ml-0');
    expect(chapterItems[0]?.querySelector('[data-row-divider]')?.className).toContain(
      'bg-border/35'
    );
    expect(chapterItems[1]?.querySelector('[data-row-divider]')?.className).toContain(
      'last:hidden'
    );
  });

  it('uses a quiet table-of-contents treatment without decorative leaders', () => {
    const { container } = render(
      <ChapterList
        chapters={[
          {
            id: '1',
            title: 'A very long chapter title that should still scan cleanly',
            wordCount: 1200,
            status: 'writing',
          },
        ]}
      />
    );

    const chapterButton = screen.getByRole('button', { name: /A very long/ });
    const chapterNumber = screen.getByText('第 1 章');
    const compactMeta = screen.getByText('1.2 千字 · 写作中');

    expect(chapterButton.className).toContain('rounded-sm');
    expect(chapterButton.className).toContain('shadow-none');
    expect(chapterButton.className).toContain('gap-1.5');
    expect(chapterButton.className).not.toContain('hover:bg-muted');
    expect(chapterNumber.className).toContain('font-serif');
    expect(chapterNumber.className).toContain('tabular-nums');
    expect(chapterNumber.className).toContain('whitespace-nowrap');
    expect(chapterNumber.className).not.toContain('w-16');
    expect(chapterNumber.className).not.toContain('w-[3.25rem]');
    expect(chapterNumber.className).not.toContain('pl-1');
    expect(screen.getByText('A very long chapter title that should still scan cleanly').className).toContain(
      'truncate'
    );
    expect(compactMeta.className).toContain('tabular-nums');
    expect(compactMeta.className).toContain('ml-auto');
    expect(container.querySelector('[data-toc-leader]')).toBeNull();
    expect(container.querySelector('[data-status-dot]')).toBeNull();
    expect(container.querySelector('[data-status-pill]')).toBeNull();
  });

  it('keeps planned queued chapters from competing with the title', () => {
    render(
      <ChapterList
        chapters={[
          {
            id: '1',
            title: 'Planned chapter',
            wordCount: 1800,
            status: 'queued',
          },
        ]}
      />
    );

    expect(screen.getByRole('button', { name: /1.8 千字 待写作/ })).toBeInTheDocument();
    expect(screen.getByText('1.8 千字')).toBeInTheDocument();
    expect(screen.queryByText('1.8 千字 · 待写')).toBeNull();
  });

  it('keeps large chapter numbers on one line without a fixed number column', () => {
    render(
      <ChapterList
        chapters={Array.from({ length: 86 }, (_, index) => ({
          id: `${index + 1}`,
          title: `Chapter ${index + 1}`,
          wordCount: 0,
          status: 'queued' as const,
        }))}
      />
    );

    const chapterNumber = screen.getByText('第 86 章');
    const chapterButton = screen.getByRole('button', {
      name: /第 86 章 · Chapter 86/,
    });

    expect(chapterNumber.className).toContain('whitespace-nowrap');
    expect(chapterNumber.className).toContain('shrink-0');
    expect(chapterNumber.className).not.toContain('w-');
    expect(chapterButton.className).not.toContain('grid-cols');
  });

  it('groups chapters by volume while showing cumulative chapter numbers', () => {
    render(
      <ChapterList
        chapters={[
          {
            id: '1-1',
            volumeIndex: 1,
            chapterIndex: 1,
            title: 'Opening',
            wordCount: 1200,
            status: 'done',
          },
          {
            id: '1-2',
            volumeIndex: 1,
            chapterIndex: 2,
            title: 'Second',
            wordCount: 0,
            status: 'queued',
          },
          {
            id: '2-1',
            volumeIndex: 2,
            chapterIndex: 3,
            title: 'New Arc',
            wordCount: 0,
            status: 'queued',
          },
        ]}
      />
    );

    expect(screen.getByText('第 1 卷')).toBeInTheDocument();
    expect(screen.getByText('第 2 卷')).toBeInTheDocument();
    expect(screen.getByText('第 1 卷').parentElement?.className).not.toContain(
      'flex'
    );
    expect(screen.getByRole('button', { name: /第 1 章 · Opening/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /第 2 章 · Second/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /第 3 章 · New Arc/ })).toBeInTheDocument();
    expect(screen.queryByText('第 1.2 章')).toBeNull();
    expect(screen.queryByText('第 2.1 章')).toBeNull();
  });

  it('auto-scrolls the current writing chapter into view immediately', () => {
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    vi.useFakeTimers();

    try {
      render(
        <ChapterList
          activeChapterId="2"
          chapters={[
            {
              id: '1',
              title: 'Chapter 1',
              wordCount: 1200,
              status: 'done',
            },
            {
              id: '2',
              title: 'Chapter 2',
              wordCount: 0,
              status: 'writing',
            },
          ]}
        />
      );

      expect(scrollIntoView).toHaveBeenCalledWith({
        block: 'center',
        inline: 'nearest',
        behavior: 'smooth',
      });
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
      vi.useRealTimers();
    }
  });

  it('waits until five seconds after manual list scrolling before auto-scrolling back', () => {
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    vi.useFakeTimers();

    try {
      render(
        <ChapterList
          activeChapterId="2"
          chapters={[
            {
              id: '1',
              title: 'Chapter 1',
              wordCount: 1200,
              status: 'done',
            },
            {
              id: '2',
              title: 'Chapter 2',
              wordCount: 0,
              status: 'writing',
            },
          ]}
        />
      );

      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      scrollIntoView.mockClear();

      act(() => {
        vi.advanceTimersByTime(4000);
      });
      fireEvent.wheel(screen.getByRole('list'));
      act(() => {
        vi.advanceTimersByTime(4999);
      });
      expect(scrollIntoView).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
      vi.useRealTimers();
    }
  });

  it('delays revealing a newly active selected chapter when the list was just manually scrolled', () => {
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    vi.useFakeTimers();

    try {
      const chapters = [
        {
          id: '1',
          title: 'Chapter 1',
          wordCount: 1200,
          status: 'done' as const,
        },
        {
          id: '2',
          title: 'Chapter 2',
          wordCount: 1200,
          status: 'done' as const,
        },
        {
          id: '3',
          title: 'Chapter 3',
          wordCount: 0,
          status: 'writing' as const,
        },
      ];

      const { rerender } = render(
        <ChapterList
          activeChapterId="2"
          selectedChapterId="2"
          chapters={chapters}
        />
      );

      expect(scrollIntoView).toHaveBeenCalledTimes(2);
      scrollIntoView.mockClear();

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      fireEvent.wheel(screen.getByRole('list'));

      rerender(
        <ChapterList
          activeChapterId="3"
          selectedChapterId="3"
          chapters={chapters}
        />
      );

      expect(scrollIntoView).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(4999);
      });
      expect(scrollIntoView).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(scrollIntoView).toHaveBeenCalledWith({
        block: 'center',
        inline: 'nearest',
        behavior: 'smooth',
      });
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
      vi.useRealTimers();
    }
  });

  it('does not auto-scroll back when another chapter is selected', () => {
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    vi.useFakeTimers();

    try {
      render(
        <ChapterList
          activeChapterId="2"
          selectedChapterId="1"
          chapters={[
            {
              id: '1',
              title: 'Chapter 1',
              wordCount: 1200,
              status: 'done',
            },
            {
              id: '2',
              title: 'Chapter 2',
              wordCount: 0,
              status: 'writing',
            },
          ]}
        />
      );

      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      scrollIntoView.mockClear();

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(scrollIntoView).not.toHaveBeenCalled();
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
      vi.useRealTimers();
    }
  });
});
