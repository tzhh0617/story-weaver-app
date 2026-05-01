import { z } from 'zod';

export const SchedulerStatusSchema = z.object({
  runningBookIds: z.array(z.string()),
  queuedBookIds: z.array(z.string()),
  pausedBookIds: z.array(z.string()),
  concurrencyLimit: z.number().nullable(),
});

const bookGenerationBase = z.object({
  bookId: z.string(),
  phase: z.string().optional(),
  stepLabel: z.string().optional(),
  currentVolume: z.number().nullable().optional(),
  currentChapter: z.number().nullable().optional(),
});

export const BookGenerationProgressSchema = bookGenerationBase.extend({
  type: z.literal('progress'),
});

export const BookGenerationChapterStreamSchema = bookGenerationBase.extend({
  type: z.literal('chapter-stream'),
  volumeIndex: z.number(),
  chapterIndex: z.number(),
  title: z.string(),
  delta: z.string(),
  replace: z.boolean().optional(),
});

export const BookGenerationChapterCompleteSchema = bookGenerationBase.extend({
  type: z.literal('chapter-complete'),
  volumeIndex: z.number(),
  chapterIndex: z.number(),
});

export const BookGenerationErrorSchema = bookGenerationBase.extend({
  type: z.literal('error'),
});

export const BookGenerationEventSchema = z.discriminatedUnion('type', [
  BookGenerationProgressSchema,
  BookGenerationChapterStreamSchema,
  BookGenerationChapterCompleteSchema,
  BookGenerationErrorSchema,
]);

export const ExecutionLogSchema = z.object({
  id: z.number(),
  bookId: z.string(),
  timestamp: z.string(),
  level: z.enum(['info', 'success', 'error']),
  event: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
  phase: z.string().optional(),
  stepLabel: z.string().optional(),
});

export type SchedulerStatusInput = z.infer<typeof SchedulerStatusSchema>;
export type BookGenerationEventInput = z.infer<typeof BookGenerationEventSchema>;
export type ExecutionLogInput = z.infer<typeof ExecutionLogSchema>;
