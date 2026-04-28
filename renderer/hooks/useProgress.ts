import { useEffect, useState } from 'react';
import {
  ipcChannels,
  type SchedulerStatus,
} from '../../src/shared/contracts';
import { useIpc } from './useIpc';

const emptyStatus: SchedulerStatus = {
  runningBookIds: [],
  queuedBookIds: [],
  pausedBookIds: [],
  concurrencyLimit: null,
};

export function useProgress() {
  const ipc = useIpc();
  const [status, setStatus] = useState<SchedulerStatus>(emptyStatus);

  useEffect(() => {
    let isMounted = true;

    void ipc
      .invoke<SchedulerStatus>(ipcChannels.schedulerStatus)
      .then((payload) => {
        if (isMounted && payload) {
          setStatus(payload);
        }
      });

    const unsubscribe = ipc.onProgress((payload) => {
      setStatus(payload as SchedulerStatus);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [ipc]);

  return status;
}
