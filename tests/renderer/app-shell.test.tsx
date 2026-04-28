import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../../renderer/App';

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function installIpcMock(
  handler: (channel: string, payload?: unknown) => Promise<unknown>
) {
  const invoke = vi.fn(handler);
  let progressListener: ((payload: unknown) => void) | null = null;
  function invokeTyped<T>(channel: string, payload?: unknown) {
    return invoke(channel, payload) as Promise<T>;
  }

  window.storyWeaver = {
    invoke: invokeTyped,
    onProgress: (listener) => {
      progressListener = listener;
      return () => {
        progressListener = null;
      };
    },
  };

  return {
    invoke,
    emitProgress(payload: unknown) {
      progressListener?.(payload);
    },
  };
}

async function openView(name: '作品' | '设置') {
  fireEvent.click(await screen.findByRole('button', { name }));
}

async function openNewBookView() {
  if (!screen.queryByRole('button', { name: '新建作品' })) {
    await openView('作品');
  }

  fireEvent.click(await screen.findByRole('button', { name: '新建作品' }));
}

async function openSettingsView() {
  await openView('设置');
}

async function selectBook(title: string) {
  fireEvent.click(await screen.findByRole('button', { name: title }));
}

async function selectProvider(value: string) {
  fireEvent.change(screen.getByLabelText('Provider'), {
    target: { value },
  });
}

