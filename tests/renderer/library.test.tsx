import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Library from '@story-weaver/frontend/pages/Library';

describe('Library', () => {
  it('renders the library title inside the shared intro panel', () => {
    render(
      <Library
        books={[]}
        scheduler={{
          runningBookIds: [],
          queuedBookIds: [],
          pausedBookIds: [],
          concurrencyLimit: 3,
        }}
        onSelectBook={vi.fn()}
        onCreateBook={vi.fn()}
        onStartAll={vi.fn()}
        onPauseAll={vi.fn()}
      />
    );

    expect(screen.getByTestId('library-intro-panel').className).toContain(
      'rounded-[1.35rem]'
    );
    expect(screen.getByText('Story Library / Archive')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '作品库' })).toBeInTheDocument();
  });

  it('renders archive-style cards with story summary and production metadata', () => {
    render(
      <Library
        books={[
          {
            id: 'book-1',
            title: '北境遗城',
            idea: '旧王朝复苏，双主角在寒地边境争夺最后的王权。',
            status: 'writing',
            targetChapters: 500,
            wordsPerChapter: 2500,
            updatedAt: '2026-04-28T12:00:00.000Z',
            createdAt: '2026-04-28T10:00:00.000Z',
            progress: 76,
            completedChapters: 38,
            totalChapters: 50,
          },
        ]}
        scheduler={{
          runningBookIds: ['book-1'],
          queuedBookIds: [],
          pausedBookIds: [],
          concurrencyLimit: 3,
        }}
        onSelectBook={vi.fn()}
        onStartAll={vi.fn()}
        onPauseAll={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: '北境遗城' })).toBeInTheDocument();
    expect(
      screen.getByText('旧王朝复苏，双主角在寒地边境争夺最后的王权。')
    ).toBeInTheDocument();
    expect(screen.getByText('500 章目标')).toBeInTheDocument();
    expect(screen.getByText('2.5 千字/章')).toBeInTheDocument();
    expect(screen.getByText('38 / 50 章')).toBeInTheDocument();
    expect(screen.getAllByText('写作中').length).toBeGreaterThan(0);
  });

  it('groups shelf controls, search, stats, and book cards inside one workspace card', () => {
    render(
      <Library
        books={[
          {
            id: 'book-1',
            title: '北境遗城',
            idea: '旧王朝复苏，双主角在寒地边境争夺最后的王权。',
            status: 'writing',
            targetChapters: 500,
            wordsPerChapter: 2500,
            updatedAt: '2026-04-28T12:00:00.000Z',
            createdAt: '2026-04-28T10:00:00.000Z',
          },
        ]}
        scheduler={{
          runningBookIds: ['book-1'],
          queuedBookIds: [],
          pausedBookIds: [],
          concurrencyLimit: 3,
        }}
        onSelectBook={vi.fn()}
        onCreateBook={vi.fn()}
        onStartAll={vi.fn()}
        onPauseAll={vi.fn()}
      />
    );

    const workspaceCard = screen.getByTestId('library-workspace-card');

    expect(workspaceCard.className).toContain('rounded-[1.35rem]');
    const toolbar = screen.getByTestId('library-toolbar');
    const actions = screen.getByTestId('library-actions');

    expect(actions.className).toContain('sm:ml-auto');
    expect(actions).toContainElement(
      screen.getByRole('button', { name: '新建作品' })
    );
    expect(toolbar).toContainElement(screen.getByLabelText('按标题搜索作品'));
    expect(toolbar).toContainElement(actions);
    expect(workspaceCard).toContainElement(toolbar);
    expect(workspaceCard).toContainElement(screen.getByText('完成'));
    expect(workspaceCard).toContainElement(
      screen.getByRole('button', { name: '北境遗城' })
    );
  });

  it('shows an empty-state message when there are no books yet', () => {
    const onCreateBook = vi.fn();

    render(
      <Library
        books={[]}
        scheduler={{
          runningBookIds: [],
          queuedBookIds: [],
          pausedBookIds: [],
          concurrencyLimit: 3,
        }}
        onSelectBook={vi.fn()}
        onCreateBook={onCreateBook}
        onStartAll={vi.fn()}
        onPauseAll={vi.fn()}
      />
    );

    expect(
      screen.getByText(
        '这排书架还空着。创建第一本作品后，它会以书卡形式出现在这里，并显示章节进度、写作状态和最近更新。'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '全部开始' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '全部暂停' })).toBeDisabled();
    expect(screen.getByText('完成')).toBeInTheDocument();
    expect(screen.getAllByText('写作中').length).toBeGreaterThan(0);
    expect(screen.queryByText('暂无作品详情')).toBeNull();

    screen.getByRole('button', { name: '新建第一本作品' }).click();
    expect(onCreateBook).toHaveBeenCalledTimes(1);
  });

  it('enables only the relevant batch action for the current shelf state', () => {
    render(
      <Library
        books={[
          {
            id: 'book-1',
            title: 'Book 1',
            idea: 'A buried archive wakes up.',
            status: 'building_outline',
            targetChapters: 500,
            wordsPerChapter: 2500,
            updatedAt: '2026-04-28T12:00:00.000Z',
            createdAt: '2026-04-28T10:00:00.000Z',
          },
          {
            id: 'book-2',
            title: 'Book 2',
            idea: 'A lantern remembers every storm.',
            status: 'paused',
            targetChapters: 500,
            wordsPerChapter: 2500,
            updatedAt: '2026-04-28T12:00:00.000Z',
            createdAt: '2026-04-28T10:00:00.000Z',
          },
        ]}
        scheduler={{
          runningBookIds: [],
          queuedBookIds: [],
          pausedBookIds: ['book-2'],
          concurrencyLimit: 3,
        }}
        onSelectBook={vi.fn()}
        onStartAll={vi.fn()}
        onPauseAll={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: '全部开始' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '全部暂停' })).toBeEnabled();
  });

  it('searches by title only with a compact input', () => {
    render(
      <Library
        books={[
          {
            id: 'book-1',
            title: '北境遗城',
            idea: '旧王朝复苏。',
            status: 'writing',
            targetChapters: 500,
            wordsPerChapter: 2500,
            updatedAt: '2026-04-28T12:00:00.000Z',
            createdAt: '2026-04-28T10:00:00.000Z',
          },
          {
            id: 'book-2',
            title: '南海灯塔',
            idea: '灯塔记录每一场风暴。',
            status: 'paused',
            targetChapters: 500,
            wordsPerChapter: 2500,
            updatedAt: '2026-04-28T12:00:00.000Z',
            createdAt: '2026-04-28T10:00:00.000Z',
          },
        ]}
        scheduler={{
          runningBookIds: [],
          queuedBookIds: [],
          pausedBookIds: ['book-2'],
          concurrencyLimit: 3,
        }}
        onSelectBook={vi.fn()}
        onStartAll={vi.fn()}
        onPauseAll={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: '全部状态' })).toBeNull();
    expect(screen.queryByRole('button', { name: '最近更新' })).toBeNull();

    const searchInput = screen.getByLabelText('按标题搜索作品');

    expect(searchInput).toHaveAttribute('placeholder', '按标题搜索');
    expect(searchInput.className).toContain('h-9');
    expect(searchInput.className).toContain('sm:max-w-64');

    fireEvent.change(searchInput, {
      target: { value: '旧王朝' },
    });

    expect(screen.queryByRole('button', { name: '北境遗城' })).toBeNull();
    expect(screen.queryByRole('button', { name: '南海灯塔' })).toBeNull();
    expect(
      screen.getByText('换一个标题关键词试试。搜索仅匹配作品标题。')
    ).toBeInTheDocument();

    fireEvent.change(searchInput, {
      target: { value: '灯塔' },
    });

    expect(screen.queryByRole('button', { name: '北境遗城' })).toBeNull();
    expect(screen.getByRole('button', { name: '南海灯塔' })).toBeInTheDocument();
  });
});
