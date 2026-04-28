import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ChapterList from '../../renderer/components/ChapterList';

describe('ChapterList', () => {
  it('shows a user-facing status label for each chapter', () => {
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

    expect(screen.getByText('Chapter 1')).toBeInTheDocument();
    expect(screen.getByText('1200 字')).toBeInTheDocument();
    expect(screen.getByText('已完成')).toBeInTheDocument();
    expect(screen.getByText('Chapter 2')).toBeInTheDocument();
    expect(screen.getByText('0 字')).toBeInTheDocument();
    expect(screen.getByText('待写作')).toBeInTheDocument();
  });
});
