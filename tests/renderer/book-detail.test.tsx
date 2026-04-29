import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BookDetail from '../../renderer/pages/BookDetail';

describe('BookDetail', () => {
  it('renders the detail title inside the shared intro panel', () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 12000 }}
        progress={{ phase: 'writing' }}
      />
    );

    expect(screen.getByTestId('book-detail-intro-panel').className).toContain(
      'rounded-[1.35rem]'
    );
    expect(screen.getByText('Manuscript Workspace')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Book 1' })).toBeInTheDocument();
  });

  it('defaults to chapters as the primary view while keeping outline, characters, and plot threads available', async () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 12000 }}
        progress={{ phase: 'writing' }}
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

    expect(screen.getByText('写作中 · 12000 字')).toBeInTheDocument();
    expect(screen.getByText('章节')).toBeInTheDocument();
    expect(screen.getByText('大纲')).toBeInTheDocument();
    expect(screen.getByText('人物')).toBeInTheDocument();
    expect(screen.getByText('伏笔')).toBeInTheDocument();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '章节' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(await screen.findByLabelText('章节滚动区')).toBeInTheDocument();
  });

  it('switches visible sections when a different tab is selected', async () => {
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

    expect(screen.getByText('正文预览')).toBeInTheDocument();
    expect(screen.queryByText('总纲')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: '大纲' }));

    expect(await screen.findByText('总纲')).toBeInTheDocument();
    expect(screen.queryByText('正文预览')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: '人物' }));

    expect(await screen.findByText('人物状态')).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('tab', { name: '章节' }));

    expect(await screen.findByLabelText('章节滚动区')).toBeInTheDocument();
  });

  it('shows an empty state when the selected tab has no content yet', async () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 12000 }}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: '人物' }));

    expect(await screen.findByText('暂无人物状态')).toBeInTheDocument();
  });

  it('uses phase-aware empty states while generated material is still arriving', async () => {
    const { rerender } = render(
      <BookDetail
        book={{ title: '新作品', status: 'creating', wordCount: 0 }}
        progress={{ phase: 'naming_title' }}
      />
    );

    expect(await screen.findByText('正在生成书名...')).toBeInTheDocument();

    rerender(
      <BookDetail
        book={{ title: '新作品', status: 'building_world', wordCount: 0 }}
        progress={{ phase: 'building_world' }}
      />
    );
    fireEvent.click(screen.getByRole('tab', { name: '大纲' }));

    expect(await screen.findByText('正在生成世界观...')).toBeInTheDocument();

    rerender(
      <BookDetail
        book={{ title: '月税奇谈', status: 'building_outline', wordCount: 0 }}
        progress={{ phase: 'planning_chapters' }}
        context={{
          worldSetting: 'World rules',
          outline: 'Master outline',
        }}
      />
    );
    fireEvent.click(screen.getByRole('tab', { name: '章节' }));

    expect(await screen.findByText('正在规划章节...')).toBeInTheDocument();
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

  it('preserves chapter line breaks in the preview area', async () => {
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

    fireEvent.click(screen.getByRole('tab', { name: '章节' }));

    expect(
      await screen.findByText(
        (_content, element) =>
          element?.tagName === 'P' && element.textContent === '第一段\n第二段'
      )
    ).toHaveClass('whitespace-pre-wrap');
  });

  it('renders every planned chapter and highlights the current writing chapter', async () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 1200 }}
        progress={{
          phase: 'writing',
          stepLabel: '正在写第 2 章',
          currentVolume: 1,
          currentChapter: 2,
        }}
        chapters={[
          {
            id: '1-1',
            volumeIndex: 1,
            chapterIndex: 1,
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
            content: '第一章正文',
            outline: 'Opening conflict',
          },
          {
            id: '1-2',
            volumeIndex: 1,
            chapterIndex: 2,
            title: 'Chapter 2',
            wordCount: 0,
            status: 'writing',
            content: null,
            outline: 'Second conflict',
          },
          {
            id: '1-3',
            volumeIndex: 1,
            chapterIndex: 3,
            title: 'Chapter 3',
            wordCount: 0,
            status: 'queued',
            content: null,
            outline: 'Third conflict',
          },
        ]}
      />
    );

    expect(await screen.findByText('当前步骤')).toBeInTheDocument();
    expect(screen.getByText('正在写第 2 章')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /第 1\.1 章 Chapter 1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /第 1\.2 章 Chapter 2/ })).toHaveAttribute(
      'aria-current',
      'step'
    );
    expect(screen.getByRole('button', { name: /第 1\.3 章 Chapter 3/ })).toBeInTheDocument();
  });

  it('selects an outline-only chapter and shows its outline as the preview', async () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 1200 }}
        progress={{ phase: 'writing' }}
        chapters={[
          {
            id: '1-1',
            volumeIndex: 1,
            chapterIndex: 1,
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
            content: '第一章正文',
            outline: 'Opening conflict',
          },
          {
            id: '1-2',
            volumeIndex: 1,
            chapterIndex: 2,
            title: 'Chapter 2',
            wordCount: 0,
            status: 'queued',
            content: null,
            outline: 'Second conflict',
          },
        ]}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: /第 1\.2 章 Chapter 2/ }));

    expect(await screen.findByText('章节大纲')).toBeInTheDocument();
    expect(screen.getByText('Second conflict')).toBeInTheDocument();
  });

  it('shows streaming chapter output separately from saved chapter content', async () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 1200 }}
        progress={{
          phase: 'writing',
          stepLabel: '正在写第 2 章',
          currentVolume: 1,
          currentChapter: 2,
        }}
        liveOutput={{
          volumeIndex: 1,
          chapterIndex: 2,
          title: 'Chapter 2',
          content: '流式第一段\n流式第二段',
        }}
        chapters={[
          {
            id: '1-1',
            volumeIndex: 1,
            chapterIndex: 1,
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
            content: '第一章正文',
            outline: 'Opening conflict',
          },
          {
            id: '1-2',
            volumeIndex: 1,
            chapterIndex: 2,
            title: 'Chapter 2',
            wordCount: 0,
            status: 'writing',
            content: null,
            outline: 'Second conflict',
          },
        ]}
      />
    );

    expect(await screen.findByText('实时输出')).toBeInTheDocument();
    expect(
      screen.getByText(
        (_content, element) =>
          element?.tagName === 'P' &&
          element.textContent === '流式第一段\n流式第二段'
      )
    ).toHaveClass('whitespace-pre-wrap');
    expect(screen.getByText('正在输出 Chapter 2')).toBeInTheDocument();
  });

  it('uses the shared layout card treatment for the page shell and detail sections', async () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 12000 }}
      />
    );

    expect(screen.getByTestId('book-detail-header').className).toContain(
      'rounded-[1.35rem]'
    );
    expect(screen.getByTestId('book-detail-header').className).toContain('ring-1');

    fireEvent.click(screen.getByRole('tab', { name: '大纲' }));

    expect(
      (await screen.findByTestId('book-detail-empty-outline')).className
    ).toContain('border-dashed');
  });
});
