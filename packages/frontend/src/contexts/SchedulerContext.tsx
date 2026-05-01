import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { SchedulerStatus, ExecutionLogRecord } from '@story-weaver/shared/contracts';
import { useStoryWeaverApi } from '../hooks/useStoryWeaverApi';

const MAX_EXECUTION_LOGS = 500;

const emptyStatus: SchedulerStatus = {
  runningBookIds: [],
  queuedBookIds: [],
  pausedBookIds: [],
  concurrencyLimit: null,
};

type SchedulerContextValue = {
  progress: SchedulerStatus;
  executionLogs: ExecutionLogRecord[];
};

const SchedulerContext = createContext<SchedulerContextValue | null>(null);

export function SchedulerProvider({ children }: { children: ReactNode }) {
  const api = useStoryWeaverApi();
  const [progress, setProgress] = useState<SchedulerStatus>(emptyStatus);
  const [executionLogs, setExecutionLogs] = useState<ExecutionLogRecord[]>([]);

  useEffect(() => {
    let isMounted = true;

    void api.getSchedulerStatus().then((payload) => {
      if (isMounted && payload) {
        setProgress(payload);
      }
    });

    const unsubscribe = api.onProgress((payload) => {
      if (isMounted) {
        setProgress(payload as SchedulerStatus);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [api]);

  useEffect(() => {
    const unsubscribe = api.onExecutionLog((payload) => {
      setExecutionLogs((current) => {
        const next = [...current, payload as ExecutionLogRecord];
        return next.length > MAX_EXECUTION_LOGS ? next.slice(-MAX_EXECUTION_LOGS) : next;
      });
    });

    return unsubscribe;
  }, [api]);

  return (
    <SchedulerContext.Provider value={{ progress, executionLogs }}>
      {children}
    </SchedulerContext.Provider>
  );
}

export function useSchedulerContext() {
  const ctx = useContext(SchedulerContext);
  if (!ctx) throw new Error('useSchedulerContext must be used within SchedulerProvider');
  return ctx;
}
