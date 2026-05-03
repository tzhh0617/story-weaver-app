import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import type { ExecutionLogLevel } from '../src/shared/contracts';
import { getStatusLabel } from './status-labels';

export const executionLogLevelLabels: Record<ExecutionLogLevel, string> = {
  debug: '调试',
  info: '信息',
  success: '成功',
  error: '错误',
};

export const executionEventLabels: Record<string, string> = {
  scheduler_task_registered: '注册任务',
  scheduler_status_snapshot: '调度快照',
  scheduler_task_started: '任务开始',
  scheduler_task_completed: '任务完成',
  scheduler_task_failed: '任务失败',
  ai_operation_started: 'AI 调用开始',
  ai_operation_completed: 'AI 调用完成',
  ai_operation_failed: 'AI 调用失败',
  runtime_mode_resolved: '运行模式解析',
  generation_event_received: '生成事件映射',
  scheduler_start_all: '批量开始',
  scheduler_pause_all: '批量暂停',
  book_queued: '加入队列',
  book_started: '开始执行',
  book_paused: '暂停执行',
  book_resumed: '恢复执行',
  book_restarted: '重新执行',
  book_write_next: '手动下一章',
  book_write_all: '手动写完',
  book_title_generation: '生成书名',
  story_world_planning: '构建世界观',
  story_outline_planning: '生成大纲',
  chapter_planning: '规划章节',
  chapter_writing: '章节写作',
  chapter_rewriting: '章节重写',
  chapter_auditing: '章节审校',
  chapter_revision: '章节修订',
  chapter_continuity_extraction: '连续性提取',
  chapter_state_extraction: '叙事状态提取',
  narrative_checkpoint: '叙事复盘',
  book_progress: '阶段进度',
  chapter_completed: '章节完成',
  book_completed: '执行完成',
  book_failed: '执行失败',
};

export function getExecutionEventLabel(eventType: string) {
  return executionEventLabels[eventType] ?? eventType;
}

export function getExecutionPhaseLabel(phase: string | null) {
  return phase ? getStatusLabel(phase) : null;
}

export function getExecutionLogLevelIcon(level: ExecutionLogLevel) {
  if (level === 'debug') {
    return Info;
  }

  if (level === 'success') {
    return CheckCircle2;
  }

  if (level === 'error') {
    return AlertCircle;
  }

  return Info;
}

export function getExecutionLogLevelClassName(level: ExecutionLogLevel) {
  if (level === 'debug') {
    return 'border-sky-500/30 bg-sky-500/10 text-sky-700';
  }

  if (level === 'success') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700';
  }

  if (level === 'error') {
    return 'border-destructive/30 bg-destructive/10 text-destructive';
  }

  return 'border-primary/25 bg-primary/10 text-primary';
}
