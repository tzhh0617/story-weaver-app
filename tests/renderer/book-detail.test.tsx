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

  it('renders chapters, reading, and context as fixed workbench panels', async () => {
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
    expect(screen.getByLabelText('章节列表标题')).toHaveTextContent('章节');
    expect(screen.getByLabelText('正文面板')).toBeInTheDocument();
    expect(screen.getByLabelText('上下文面板')).toBeInTheDocument();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '章节' })).toBeNull();
    expect(screen.getByRole('tab', { name: '大纲' })).toHaveAttribute('aria-selected', 'true');
    const chapterScrollArea = await screen.findByLabelText('章节滚动区');
    expect(chapterScrollArea).toBeInTheDocument();
    expect(chapterScrollArea.parentElement?.className).toContain('p-2');
  });

  it('keeps reading visible while switching context tabs', async () => {
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
    expect(screen.getByText('总纲')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '大纲' }));

    expect(await screen.findByText('总纲')).toBeInTheDocument();
    expect(screen.getByText('正文预览')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '人物' }));

    expect(await screen.findByText('人物状态')).toBeInTheDocument();
    expect(screen.queryByText('总纲')).toBeNull();
    expect(screen.getByText('正文预览')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '人物' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('tab', { name: '大纲' })).toHaveAttribute(
      'aria-selected',
      'false'
    );

    fireEvent.click(screen.getByRole('tab', { name: '伏笔' }));

    expect(await screen.findByText('伏笔追踪')).toBeInTheDocument();
    expect(screen.getByText('正文预览')).toBeInTheDocument();
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

  it('keeps action labels while adding visual icons to toolbar commands', () => {
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
          },
          {
            id: '1-2',
            title: 'Chapter 2',
            wordCount: 0,
            status: 'queued',
            content: null,
          },
        ]}
      />
    );

    for (const name of [
      '暂停',
      '恢复写作',
      '重新开始',
      '写下一章',
      '连续写作',
      '导出 TXT',
      '导出 MD',
      '删除作品',
    ]) {
      expect(
        screen.getByRole('button', { name }).querySelector('svg')
      ).toBeInTheDocument();
    }
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
    expect(screen.getByText('已完成 1 / 3 章')).toBeInTheDocument();
    expect(screen.getByLabelText('章节进度')).toHaveAttribute(
      'aria-valuenow',
      '33'
    );
    expect(screen.getByLabelText('章节列表标题')).toHaveTextContent('章节');
    expect(screen.getByLabelText('章节列表标题')).toHaveTextContent('1 / 3');
    expect(screen.getByLabelText('章节列表标题')).not.toHaveTextContent('33%');
    expect(screen.queryByText('章节进度')).toBeNull();
    expect(screen.queryByText('已完成 1')).toBeNull();
    expect(screen.queryByText('写作中 1')).toBeNull();
    expect(screen.queryByText('待写作 1')).toBeNull();
    expect(screen.queryByLabelText('章节筛选')).toBeNull();
    expect(screen.getByRole('button', { name: /第 1 章 · Chapter 1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /第 2 章 · Chapter 2/ })).toHaveAttribute(
      'aria-current',
      'step'
    );
    expect(screen.getByRole('button', { name: /第 3 章 · Chapter 3/ })).toBeInTheDocument();
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

    fireEvent.click(await screen.findByRole('button', { name: /第 2 章 · Chapter 2/ }));

    expect(
      await screen.findByText('当前查看：第 2 章 · Chapter 2')
    ).toBeInTheDocument();
    expect(await screen.findByText('章节大纲')).toBeInTheDocument();
    expect(screen.getByText('Second conflict')).toBeInTheDocument();
  });

  it('keeps the workbench fixed while chapters, reading, and context scroll internally', async () => {
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

    const chapterScrollArea = await screen.findByLabelText('章节滚动区');
    const readingScrollArea = await screen.findByLabelText('正文滚动区');
    const contextScrollArea = await screen.findByLabelText('上下文滚动区');

    expect(screen.getByTestId('book-detail-workbench').className).toContain(
      'overflow-hidden'
    );
    expect(chapterScrollArea.className).toContain('h-full');
    expect(readingScrollArea.className).toContain('h-full');
    expect(contextScrollArea.className).toContain('h-full');
    expect(chapterScrollArea).toHaveTextContent('Chapter 1');
    expect(chapterScrollArea).not.toHaveTextContent('正文预览');
    expect(chapterScrollArea).not.toHaveTextContent('第一章正文');
    expect(readingScrollArea).toHaveTextContent('第一章正文');
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
    expect(screen.getByText('第 2 章 · 已接收 10 字')).toBeInTheDocument();
  });

  it('automatically follows the streaming chapter until the user selects another chapter', async () => {
    const { rerender } = render(
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

    expect(await screen.findByRole('button', { name: /第 1 章 · Chapter 1/ })).toHaveAttribute(
      'data-selected',
      'true'
    );

    rerender(
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
          content: '流式正文',
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

    expect(await screen.findByRole('button', { name: /第 2 章 · Chapter 2/ })).toHaveAttribute(
      'data-selected',
      'true'
    );

    fireEvent.click(screen.getByRole('button', { name: /第 1 章 · Chapter 1/ }));

    expect(screen.getByRole('button', { name: /第 1 章 · Chapter 1/ })).toHaveAttribute(
      'data-selected',
      'true'
    );
    expect(screen.getByRole('button', { name: /第 2 章 · Chapter 2/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '回到实时追踪' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '回到实时追踪' }));

    expect(screen.getByRole('button', { name: /第 2 章 · Chapter 2/ })).toHaveAttribute(
      'data-selected',
      'true'
    );
    expect(screen.queryByRole('button', { name: '回到实时追踪' })).toBeNull();
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
