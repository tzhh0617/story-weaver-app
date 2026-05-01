import type {
  BookCreatePayload,
  BookDetail,
  BookExportFormat,
  BookListItem,
  ModelSavePayload,
  SchedulerStatus,
} from '@story-weaver/shared/contracts';

export type StoryWeaverApi = {
  listBooks: () => Promise<BookListItem[]>;
  createBook: (payload: BookCreatePayload) => Promise<string>;
  getBookDetail: (bookId: string) => Promise<BookDetail | null>;
  deleteBook: (bookId: string) => Promise<void>;
  startBook: (bookId: string) => Promise<void>;
  pauseBook: (bookId: string) => Promise<void>;
  resumeBook: (bookId: string) => Promise<void>;
  restartBook: (bookId: string) => Promise<void>;
  writeNextChapter: (bookId: string) => Promise<unknown>;
  writeAllChapters: (bookId: string) => Promise<{
    completedChapters: number;
    status: 'completed' | 'paused' | 'deleted';
  }>;
  exportBook: (bookId: string, format: BookExportFormat) => Promise<string>;
  getSchedulerStatus: () => Promise<SchedulerStatus>;
  startScheduler: () => Promise<void>;
  pauseScheduler: () => Promise<void>;
  listModels: () => Promise<ModelSavePayload[]>;
  saveModel: (input: ModelSavePayload) => Promise<void>;
  testModel: (modelId: string) => Promise<{
    ok: boolean;
    latency: number;
    error: string | null;
  }>;
  listSettings: () => Promise<Array<{ key: string; value: string }>>;
  getSetting: (key: string) => Promise<string | null>;
  setSetting: (key: string, value: string) => Promise<void>;
  onProgress: (listener: (payload: unknown) => void) => () => void;
  onBookGeneration: (listener: (payload: unknown) => void) => () => void;
  onExecutionLog: (listener: (payload: unknown) => void) => () => void;
};

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

function formatExportResponse(data: { filePath: string; downloadUrl: string }) {
  return `${data.filePath}（下载：${data.downloadUrl}）`;
}

function getQueryBaseUrl() {
  const value = new URL(window.location.href).searchParams.get('storyWeaverApi');
  return value || undefined;
}

function resolveBaseUrl(baseUrl?: string) {
  return baseUrl ?? getQueryBaseUrl() ?? window.location.origin;
}

async function requestJson<T>(
  baseUrl: string,
  method: HttpMethod,
  pathname: string,
  body?: unknown
): Promise<T> {
  const response = await fetch(new URL(pathname, baseUrl), {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error =
      data &&
      typeof data === 'object' &&
      'error' in data &&
      typeof data.error === 'string'
        ? data.error
        : `HTTP request failed with ${response.status}`;
    throw new Error(error);
  }

  return data as T;
}

function subscribeSse(
  baseUrl: string,
  endpoint: string,
  listener: (payload: unknown) => void
) {
  if (typeof EventSource === 'undefined') {
    return () => undefined;
  }

  const events = new EventSource(new URL(endpoint, baseUrl));
  events.onmessage = (event) => {
    listener(JSON.parse(event.data) as unknown);
  };

  return () => {
    events.close();
  };
}

export function createHttpStoryWeaverClient(
  options: { baseUrl?: string } = {}
): StoryWeaverApi {
  const baseUrl = resolveBaseUrl(options.baseUrl);

  return {
    listBooks: () => requestJson(baseUrl, 'GET', '/api/books'),
    createBook: async (payload) => {
      const response = await requestJson<{ bookId: string }>(
        baseUrl,
        'POST',
        '/api/books',
        payload
      );
      return response.bookId;
    },
    getBookDetail: (bookId) =>
      requestJson(baseUrl, 'GET', `/api/books/${encodeURIComponent(bookId)}`),
    deleteBook: async (bookId) => {
      await requestJson(baseUrl, 'DELETE', `/api/books/${encodeURIComponent(bookId)}`);
    },
    startBook: async (bookId) => {
      await requestJson(baseUrl, 'POST', `/api/books/${encodeURIComponent(bookId)}/start`);
    },
    pauseBook: async (bookId) => {
      await requestJson(baseUrl, 'POST', `/api/books/${encodeURIComponent(bookId)}/pause`);
    },
    resumeBook: async (bookId) => {
      await requestJson(baseUrl, 'POST', `/api/books/${encodeURIComponent(bookId)}/resume`);
    },
    restartBook: async (bookId) => {
      await requestJson(baseUrl, 'POST', `/api/books/${encodeURIComponent(bookId)}/restart`);
    },
    writeNextChapter: (bookId) =>
      requestJson(
        baseUrl,
        'POST',
        `/api/books/${encodeURIComponent(bookId)}/chapters/write-next`
      ),
    writeAllChapters: (bookId) =>
      requestJson(
        baseUrl,
        'POST',
        `/api/books/${encodeURIComponent(bookId)}/chapters/write-all`
      ),
    exportBook: async (bookId, format) => {
      const response = await requestJson<{ filePath: string; downloadUrl: string }>(
        baseUrl,
        'POST',
        `/api/books/${encodeURIComponent(bookId)}/exports`,
        { format }
      );
      return formatExportResponse(response);
    },
    getSchedulerStatus: () => requestJson(baseUrl, 'GET', '/api/scheduler/status'),
    startScheduler: async () => {
      await requestJson(baseUrl, 'POST', '/api/scheduler/start');
    },
    pauseScheduler: async () => {
      await requestJson(baseUrl, 'POST', '/api/scheduler/pause');
    },
    listModels: () => requestJson(baseUrl, 'GET', '/api/models'),
    saveModel: async (input) => {
      await requestJson(baseUrl, 'PUT', `/api/models/${encodeURIComponent(input.id)}`, input);
    },
    testModel: (modelId) =>
      requestJson(baseUrl, 'POST', `/api/models/${encodeURIComponent(modelId)}/test`),
    listSettings: () => requestJson(baseUrl, 'GET', '/api/settings'),
    getSetting: async (key) => {
      const response = await requestJson<{ key: string; value: string | null }>(
        baseUrl,
        'GET',
        `/api/settings/${encodeURIComponent(key)}`
      );
      return response.value;
    },
    setSetting: async (key, value) => {
      await requestJson(baseUrl, 'PUT', `/api/settings/${encodeURIComponent(key)}`, {
        value,
      });
    },
    onProgress: (listener) => subscribeSse(baseUrl, '/api/events/scheduler', listener),
    onBookGeneration: (listener) =>
      subscribeSse(baseUrl, '/api/events/book-generation', listener),
    onExecutionLog: (listener) =>
      subscribeSse(baseUrl, '/api/events/execution-logs', listener),
  };
}
