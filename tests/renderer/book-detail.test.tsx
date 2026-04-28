import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BookDetail from '../../renderer/pages/BookDetail';

describe('BookDetail', () => {
  it('shows tabs for outline, characters, chapters, and plot threads', () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 12000 }}
        progress={{ phase: 'writing' }}
      />
    );

    expect(screen.getByText('写作中 · 12000 字')).toBeInTheDocument();
    expect(screen.getByText('大纲')).toBeInTheDocument();
    expect(screen.getByText('人物')).toBeInTheDocument();
    expect(screen.getByText('章节')).toBeInTheDocument();
    expect(screen.getByText('伏笔')).toBeInTheDocument();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByRole('separator')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '大纲' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('switches visible sections when a different tab is selected', () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 12000 }}
        context={{
          worldSetting: 'World rules',
          outline: 'Master outline',
        }}
        latestScene={{
          location: 'Rain Market',
          timeInStory: 'Night',
          charactersPresent: ['Lin Mo'],
          events: 'Lin Mo discovers the forged ledger',
        }}
        characterStates={[
          {
            characterId: 'protagonist',
            characterName: 'Lin Mo',
            volumeIndex: 1,
            chapterIndex: 1,
            location: 'Rain Market',
            status: 'Investigating the debt ledger',
            knowledge: null,
            emotion: null,
            powerLevel: null,
          },
        ]}
        plotThreads={[
          {
            id: 'thread-1',
            description: 'Debt clue',
            plantedAt: 1,
            expectedPayoff: 3,
            resolvedAt: null,
            importance: 'normal',
          },
        ]}
        chapters={[
          {
            id: '1-1',
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
            content: 'Generated chapter content',
            summary: 'Chapter summary',
          },
        ]}
      />
    );

    expect(screen.getByText('总纲')).toBeInTheDocument();
    expect(screen.queryByText('人物状态')).toBeNull();

    fireEvent.click(screen.getByText('人物'));

    expect(screen.getByText('人物状态')).toBeInTheDocument();
    expect(screen.queryByText('总纲')).toBeNull();
    expect(screen.queryByText('正文预览')).toBeNull();
    expect(screen.getByRole('tab', { name: '人物' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('tab', { name: '大纲' })).toHaveAttribute(
      'aria-selected',
      'false'
    );

    fireEvent.click(screen.getByText('章节'));

    expect(screen.getByLabelText('章节滚动区')).toBeInTheDocument();
  });

  it('shows an empty state when the selected tab has no content yet', () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 12000 }}
      />
    );

    fireEvent.click(screen.getByText('人物'));

    expect(screen.getByText('暂无人物状态')).toBeInTheDocument();
  });

  it('disables actions that are not valid for the current book state', () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'paused', wordCount: 12000 }}
        progress={{ phase: 'paused' }}
        chapters={[
          {
            id: '1-1',
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
            content: 'Generated chapter content',
            summary: 'Chapter summary',
          },
          {
            id: '1-2',
            title: 'Chapter 2',
            wordCount: 0,
            status: 'queued',
            content: null,
            summary: null,
          },
        ]}
      />
    );

    expect(screen.getByRole('button', { name: '暂停' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '恢复写作' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '写下一章' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '连续写作' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '导出 TXT' })).toBeEnabled();
  });

  it('disables export when no chapter content has been generated yet', () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'building_outline', wordCount: 0 }}
        progress={{ phase: 'building_outline' }}
        chapters={[
          {
            id: '1-1',
            title: 'Chapter 1',
            wordCount: 0,
            status: 'queued',
            content: null,
            summary: null,
          },
        ]}
      />
    );

    expect(screen.getByRole('button', { name: '导出 TXT' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '导出 MD' })).toBeDisabled();
  });

  it('preserves chapter line breaks in the preview area', () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'completed', wordCount: 1200 }}
        progress={{ phase: 'completed' }}
        chapters={[
          {
            id: '1-1',
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
            content: '第一段\n第二段',
            summary: 'Chapter summary',
          },
        ]}
      />
    );

    fireEvent.click(screen.getByText('章节'));

    expect(
      screen.getByText(
        (_content, element) =>
          element?.tagName === 'P' && element.textContent === '第一段\n第二段'
      )
    ).toHaveClass('whitespace-pre-wrap');
  });
});
