declare global {
  interface Window {
    storyWeaver?: {
      invoke: <T>(channel: string, payload?: unknown) => Promise<T>;
      onProgress: (listener: (payload: unknown) => void) => () => void;
      onBookGeneration: (listener: (payload: unknown) => void) => () => void;
    };
  }
}

export function useIpc() {
  if (window.storyWeaver) {
    return {
      ...window.storyWeaver,
      isAvailable: true,
    };
  }

  return {
    isAvailable: false,
    invoke: async <T>() => undefined as T,
    onProgress: () => () => undefined,
    onBookGeneration: () => () => undefined,
  };
}
