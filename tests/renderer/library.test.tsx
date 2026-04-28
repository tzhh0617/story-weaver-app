import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Library from '../../renderer/pages/Library';

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
            targetWords: 500000,
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
    expect(screen.getByText('50 万字目标')).toBeInTheDocument();
    expect(screen.getByText('38 / 50 章')).toBeInTheDocument();
    expect(screen.getAllByText('写作中').length).toBeGreaterThan(0);
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
            targetWords: 500000,
            updatedAt: '2026-04-28T12:00:00.000Z',
            createdAt: '2026-04-28T10:00:00.000Z',
          },
          {
            id: 'book-2',
            title: 'Book 2',
            idea: 'A lantern remembers every storm.',
            status: 'paused',
            targetWords: 500000,
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

  it('supports search without exposing temporary filter controls', () => {
    render(
      <Library
        books={[
          {
            id: 'book-1',
            title: '北境遗城',
            idea: '旧王朝复苏。',
            status: 'writing',
            targetWords: 500000,
            updatedAt: '2026-04-28T12:00:00.000Z',
            createdAt: '2026-04-28T10:00:00.000Z',
          },
          {
            id: 'book-2',
            title: '南海灯塔',
            idea: '灯塔记录每一场风暴。',
            status: 'paused',
            targetWords: 300000,
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

    fireEvent.change(screen.getByLabelText('搜索作品'), {
      target: { value: '灯塔' },
    });

    expect(screen.queryByRole('button', { name: '北境遗城' })).toBeNull();
    expect(screen.getByRole('button', { name: '南海灯塔' })).toBeInTheDocument();
  });
});
