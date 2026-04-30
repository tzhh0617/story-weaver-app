import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import type { ExecutionLogLevel } from '../src/shared/contracts';

export const executionLogLevelLabels: Record<ExecutionLogLevel, string> = {
  info: '信息',
  success: '成功',
  error: '错误',
};

export function getExecutionLogLevelIcon(level: ExecutionLogLevel) {
  if (level === 'success') {
    return CheckCircle2;
  }

  if (level === 'error') {
    return AlertCircle;
  }

  return Info;
}

export function getExecutionLogLevelClassName(level: ExecutionLogLevel) {
  if (level === 'success') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700';
  }

  if (level === 'error') {
    return 'border-destructive/30 bg-destructive/10 text-destructive';
  }

  return 'border-primary/25 bg-primary/10 text-primary';
}
