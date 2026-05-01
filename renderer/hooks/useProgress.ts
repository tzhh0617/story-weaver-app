import { useEffect, useState } from 'react';
import type { SchedulerStatus } from '../../src/shared/contracts';
import { useStoryWeaverApi } from './useStoryWeaverApi';

const emptyStatus: SchedulerStatus = {
  runningBookIds: [],
  queuedBookIds: [],
  pausedBookIds: [],
  concurrencyLimit: null,
};

export function useProgress() {
  const api = useStoryWeaverApi();
  const [status, setStatus] = useState<SchedulerStatus>(emptyStatus);

  useEffect(() => {
    let isMounted = true;

    void api.getSchedulerStatus().then((payload) => {
      if (isMounted && payload) {
        setStatus(payload);
      }
    });

    const unsubscribe = api.onProgress((payload) => {
      setStatus(payload as SchedulerStatus);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [api]);

  return status;
}
