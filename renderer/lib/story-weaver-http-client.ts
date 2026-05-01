import type { StoryWeaverIpc, StoryWeaverInvoke } from '../hooks/useIpc';

function formatHttpInvokeData(data: unknown) {
  if (
    data &&
    typeof data === 'object' &&
    'filePath' in data &&
    typeof data.filePath === 'string' &&
    'downloadUrl' in data &&
    typeof data.downloadUrl === 'string'
  ) {
    return `${data.filePath}（下载：${data.downloadUrl}）`;
  }

  return data;
}

async function invokeHttp(channel: string, payload?: unknown) {
  const response = await fetch(new URL('/api/invoke', window.location.href), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, payload }),
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const error =
      body &&
      typeof body === 'object' &&
      'error' in body &&
      typeof body.error === 'string'
        ? body.error
        : `HTTP invoke failed with ${response.status}`;
    throw new Error(error);
  }

  if (body && typeof body === 'object' && 'data' in body) {
    return formatHttpInvokeData(body.data);
  }

  return undefined;
}

function subscribeSse(endpoint: string, listener: (payload: unknown) => void) {
  if (typeof EventSource === 'undefined') {
    return () => undefined;
  }

  const events = new EventSource(endpoint);
  events.onmessage = (event) => {
    listener(JSON.parse(event.data) as unknown);
  };

  return () => {
    events.close();
  };
}

export function createHttpStoryWeaverClient(): StoryWeaverIpc {
  return {
    isAvailable: true,
    invoke: invokeHttp as StoryWeaverInvoke,
    onProgress: (listener) => subscribeSse('/api/events/scheduler', listener),
    onBookGeneration: (listener) =>
      subscribeSse('/api/events/book-generation', listener),
    onExecutionLog: (listener) =>
      subscribeSse('/api/events/execution-logs', listener),
  };
}
