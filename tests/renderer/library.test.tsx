import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Library from '../../renderer/pages/Library';

describe('Library', () => {
  it('renders the batch controls and summary line', () => {
    render(
      <Library
        books={[]}
        scheduler={{
          runningBookIds: [],
          queuedBookIds: [],
          pausedBookIds: ['book-1'],
          concurrencyLimit: 3,
        }}
        selectedBookId={null}
        selectedBookDetail={null}
        onSelectBook={vi.fn()}
        onStartAll={vi.fn()}
        onPauseAll={vi.fn()}
        onResume={vi.fn()}
        onRestart={vi.fn()}
        onPause={vi.fn()}
        onWriteNext={vi.fn()}
        onWriteAll={vi.fn()}
        onExport={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText('全部开始')).toBeInTheDocument();
    expect(
      screen.getByText('0/50 完成 | 0 写作中 | 0 排队 | 1 已暂停')
    ).toBeInTheDocument();
  });

  it('shows an empty-state message when there are no books yet', () => {
    render(
      <Library
        books={[]}
        scheduler={{
          runningBookIds: [],
          queuedBookIds: [],
          pausedBookIds: [],
          concurrencyLimit: 3,
        }}
        selectedBookId={null}
        selectedBookDetail={null}
        onSelectBook={vi.fn()}
        onStartAll={vi.fn()}
        onPauseAll={vi.fn()}
        onResume={vi.fn()}
        onRestart={vi.fn()}
        onPause={vi.fn()}
        onWriteNext={vi.fn()}
        onWriteAll={vi.fn()}
        onExport={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText('还没有作品，先创建第一本书。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '全部开始' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '全部暂停' })).toBeDisabled();
    expect(screen.getByText('暂无作品详情')).toBeInTheDocument();
  });

  it('enables only the relevant batch action for the current shelf state', () => {
    render(
      <Library
        books={[
          {
            id: 'book-1',
            title: 'Book 1',
            status: 'building_outline',
            targetWords: 500000,
          },
          {
            id: 'book-2',
            title: 'Book 2',
            status: 'paused',
            targetWords: 500000,
          },
        ]}
        scheduler={{
          runningBookIds: [],
          queuedBookIds: [],
          pausedBookIds: ['book-2'],
          concurrencyLimit: 3,
        }}
        selectedBookId={null}
        selectedBookDetail={null}
        onSelectBook={vi.fn()}
        onStartAll={vi.fn()}
        onPauseAll={vi.fn()}
        onResume={vi.fn()}
        onRestart={vi.fn()}
        onPause={vi.fn()}
        onWriteNext={vi.fn()}
        onWriteAll={vi.fn()}
        onExport={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: '全部开始' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '全部暂停' })).toBeEnabled();
  });
});