describe('App shell', () => {
  it('keeps primary navigation in the sidebar and opens new books from the library page', async () => {
    installIpcMock(async (channel) => {
      switch (channel) {
        case 'book:list':
          return [];
        case 'model:list':
          return [];
        default:
          return null;
      }
    });

    render(<App />);

    expect(await screen.findByText('暂无作品')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '作品' })).toHaveAttribute(
      'data-active',
      'true'
    );

    fireEvent.click(screen.getByRole('button', { name: '新建作品' }));
    expect(
      await screen.findByRole('heading', { name: '新建作品' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '作品' })).toHaveAttribute(
      'data-active',
      'true'
    );

    fireEvent.click(screen.getByRole('button', { name: '设置' }));
    expect(await screen.findByRole('heading', { name: '设置' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '作品' }));
    expect(await screen.findByText('暂无作品')).toBeInTheDocument();
  });

  it('renders a safe empty preview when Electron IPC is unavailable', async () => {
    delete window.storyWeaver;

    render(<App />);

    expect(
      await screen.findByRole('group', { name: 'Story Weaver brand' })
    ).toBeInTheDocument();
    expect(screen.getByText('Story Weaver')).toBeInTheDocument();
    expect(screen.getByText('藏书工坊')).toBeInTheDocument();
    expect(await screen.findByAltText('Story Weaver logo')).toHaveAttribute(
      'src',
      expect.stringContaining('story-weaver-logo-white')
    );
    expect(screen.getByRole('button', { name: '作品' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '设置' })).toBeInTheDocument();
    expect(await screen.findByText('暂无作品')).toBeInTheDocument();
    expect(await screen.findByText('全部开始')).toBeDisabled();
  });

  it('opens the new-book workspace from the empty shelf action', async () => {
    installIpcMock(async (channel) => {
      switch (channel) {
        case 'book:list':
          return [];
        case 'model:list':
          return [];
        default:
          return null;
      }
    });

    render(<App />);

    fireEvent.click(
      await screen.findByRole('button', { name: '新建第一本作品' })
    );

    expect(
      await screen.findByRole('heading', { name: '新建作品' })
    ).toBeInTheDocument();
  });

  it('opens directly into the library workspace without the old hero card', async () => {
    delete window.storyWeaver;

    render(<App />);

    expect(
      await screen.findByPlaceholderText('搜索作品、设定或状态')
    ).toBeInTheDocument();
    expect(screen.queryByText('AI Long-Form Fiction Studio')).toBeNull();

    const logos = await screen.findAllByAltText('Story Weaver logo');

    expect(
      screen.getByRole('group', { name: 'Story Weaver brand' })
    ).toBeInTheDocument();
    expect(screen.getByText('Story Weaver')).toBeInTheDocument();
    expect(screen.getByText('藏书工坊')).toBeInTheDocument();
    expect(screen.queryByText('AI 长篇写作工作台')).toBeNull();
    expect(screen.queryByText('Novel Archive')).toBeNull();
    expect(logos).toHaveLength(1);
    expect(logos[0]).toHaveAttribute(
      'src',
      expect.stringContaining('story-weaver-logo-white')
    );
  });

  it('opens the selected book in the dedicated detail view', async () => {
    const books = [
      {
        id: 'book-1',
        title: 'First Book',
        idea: 'First idea',
        status: 'writing',
        targetWords: 500000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'book-2',
        title: 'Second Book',
        idea: 'Second idea',
        status: 'paused',
        targetWords: 500000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    installIpcMock(async (channel, payload) => {
      switch (channel) {
        case 'book:list':
          return copy(books);
        case 'model:list':
          return [];
        case 'book:detail': {
          const { bookId } = payload as { bookId: string };
          const book = books.find((item) => item.id === bookId) ?? books[0];

          return {
            book,
            context: null,
            latestScene: null,
            characterStates: [],
            plotThreads: [],
            chapters: [],
            progress: {
              phase: book.status,
            },
          };
        }
        default:
          return null;
      }
    });

    render(<App />);

    expect(
      await screen.findByRole('button', { name: 'First Book' })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Second Book' }));

    expect(
      await screen.findByRole('heading', { name: 'Second Book' })
    ).toBeInTheDocument();
  });

  it('opens a dedicated detail view for the selected book and returns to the library through the sidebar', async () => {
    const books = [
      {
        id: 'book-1',
        title: 'First Book',
        idea: 'First idea',
        status: 'writing',
        targetWords: 500000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'book-2',
        title: 'Second Book',
        idea: 'Second idea',
        status: 'paused',
        targetWords: 500000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    installIpcMock(async (channel, payload) => {
      switch (channel) {
        case 'book:list':
          return copy(books);
        case 'model:list':
          return [];
        case 'book:detail': {
          const { bookId } = payload as { bookId: string };
          const book = books.find((item) => item.id === bookId) ?? books[0];

          return {
            book,
            context: null,
            latestScene: null,
            characterStates: [],
            plotThreads: [],
            chapters: [],
            progress: {
              phase: book.status,
            },
          };
        }
        default:
          return null;
      }
    });

    render(<App />);

    expect(
      await screen.findByRole('button', { name: 'Second Book' })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Second Book' }));

    expect(
      await screen.findByRole('heading', { name: 'Second Book' })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '作品' }));

    expect(
      await screen.findByRole('button', { name: 'Second Book' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Second Book' })).toBeNull();
  });

  it('loads books from IPC and refreshes the library after creating one', async () => {
    const books = [
      {
        id: 'book-1',
        title: 'Existing Book',
        idea: 'An old archive wakes up.',
        status: 'creating',
        targetWords: 500000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    const models = [
      {
        id: 'openai:gpt-4o-mini',
        provider: 'openai',
        modelName: 'gpt-4o-mini',
        apiKey: 'sk-test',
        baseUrl: '',
        config: {},
      },
    ];

    const { invoke } = installIpcMock(async (channel, payload) => {
      switch (channel) {
        case 'book:list':
          return copy(books);
        case 'model:list':
          return copy(models);
        case 'book:create': {
          const input = payload as {
            idea: string;
            targetWords: number;
          };

          books.push({
            id: 'book-2',
            title: input.idea,
            idea: input.idea,
            status: 'creating',
            targetWords: input.targetWords,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          return 'book-2';
        }
        case 'book:start':
          return undefined;
        default:
          return null;
      }
    });

    render(<App />);

    expect(
      await screen.findByRole('button', { name: 'Existing Book' })
    ).toBeInTheDocument();

    await openNewBookView();

    fireEvent.change(screen.getByLabelText('故事设想'), {
      target: { value: 'A map eats its explorers.' },
    });
    fireEvent.click(screen.getByText('开始写作'));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('book:create', {
        idea: 'A map eats its explorers.',
        targetWords: 500000,
      });
      expect(invoke).toHaveBeenCalledWith('book:start', {
        bookId: 'book-2',
      });
    });

    expect(
      await screen.findByRole('button', {
        name: 'A map eats its explorers.',
      })
    ).toBeInTheDocument();
  });

  it('returns to 作品 and selects the newly created book', async () => {
    const books: Array<{
      id: string;
      title: string;
      idea: string;
      status: string;
      targetWords: number;
      createdAt: string;
      updatedAt: string;
    }> = [];

    const { invoke } = installIpcMock(async (channel, payload) => {
      switch (channel) {
        case 'book:list':
          return copy(books);
        case 'model:list':
          return [];
        case 'book:create': {
          const input = payload as {
            idea: string;
            targetWords: number;
          };

          books.push({
            id: 'book-9',
            title: input.idea,
            idea: input.idea,
            status: 'creating',
            targetWords: input.targetWords,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          return 'book-9';
        }
        case 'book:start':
          return undefined;
        case 'book:detail':
          return {
            book: books[0],
            context: null,
            latestScene: null,
            characterStates: [],
            plotThreads: [],
            chapters: [],
            progress: {
              phase: books[0]?.status ?? 'creating',
            },
          };
        default:
          return null;
      }
    });

    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: '新建作品' }));
    fireEvent.change(screen.getByLabelText('故事设想'), {
      target: { value: 'A lighthouse writes back.' },
    });
    fireEvent.click(screen.getByRole('button', { name: '开始写作' }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('book:create', {
        idea: 'A lighthouse writes back.',
        targetWords: 500000,
      });
      expect(invoke).toHaveBeenCalledWith('book:start', {
        bookId: 'book-9',
      });
      expect(invoke).toHaveBeenCalledWith('book:detail', {
        bookId: 'book-9',
      });
    });

    expect(await screen.findByRole('button', { name: '作品' })).toHaveAttribute(
      'data-active',
      'true'
    );
    expect(
      await screen.findByRole('button', { name: 'A lighthouse writes back.' })
    ).toBeInTheDocument();
  });

  it('updates the library summary from scheduler progress events', async () => {
    const { emitProgress } = installIpcMock(async (channel) => {
      switch (channel) {
        case 'book:list':
          return [];
        case 'model:list':
          return [];
        default:
          return null;
      }
    });

    render(<App />);

    emitProgress({
      runningBookIds: ['book-1'],
      queuedBookIds: ['book-2'],
      pausedBookIds: ['book-3'],
      concurrencyLimit: 1,
    });

    expect(await screen.findByText('完成')).toBeInTheDocument();
    expect(await screen.findByText('0/50')).toBeInTheDocument();
    expect(await screen.findByText('写作中')).toBeInTheDocument();
    expect(await screen.findByText('排队')).toBeInTheDocument();
    expect(await screen.findByText('已暂停')).toBeInTheDocument();
    expect(screen.getAllByText('1')).toHaveLength(3);
  });

  it('renders chapter completion progress in the library list', async () => {
    const books = [
      {
        id: 'book-1',
        title: 'Existing Book',
        idea: 'An old archive wakes up.',
        status: 'writing',
        targetWords: 500000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    installIpcMock(async (channel, payload) => {
      switch (channel) {
        case 'book:list':
          return copy(books);
        case 'model:list':
          return [];
        case 'book:detail':
          return {
            book: books[0],
            context: null,
            latestScene: null,
            characterStates: [],
            plotThreads: [],
            chapters: [
              {
                bookId: 'book-1',
                volumeIndex: 1,
                chapterIndex: 1,
                title: 'Chapter 1',
                outline: 'Opening conflict',
                content: 'Generated chapter content',
                summary: 'Summary 1',
                wordCount: 1200,
              },
              {
                bookId: 'book-1',
                volumeIndex: 1,
                chapterIndex: 2,
                title: 'Chapter 2',
                outline: 'Escalation',
                content: null,
                summary: null,
                wordCount: 0,
              },
            ],
            progress: {
              phase: 'writing',
            },
          };
        default:
          return null;
      }
    });

    render(<App />);

    const progressBar = await screen.findByRole('progressbar', {
      name: '章节进度',
    });

    expect(progressBar).toHaveAttribute('aria-valuenow', '50');
    expect(await screen.findByText('1 / 2 章')).toBeInTheDocument();
  });

  it('starts all runnable books from the library', async () => {
    const books = [
      {
        id: 'book-1',
        title: 'Existing Book',
        idea: 'An old archive wakes up.',
        status: 'building_outline',
        modelId: 'openai:gpt-4o-mini',
        targetWords: 500000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    const models = [
      {
        id: 'openai:gpt-4o-mini',
        provider: 'openai',
        modelName: 'gpt-4o-mini',
        apiKey: 'sk-test',
        baseUrl: '',
        config: {},
      },
    ];

    const { invoke } = installIpcMock(async (channel) => {
      switch (channel) {
        case 'book:list':
          return copy(books);
        case 'model:list':
          return copy(models);
        case 'scheduler:startAll':
          books[0] = { ...books[0], status: 'completed' };
          return undefined;
        default:
          return null;
      }
    });

    render(<App />);

    const startAllButton = await screen.findByRole('button', { name: '全部开始' });

    await waitFor(() => {
      expect(startAllButton).toBeEnabled();
    });

    fireEvent.click(startAllButton);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('scheduler:startAll', undefined);
    });

    expect(await screen.findByText('已完成')).toBeInTheDocument();
  });

  it('pauses all books from the library', async () => {
    const books = [
      {
        id: 'book-1',
        title: 'Existing Book',
        idea: 'An old archive wakes up.',
        status: 'writing',
        modelId: 'openai:gpt-4o-mini',
        targetWords: 500000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    const models = [
      {
        id: 'openai:gpt-4o-mini',
        provider: 'openai',
        modelName: 'gpt-4o-mini',
        apiKey: 'sk-test',
        baseUrl: '',
        config: {},
      },
    ];

    const { invoke } = installIpcMock(async (channel) => {
      switch (channel) {
        case 'book:list':
          return copy(books);
        case 'model:list':
          return copy(models);
        case 'scheduler:pauseAll':
          books[0] = { ...books[0], status: 'paused' };
          return undefined;
        default:
          return null;
      }
    });

    render(<App />);

    const pauseAllButton = await screen.findByRole('button', { name: '全部暂停' });

    await waitFor(() => {
      expect(pauseAllButton).toBeEnabled();
    });

    fireEvent.click(pauseAllButton);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('scheduler:pauseAll', undefined);
    });

    expect(await screen.findByRole('button', { name: '作品' })).toHaveAttribute(
      'data-active',
      'true'
    );
  });

  it('loads book detail and pauses the selected book', async () => {
    const books = [
      {
        id: 'book-1',
        title: 'Existing Book',
        idea: 'An old archive wakes up.',
        status: 'building_outline',
        modelId: 'openai:gpt-4o-mini',
        targetWords: 500000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    const models = [
      {
        id: 'openai:gpt-4o-mini',
        provider: 'openai',
        modelName: 'gpt-4o-mini',
        apiKey: 'sk-test',
        baseUrl: '',
        config: {},
      },
    ];
    const detail: {
      book: (typeof books)[number];
      context: {
        worldSetting: string;
        outline: string;
        styleGuide: null;
      };
      plotThreads: Array<{
        id: string;
        description: string;
        plantedAt: number;
        expectedPayoff: number | null;
        resolvedAt: number | null;
        importance: string;
      }>;
      latestScene: {
        location: string;
        timeInStory: string;
        charactersPresent: string[];
        events: string | null;
      } | null;
      characterStates: Array<{
        characterId: string;
        characterName: string;
        location: string | null;
        status: string | null;
        knowledge: string | null;
        emotion: string | null;
        powerLevel: string | null;
        chapterIndex: number;
        volumeIndex: number;
      }>;
      chapters: Array<{
        bookId: string;
        volumeIndex: number;
        chapterIndex: number;
        title: string;
        outline: string;
        content: string | null;
        summary: string | null;
        wordCount: number;
      }>;
      progress: {
        bookId: string;
        currentVolume: null;
        currentChapter: null;
        phase: string;
        retryCount: number;
        errorMsg: null;
      };
    } = {
      book: books[0],
      context: {
        worldSetting: 'World rules',
        outline: 'Master outline',
        styleGuide: null,
      },
      latestScene: null,
      characterStates: [
        {
          characterId: 'protagonist',
          characterName: 'Lin Mo',
          location: 'Rain Market',
          status: 'Investigating the debt ledger',
          knowledge: 'Knows the ledger is forged',
          emotion: 'Suspicious',
          powerLevel: 'Awakened',
          chapterIndex: 1,
          volumeIndex: 1,
        },
      ],
      plotThreads: [],
      chapters: [
        {
          bookId: 'book-1',
          volumeIndex: 1,
          chapterIndex: 1,
          title: 'Chapter 1',
          outline: 'Opening conflict',
          content: null,
          summary: null,
          wordCount: 0,
        },
      ],
      progress: {
        bookId: 'book-1',
        currentVolume: null,
        currentChapter: null,
        phase: 'building_outline',
        retryCount: 0,
        errorMsg: null,
      },
    };

    const { invoke } = installIpcMock(async (channel, payload) => {
      switch (channel) {
        case 'book:list':
          return copy(books);
        case 'model:list':
          return copy(models);
        case 'book:detail':
          return copy(detail);
        case 'book:pause':
          books[0] = { ...books[0], status: 'paused' };
          detail.book = books[0];
          detail.progress = { ...detail.progress, phase: 'paused' };
          return undefined;
        default:
          return null;
      }
    });

    render(<App />);

    await selectBook('Existing Book');
    expect(
      await screen.findByRole('heading', { name: 'Existing Book' })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '大纲' }));
    expect(await screen.findByText('World rules')).toBeInTheDocument();

    fireEvent.click(screen.getByText('暂停'));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('book:pause', {
        bookId: 'book-1',
      });
    });

    expect(await screen.findByText('已暂停 · 0 字')).toBeInTheDocument();
  });

  it('exports the selected book as txt from book detail', async () => {
    const books = [
      {
        id: 'book-1',
        title: 'Existing Book',
        idea: 'An old archive wakes up.',
        status: 'completed',
        modelId: 'openai:gpt-4o-mini',
        targetWords: 500000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    const models = [
      {
        id: 'openai:gpt-4o-mini',
        provider: 'openai',
        modelName: 'gpt-4o-mini',
        apiKey: 'sk-test',
        baseUrl: '',
        config: {},
      },
    ];
    const detail = {
      book: books[0],
      context: {
        worldSetting: 'World rules',
        outline: 'Master outline',
        styleGuide: null,
      },
      latestScene: null,
      characterStates: [],
      plotThreads: [],
      chapters: [
        {
          bookId: 'book-1',
          volumeIndex: 1,
          chapterIndex: 1,
          title: 'Chapter 1',
          outline: 'Opening conflict',
          content: 'Generated chapter content',
          summary: 'Chapter summary',
          wordCount: 1200,
        },
      ],
      progress: {
        bookId: 'book-1',
        currentVolume: 1,
        currentChapter: 1,
        phase: 'completed',
        retryCount: 0,
        errorMsg: null,
      },
    };

    const { invoke } = installIpcMock(async (channel) => {
      switch (channel) {
        case 'book:list':
          return copy(books);
        case 'model:list':
          return copy(models);
        case 'book:detail':
          return copy(detail);
        case 'book:export':
          return '/tmp/story-weaver/exports/Existing Book.txt';
        default:
          return null;
      }
    });

    render(<App />);

    await selectBook('Existing Book');
    fireEvent.click(await screen.findByText('导出 TXT'));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('book:export', {
        bookId: 'book-1',
        format: 'txt',
      });
    });

    expect(
      await screen.findByText(
        '导出完成：/tmp/story-weaver/exports/Existing Book.txt'
      )
    ).toBeInTheDocument();
  });

  it('deletes the selected writing book from book detail', async () => {
    const books = [
      {
        id: 'book-1',
        title: 'Existing Book',
        idea: 'An old archive wakes up.',
        status: 'writing',
        modelId: 'openai:gpt-4o-mini',
        targetWords: 500000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    const models = [
      {
        id: 'openai:gpt-4o-mini',
        provider: 'openai',
        modelName: 'gpt-4o-mini',
        apiKey: 'sk-test',
        baseUrl: '',
        config: {},
      },
    ];
    const detail = {
      book: books[0],
      context: {
        worldSetting: 'World rules',
        outline: 'Master outline',
        styleGuide: null,
      },
      latestScene: null,
      characterStates: [],
      plotThreads: [],
      chapters: [],
      progress: {
        bookId: 'book-1',
        currentVolume: null,
        currentChapter: null,
        phase: 'writing',
        retryCount: 0,
        errorMsg: null,
      },
    };

    const { invoke } = installIpcMock(async (channel) => {
      switch (channel) {
        case 'book:list':
          return copy(books);
        case 'model:list':
          return copy(models);
        case 'book:detail':
          return copy(detail);
        case 'book:delete':
          books.splice(0, books.length);
          return undefined;
        default:
          return null;
      }
    });

    render(<App />);

    await selectBook('Existing Book');
    fireEvent.click(await screen.findByText('删除作品'));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('book:delete', {
        bookId: 'book-1',
      });
    });

    expect(await screen.findByText('作品已删除')).toBeInTheDocument();
    expect(screen.queryByText('Existing Book')).not.toBeInTheDocument();
    expect(screen.queryByText('World rules')).not.toBeInTheDocument();
  });

  it('resumes a paused book from book detail', async () => {
    const books = [
      {
        id: 'book-1',
        title: 'Existing Book',
        idea: 'An old archive wakes up.',
        status: 'paused',
        modelId: 'openai:gpt-4o-mini',
        targetWords: 500000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    const models = [
      {
        id: 'openai:gpt-4o-mini',
        provider: 'openai',
        modelName: 'gpt-4o-mini',
        apiKey: 'sk-test',
        baseUrl: '',
        config: {},
      },
    ];
    const detail: {
      book: (typeof books)[number];
      context: {
        worldSetting: string;
        outline: string;
        styleGuide: null;
      };
      latestScene: {
        location: string;
        timeInStory: string;
        charactersPresent: string[];
        events: string | null;
      } | null;
      characterStates: Array<{
        characterId: string;
        characterName: string;
        location: string | null;
        status: string | null;
        knowledge: string | null;
        emotion: string | null;
        powerLevel: string | null;
        chapterIndex: number;
        volumeIndex: number;
      }>;
      plotThreads: Array<{
        id: string;
        description: string;
        plantedAt: number;
        expectedPayoff: number | null;
        resolvedAt: number | null;
        importance: string;
      }>;
      chapters: Array<{
        bookId: string;
        volumeIndex: number;
        chapterIndex: number;
        title: string;
        outline: string;
        content: string | null;
        summary: string | null;
        wordCount: number;
      }>;
      progress: {
        bookId: string;
        currentVolume: null;
        currentChapter: null;
        phase: string;
        retryCount: number;
        errorMsg: null;
      };
    } = {
      book: books[0],
      context: {
        worldSetting: 'World rules',
        outline: 'Master outline',
        styleGuide: null,
      },
      latestScene: null,
      characterStates: [],
      plotThreads: [],
      chapters: [
        {
          bookId: 'book-1',
          volumeIndex: 1,
          chapterIndex: 1,
          title: 'Chapter 1',
          outline: 'Opening conflict',
          content: null,
          summary: null,
          wordCount: 0,
        },
      ],
      progress: {
        bookId: 'book-1',
        currentVolume: null,
        currentChapter: null,
        phase: 'paused',
        retryCount: 0,
        errorMsg: null,
      },
    };

    const { invoke } = installIpcMock(async (channel, payload) => {
      switch (channel) {
        case 'book:list':
          return copy(books);
        case 'model:list':
          return copy(models);
        case 'book:detail':
          return copy(detail);
        case 'book:resume':
          books[0] = { ...books[0], status: 'completed' };
          detail.book = books[0];
          detail.progress = { ...detail.progress, phase: 'completed' };
          detail.chapters[0] = {
            ...detail.chapters[0],
            content: 'Resumed content',
            summary: 'Resumed summary',
            wordCount: 1300,
          };
          return undefined;
        default:
          return null;
      }
    });

    render(<App />);

    await selectBook('Existing Book');
    fireEvent.click(await screen.findByText('恢复写作'));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('book:resume', {
        bookId: 'book-1',
      });
    });

    expect(await screen.findByText('已完成 · 1300 字')).toBeInTheDocument();
  });

  it('restarts a book from book detail', async () => {
    const books = [
      {
        id: 'book-1',
        title: 'Existing Book',
        idea: 'An old archive wakes up.',
        status: 'completed',
        modelId: 'openai:gpt-4o-mini',
        targetWords: 500000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    const models = [
      {
        id: 'openai:gpt-4o-mini',
        provider: 'openai',
        modelName: 'gpt-4o-mini',
        apiKey: 'sk-test',
        baseUrl: '',
        config: {},
      },
    ];
    const detail = {
      book: books[0],
      context: {
        worldSetting: 'World rules',
        outline: 'Master outline',
        styleGuide: null,
      },
      latestScene: {
        location: 'Archive Gate',
        timeInStory: 'Dawn',
        charactersPresent: ['Lin Mo'],
        events: 'Old scene',
      },
      characterStates: [
        {
          characterId: 'protagonist',
          characterName: 'Lin Mo',
          location: 'Archive Gate',
          status: 'Old state',
          knowledge: 'Old knowledge',
          emotion: 'Alert',
          powerLevel: 'Awakened',
          chapterIndex: 1,
          volumeIndex: 1,
        },
      ],
      plotThreads: [
        {
          id: 'thread-1',
          description: 'Old thread',
          plantedAt: 1,
          expectedPayoff: 4,
          resolvedAt: null,
          importance: 'normal',
        },
      ],
      chapters: [
        {
          bookId: 'book-1',
          volumeIndex: 1,
          chapterIndex: 1,
          title: 'Chapter 1',
          outline: 'Opening conflict',
          content: 'Old content',
          summary: 'Old summary',
          wordCount: 1000,
        },
      ],
      progress: {
        bookId: 'book-1',
        currentVolume: null,
        currentChapter: null,
        phase: 'completed',
        retryCount: 0,
        errorMsg: null,
      },
    };

    const { invoke } = installIpcMock(async (channel) => {
      switch (channel) {
        case 'book:list':
          return copy(books);
        case 'model:list':
          return copy(models);
        case 'book:detail':
          return copy(detail);
        case 'book:restart':
          books[0] = { ...books[0], status: 'completed' };
          detail.book = books[0];
          detail.progress = { ...detail.progress, phase: 'completed' };
          detail.latestScene = {
            location: 'Debt Court',
            timeInStory: 'Noon',
            charactersPresent: ['Lin Mo'],
            events: 'Restarted scene',
          };
          detail.characterStates = [
            {
              characterId: 'protagonist',
              characterName: 'Lin Mo',
              location: 'Debt Court',
              status: 'Restarted state',
              knowledge: 'Restarted knowledge',
              emotion: 'Focused',
              powerLevel: 'Awakened',
              chapterIndex: 1,
              volumeIndex: 1,
            },
          ];
          detail.plotThreads = [];
          detail.chapters[0] = {
            ...detail.chapters[0],
            content: 'Restarted content',
            summary: 'Restarted summary',
            wordCount: 1250,
          };
          return undefined;
        default:
          return null;
      }
    });

    render(<App />);

    await selectBook('Existing Book');
    fireEvent.click(await screen.findByText('重新开始'));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('book:restart', {
        bookId: 'book-1',
      });
    });

    fireEvent.click(await screen.findByText('章节'));
    expect(await screen.findByText('Restarted content')).toBeInTheDocument();
    fireEvent.click(screen.getByText('人物'));
    expect((await screen.findAllByText(/Debt Court/)).length).toBeGreaterThan(0);
  });

  it('writes the next chapter from book detail and shows the generated content', async () => {
    const books = [
      {
        id: 'book-1',
        title: 'Existing Book',
        idea: 'An old archive wakes up.',
        status: 'building_outline',
        modelId: 'openai:gpt-4o-mini',
        targetWords: 500000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    const models = [
      {
        id: 'openai:gpt-4o-mini',
        provider: 'openai',
        modelName: 'gpt-4o-mini',
        apiKey: 'sk-test',
        baseUrl: '',
        config: {},
      },
    ];
    const detail: {
      book: (typeof books)[number];
      context: {
        worldSetting: string;
        outline: string;
        styleGuide: null;
      };
      plotThreads: Array<{
        id: string;
        description: string;
        plantedAt: number;
        expectedPayoff: number | null;
        resolvedAt: number | null;
        importance: string;
      }>;
      latestScene: {
        location: string;
        timeInStory: string;
        charactersPresent: string[];
        events: string | null;
      } | null;
      characterStates: Array<{
        characterId: string;
        characterName: string;
        location: string | null;
        status: string | null;
        knowledge: string | null;
        emotion: string | null;
        powerLevel: string | null;
        chapterIndex: number;
        volumeIndex: number;
      }>;
      chapters: Array<{
        bookId: string;
        volumeIndex: number;
        chapterIndex: number;
        title: string;
        outline: string;
        content: string | null;
        summary: string | null;
        wordCount: number;
      }>;
      progress: {
        bookId: string;
        currentVolume: null;
        currentChapter: null;
        phase: string;
        retryCount: number;
        errorMsg: null;
      };
    } = {
      book: books[0],
      context: {
        worldSetting: 'World rules',
        outline: 'Master outline',
        styleGuide: null,
      },
      latestScene: null,
      characterStates: [],
      plotThreads: [],
      chapters: [
        {
          bookId: 'book-1',
          volumeIndex: 1,
          chapterIndex: 1,
          title: 'Chapter 1',
          outline: 'Opening conflict',
          content: null,
          summary: null,
          wordCount: 0,
        },
      ],
      progress: {
        bookId: 'book-1',
        currentVolume: null,
        currentChapter: null,
        phase: 'building_outline',
        retryCount: 0,
        errorMsg: null,
      },
    };

    const { invoke } = installIpcMock(async (channel) => {
      switch (channel) {
        case 'book:list':
          return copy(books);
        case 'model:list':
          return copy(models);
        case 'book:detail':
          return copy(detail);
        case 'book:writeNext':
          books[0] = { ...books[0], status: 'writing' };
          detail.book = books[0];
          detail.progress = { ...detail.progress, phase: 'writing' };
          detail.latestScene = {
            location: 'Rain Market',
            timeInStory: 'Night',
            charactersPresent: ['Lin Mo'],
            events: 'Lin Mo discovers the forged ledger',
          };
          detail.characterStates = [
            {
              characterId: 'protagonist',
              characterName: 'Lin Mo',
              location: 'Rain Market',
              status: 'Investigating the debt ledger',
              knowledge: 'Knows the ledger is forged',
              emotion: 'Suspicious',
              powerLevel: 'Awakened',
              chapterIndex: 1,
              volumeIndex: 1,
            },
          ];
          detail.plotThreads = [
            {
              id: 'thread-1',
              description: 'A hidden debt resurfaces later',
              plantedAt: 1,
              expectedPayoff: 6,
              resolvedAt: null,
              importance: 'critical',
            },
          ];
          detail.chapters[0] = {
            ...detail.chapters[0],
            content: 'Generated chapter content',
            summary: 'Generated chapter summary',
            wordCount: 1200,
          };
          return copy(detail.chapters[0]);
        default:
          return null;
      }
    });

    render(<App />);

    await selectBook('Existing Book');
    fireEvent.click(await screen.findByText('写下一章'));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('book:writeNext', {
        bookId: 'book-1',
      });
    });

    fireEvent.click(await screen.findByText('章节'));
    expect(await screen.findByText('Generated chapter content')).toBeInTheDocument();
    expect(await screen.findByText('Generated chapter summary')).toBeInTheDocument();
    fireEvent.click(screen.getByText('伏笔'));
    expect(
      await screen.findByText(/A hidden debt resurfaces later/)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText('人物'));
    expect((await screen.findAllByText(/Lin Mo/)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/Rain Market/)).length).toBeGreaterThan(0);
  });

  it('writes all remaining chapters from book detail', async () => {
    const books = [
      {
        id: 'book-1',
        title: 'Existing Book',
        idea: 'An old archive wakes up.',
        status: 'building_outline',
        modelId: 'openai:gpt-4o-mini',
        targetWords: 500000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    const models = [
      {
        id: 'openai:gpt-4o-mini',
        provider: 'openai',
        modelName: 'gpt-4o-mini',
        apiKey: 'sk-test',
        baseUrl: '',
        config: {},
      },
    ];
    const detail: {
      book: (typeof books)[number];
      context: {
        worldSetting: string;
        outline: string;
        styleGuide: null;
      };
      plotThreads: Array<{
        id: string;
        description: string;
        plantedAt: number;
        expectedPayoff: number | null;
        resolvedAt: number | null;
        importance: string;
      }>;
      characterStates: Array<{
        characterId: string;
        characterName: string;
        location: string | null;
        status: string | null;
        knowledge: string | null;
        emotion: string | null;
        powerLevel: string | null;
        chapterIndex: number;
        volumeIndex: number;
      }>;
      latestScene: {
        location: string;
        timeInStory: string;
        charactersPresent: string[];
        events: string | null;
      } | null;
      chapters: Array<{
        bookId: string;
        volumeIndex: number;
        chapterIndex: number;
        title: string;
        outline: string;
        content: string | null;
        summary: string | null;
        wordCount: number;
      }>;
      progress: {
        bookId: string;
        currentVolume: null;
        currentChapter: null;
        phase: string;
        retryCount: number;
        errorMsg: null;
      };
    } = {
      book: books[0],
      context: {
        worldSetting: 'World rules',
        outline: 'Master outline',
        styleGuide: null,
      },
      latestScene: null,
      characterStates: [],
      plotThreads: [],
      chapters: [
        {
          bookId: 'book-1',
          volumeIndex: 1,
          chapterIndex: 1,
          title: 'Chapter 1',
          outline: 'Opening conflict',
          content: null,
          summary: null,
          wordCount: 0,
        },
        {
          bookId: 'book-1',
          volumeIndex: 1,
          chapterIndex: 2,
          title: 'Chapter 2',
          outline: 'Escalation',
          content: null,
          summary: null,
          wordCount: 0,
        },
      ],
      progress: {
        bookId: 'book-1',
        currentVolume: null,
        currentChapter: null,
        phase: 'building_outline',
        retryCount: 0,
        errorMsg: null,
      },
    };

    const { invoke } = installIpcMock(async (channel) => {
      switch (channel) {
        case 'book:list':
          return copy(books);
        case 'model:list':
          return copy(models);
        case 'book:detail':
          return copy(detail);
        case 'book:writeAll':
          books[0] = { ...books[0], status: 'completed' };
          detail.book = books[0];
          detail.progress = { ...detail.progress, phase: 'completed' };
          detail.latestScene = {
            location: 'Debt Court',
            timeInStory: 'Noon',
            charactersPresent: ['Lin Mo'],
            events: 'Lin Mo confronts the magistrate',
          };
          detail.characterStates = [
            {
              characterId: 'protagonist',
              characterName: 'Lin Mo',
              location: 'Debt Court',
              status: 'Confronts the magistrate',
              knowledge: 'Understands the larger scheme',
              emotion: 'Furious',
              powerLevel: 'Awakened',
              chapterIndex: 2,
              volumeIndex: 1,
            },
          ];
          detail.plotThreads = [
            {
              id: 'thread-1',
              description: 'Debt clue',
              plantedAt: 1,
              expectedPayoff: 3,
              resolvedAt: 2,
              importance: 'normal',
            },
          ];
          detail.chapters[0] = {
            ...detail.chapters[0],
            content: 'Generated chapter 1',
            summary: 'Summary 1',
            wordCount: 1000,
          };
          detail.chapters[1] = {
            ...detail.chapters[1],
            content: 'Generated chapter 2',
            summary: 'Summary 2',
            wordCount: 1100,
          };
          return { completedChapters: 2 };
        default:
          return null;
      }
    });

    render(<App />);

    await selectBook('Existing Book');
    fireEvent.click(await screen.findByText('连续写作'));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('book:writeAll', {
        bookId: 'book-1',
      });
    });

    fireEvent.click(await screen.findByText('章节'));
    expect(await screen.findByText('Generated chapter 1')).toBeInTheDocument();
    expect(await screen.findByText('已完成 · 2100 字')).toBeInTheDocument();
    fireEvent.click(screen.getByText('伏笔'));
    expect(await screen.findByText(/Debt clue/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('人物'));
    expect((await screen.findAllByText(/Debt Court/)).length).toBeGreaterThan(0);
  });

  it('loads the saved model config from IPC into the single model form', async () => {
    installIpcMock(async (channel) => {
      switch (channel) {
        case 'book:list':
          return [];
        case 'model:list':
          return copy([
            {
              id: 'anthropic:claude-3-5-sonnet',
              provider: 'anthropic',
              modelName: 'claude-3-5-sonnet',
              apiKey: 'sk-test',
              baseUrl: '',
              config: {},
            },
          ]);
        default:
          return null;
      }
    });

    render(<App />);

    await openSettingsView();

    expect(screen.getByRole('combobox', { name: 'Provider' })).toHaveTextContent(
      'anthropic'
    );
    expect(screen.getByLabelText('Model Name')).toHaveValue('claude-3-5-sonnet');
    expect(screen.getByLabelText('API Key')).toHaveValue('sk-test');
    expect(screen.getByLabelText('Base URL')).toHaveValue('');
    expect(screen.queryByText('已保存模型')).toBeNull();
  });

  it('saves a model config from settings and refreshes the single model form', async () => {
    const models: Array<{
      id: string;
      provider: string;
      modelName: string;
      apiKey: string;
      baseUrl: string;
      config: Record<string, unknown>;
    }> = [];

    const { invoke } = installIpcMock(async (channel, payload) => {
      switch (channel) {
        case 'book:list':
          return [];
        case 'model:list':
          return copy(models);
        case 'model:save': {
          const config = payload as (typeof models)[number];
          models.splice(0, models.length, config);
          return config;
        }
        default:
          return null;
      }
    });

    render(<App />);

    await openSettingsView();

    await selectProvider('anthropic');
    fireEvent.change(screen.getByLabelText('Model Name'), {
      target: { value: 'claude-3-5-sonnet' },
    });
    fireEvent.change(screen.getByLabelText('API Key'), {
      target: { value: 'sk-test' },
    });
    fireEvent.click(screen.getByText('保存模型'));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('model:save', {
        id: 'anthropic:claude-3-5-sonnet',
        provider: 'anthropic',
        modelName: 'claude-3-5-sonnet',
        apiKey: 'sk-test',
        baseUrl: '',
        config: {},
      });
    });

    expect(screen.getByLabelText('Model Name')).toHaveValue(
      'claude-3-5-sonnet'
    );
  });

  it('loads a saved model into the settings form for editing', async () => {
    const models: Array<{
      id: string;
      provider: string;
      modelName: string;
      apiKey: string;
      baseUrl: string;
      config: Record<string, unknown>;
    }> = [
      {
        id: 'anthropic:claude-3-5-sonnet',
        provider: 'anthropic',
        modelName: 'claude-3-5-sonnet',
        apiKey: 'sk-old',
        baseUrl: '',
        config: {},
      },
    ];

    const { invoke } = installIpcMock(async (channel, payload) => {
      switch (channel) {
        case 'book:list':
          return [];
        case 'model:list':
          return copy(models);
        case 'model:save':
          return payload ?? null;
        default:
          return null;
      }
    });

    render(<App />);

    await openSettingsView();

    expect(screen.getByRole('combobox', { name: 'Provider' })).toHaveTextContent(
      'anthropic'
    );
    expect(screen.getByLabelText('Model Name')).toHaveValue('claude-3-5-sonnet');
    expect(screen.getByLabelText('API Key')).toHaveValue('sk-old');
    expect(screen.getByLabelText('Base URL')).toHaveValue('');

    fireEvent.change(screen.getByLabelText('API Key'), {
      target: { value: 'sk-new' },
    });
    fireEvent.click(screen.getByText('保存模型'));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('model:save', {
        id: 'anthropic:claude-3-5-sonnet',
        provider: 'anthropic',
        modelName: 'claude-3-5-sonnet',
        apiKey: 'sk-new',
        baseUrl: '',
        config: {},
      });
    });
  });

  it('still creates a book when a saved supported model exists', async () => {
    const models: Array<{
      id: string;
      provider: string;
      modelName: string;
      apiKey: string;
      baseUrl: string;
      config: Record<string, unknown>;
    }> = [
      {
        id: 'anthropic:claude-3-5-sonnet',
        provider: 'anthropic',
        modelName: 'claude-3-5-sonnet',
        apiKey: 'sk-test',
        baseUrl: '',
        config: {},
      },
    ];

    const { invoke } = installIpcMock(async (channel, payload) => {
      switch (channel) {
        case 'book:list':
          return [];
        case 'model:list':
          return copy(models);
        case 'book:create':
          return 'book-1';
        case 'book:start':
          return undefined;
        default:
          return null;
      }
    });

    render(<App />);

    await openSettingsView();

    expect(screen.getByLabelText('Model Name')).toHaveValue(
      'claude-3-5-sonnet'
    );

    await openNewBookView();

    fireEvent.change(screen.getByLabelText('故事设想'), {
      target: { value: 'A map eats its explorers.' },
    });
    fireEvent.click(screen.getByText('开始写作'));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('book:create', {
        idea: 'A map eats its explorers.',
        targetWords: 500000,
      });
    });
  });

  it('saves the scheduler concurrency limit from settings', async () => {
    const { invoke } = installIpcMock(async (channel, payload) => {
      switch (channel) {
        case 'book:list':
          return [];
        case 'model:list':
          return [];
        case 'scheduler:status':
          return {
            runningBookIds: [],
            queuedBookIds: [],
            pausedBookIds: [],
            concurrencyLimit: 1,
          };
        case 'settings:set':
          return payload ?? null;
        default:
          return null;
      }
    });

    render(<App />);

    await openSettingsView();

    fireEvent.change(await screen.findByLabelText('并发上限'), {
      target: { value: '2' },
    });
    fireEvent.click(screen.getByText('保存设置'));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('settings:set', {
        key: 'scheduler.concurrencyLimit',
        value: '2',
      });
    });

    expect(await screen.findByText('设置已保存')).toBeInTheDocument();
  });

  it('shows an error banner when starting a newly created book fails', async () => {
    installIpcMock(async (channel, payload) => {
      switch (channel) {
        case 'book:list':
          return [];
        case 'model:list':
          return [
            {
              id: 'openai:gpt-4o-mini',
              provider: 'openai',
              modelName: 'gpt-4o-mini',
              apiKey: 'sk-test',
              baseUrl: '',
              config: {},
            },
          ];
        case 'book:create':
          return 'book-1';
        case 'book:start':
          throw new Error('API key invalid');
        default:
          return null;
      }
    });

    render(<App />);

    await openNewBookView();

    fireEvent.change(screen.getByLabelText('故事设想'), {
      target: { value: 'A map eats its explorers.' },
    });
    fireEvent.click(screen.getByText('开始写作'));

    expect(await screen.findByText('API key invalid')).toBeInTheDocument();
  });

  it('shows a success banner when model testing succeeds', async () => {
    installIpcMock(async (channel, payload) => {
      switch (channel) {
        case 'book:list':
          return [];
        case 'model:list':
          return [];
        case 'model:save':
          return payload ?? null;
        case 'model:test':
          return {
            ok: true,
            latency: 42,
            error: null,
          };
        default:
          return null;
      }
    });

    render(<App />);

    await openSettingsView();

    await selectProvider('openai');
    fireEvent.change(screen.getByLabelText('Model Name'), {
      target: { value: 'gpt-4o-mini' },
    });
    fireEvent.change(screen.getByLabelText('API Key'), {
      target: { value: 'sk-test' },
    });
    fireEvent.click(screen.getByText('测试连接'));

    expect(await screen.findByText('连接成功（42ms）')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('连接成功（42ms）');
  });

  it('shows a progress banner while starting a new book', async () => {
    let resolveStart: (() => void) | null = null;

    installIpcMock(async (channel, payload) => {
      switch (channel) {
        case 'book:list':
          return [];
        case 'model:list':
          return [
            {
              id: 'openai:gpt-4o-mini',
              provider: 'openai',
              modelName: 'gpt-4o-mini',
              apiKey: 'sk-test',
              baseUrl: '',
              config: {},
            },
          ];
        case 'book:create':
          return 'book-1';
        case 'book:start':
          await new Promise<void>((resolve) => {
            resolveStart = resolve;
          });
          return undefined;
        default:
          return null;
      }
    });

    render(<App />);

    await openNewBookView();

    fireEvent.change(screen.getByLabelText('故事设想'), {
      target: { value: 'A map eats its explorers.' },
    });
    fireEvent.click(screen.getByText('开始写作'));

    expect(await screen.findByText('正在生成大纲...')).toBeInTheDocument();

    const startResolver = resolveStart as null | (() => void);
    startResolver?.();
  });
});
