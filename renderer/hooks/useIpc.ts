import { useMemo } from 'react';

declare global {
  interface Window {
    storyWeaver?: {
      invoke: <T>(channel: string, payload?: unknown) => Promise<T>;
      onProgress: (listener: (payload: unknown) => void) => () => void;
      onBookGeneration: (listener: (payload: unknown) => void) => () => void;
      onExecutionLog: (listener: (payload: unknown) => void) => () => void;
    };
  }
}

const unavailableIpc = {
  isAvailable: false,
  invoke: async <T>() => undefined as T,
  onProgress: () => () => undefined,
  onBookGeneration: () => () => undefined,
  onExecutionLog: () => () => undefined,
};

export function useIpc() {
  return useMemo(() => {
    if (window.storyWeaver) {
      return {
        ...window.storyWeaver,
        isAvailable: true,
      };
    }

    return unavailableIpc;
  }, []);
}
