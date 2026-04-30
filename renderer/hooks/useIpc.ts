import { useMemo } from 'react';
import type {
  IpcInvokeChannel,
  IpcPayloadMap,
  IpcResponseMap,
} from '../../src/shared/contracts';

type InvokeArgs<Channel extends IpcInvokeChannel> =
  undefined extends IpcPayloadMap[Channel]
    ? [payload?: IpcPayloadMap[Channel]]
    : [payload: IpcPayloadMap[Channel]];

export type StoryWeaverInvoke = <Channel extends IpcInvokeChannel>(
  channel: Channel,
  ...args: InvokeArgs<Channel>
) => Promise<IpcResponseMap[Channel]>;

export type StoryWeaverIpc = {
  isAvailable: boolean;
  invoke: StoryWeaverInvoke;
  onProgress: (listener: (payload: unknown) => void) => () => void;
  onBookGeneration: (listener: (payload: unknown) => void) => () => void;
  onExecutionLog: (listener: (payload: unknown) => void) => () => void;
};

declare global {
  interface Window {
    storyWeaver?: Omit<StoryWeaverIpc, 'isAvailable'>;
  }
}

const unavailableIpc: StoryWeaverIpc = {
  isAvailable: false,
  invoke: async () => undefined as never,
  onProgress: () => () => undefined,
  onBookGeneration: () => () => undefined,
  onExecutionLog: () => () => undefined,
};

export function useIpc(): StoryWeaverIpc {
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
