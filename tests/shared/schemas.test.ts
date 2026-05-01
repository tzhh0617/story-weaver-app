import { describe, expect, it } from 'vitest';
import {
  BookCreateSchema,
  BookExportRequestSchema,
  ViralTropeContractSchema,
} from '@story-weaver/shared/schemas/book-schemas';
import { ModelSaveSchema } from '@story-weaver/shared/schemas/model-schemas';
import { SettingUpdateSchema } from '@story-weaver/shared/schemas/settings-schemas';
import {
  SchedulerStatusSchema,
  BookGenerationProgressSchema,
  BookGenerationChapterStreamSchema,
  BookGenerationChapterCompleteSchema,
  BookGenerationErrorSchema,
  ExecutionLogSchema,
} from '@story-weaver/shared/schemas/event-schemas';

describe('book schemas', () => {
  it('BookCreateSchema accepts valid payload', () => {
    const result = BookCreateSchema.safeParse({
      idea: 'A city that stores memory in rain.',
      targetChapters: 500,
      wordsPerChapter: 2500,
    });
    expect(result.success).toBe(true);
  });

  it('BookCreateSchema accepts optional viralStrategy', () => {
    const result = BookCreateSchema.safeParse({
      idea: 'Revenge story',
      targetChapters: 100,
      wordsPerChapter: 2000,
      viralStrategy: {
        readerPayoff: 'revenge',
        protagonistDesire: '洗清旧案',
        tropeContracts: ['revenge_payback'],
        cadenceMode: 'steady',
        antiClicheDirection: '反派不降智',
      },
    });
    expect(result.success).toBe(true);
  });

  it('BookCreateSchema rejects missing required fields', () => {
    const result = BookCreateSchema.safeParse({ idea: 'test' });
    expect(result.success).toBe(false);
  });

  it('BookCreateSchema rejects zero targetChapters', () => {
    const result = BookCreateSchema.safeParse({
      idea: 'test',
      targetChapters: 0,
      wordsPerChapter: 2500,
    });
    expect(result.success).toBe(false);
  });

  it('BookCreateSchema rejects invalid viralStrategy cadenceMode', () => {
    const result = BookCreateSchema.safeParse({
      idea: 'test',
      targetChapters: 10,
      wordsPerChapter: 2000,
      viralStrategy: {
        cadenceMode: 'invalid_mode',
      },
    });
    expect(result.success).toBe(false);
  });

  it('ViralTropeContractSchema accepts all known tropes', () => {
    const tropes = [
      'rebirth_change_fate', 'system_growth', 'hidden_identity',
      'revenge_payback', 'weak_to_strong', 'forbidden_bond',
      'case_breaking', 'sect_or_family_pressure', 'survival_game',
      'business_or_power_game',
    ];
    for (const trope of tropes) {
      expect(ViralTropeContractSchema.safeParse(trope).success).toBe(true);
    }
  });

  it('BookExportRequestSchema accepts txt and md', () => {
    expect(BookExportRequestSchema.safeParse({ format: 'txt' }).success).toBe(true);
    expect(BookExportRequestSchema.safeParse({ format: 'md' }).success).toBe(true);
    expect(BookExportRequestSchema.safeParse({ format: 'pdf' }).success).toBe(false);
  });
});

describe('model schemas', () => {
  it('ModelSaveSchema accepts valid openai config', () => {
    const result = ModelSaveSchema.safeParse({
      id: 'model-1',
      provider: 'openai',
      modelName: 'gpt-4',
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com/v1',
      config: { temperature: 0.7 },
    });
    expect(result.success).toBe(true);
  });

  it('ModelSaveSchema accepts valid anthropic config', () => {
    const result = ModelSaveSchema.safeParse({
      id: 'model-2',
      provider: 'anthropic',
      modelName: 'claude-3-opus',
      apiKey: 'sk-ant-test',
      baseUrl: 'https://api.anthropic.com',
      config: {},
    });
    expect(result.success).toBe(true);
  });

  it('ModelSaveSchema rejects unknown provider', () => {
    const result = ModelSaveSchema.safeParse({
      id: 'model-3',
      provider: 'google',
      modelName: 'gemini',
      apiKey: 'test',
      baseUrl: 'https://google.com',
      config: {},
    });
    expect(result.success).toBe(false);
  });
});

describe('settings schemas', () => {
  it('SettingUpdateSchema accepts string value', () => {
    const result = SettingUpdateSchema.safeParse({ value: 'true' });
    expect(result.success).toBe(true);
  });

  it('SettingUpdateSchema rejects non-string value', () => {
    const result = SettingUpdateSchema.safeParse({ value: 123 });
    expect(result.success).toBe(false);
  });
});

describe('event schemas', () => {
  it('SchedulerStatusSchema accepts valid status', () => {
    const result = SchedulerStatusSchema.safeParse({
      runningBookIds: ['book-1'],
      queuedBookIds: [],
      pausedBookIds: ['book-2'],
      concurrencyLimit: null,
    });
    expect(result.success).toBe(true);
  });

  it('BookGenerationProgressSchema accepts progress event', () => {
    const result = BookGenerationProgressSchema.safeParse({
      type: 'progress',
      bookId: 'book-1',
      phase: 'writing',
      stepLabel: 'Writing chapter 5',
    });
    expect(result.success).toBe(true);
  });

  it('BookGenerationChapterStreamSchema accepts stream event', () => {
    const result = BookGenerationChapterStreamSchema.safeParse({
      type: 'chapter-stream',
      bookId: 'book-1',
      volumeIndex: 1,
      chapterIndex: 5,
      title: 'Chapter 5',
      delta: 'Some text',
      replace: false,
    });
    expect(result.success).toBe(true);
  });

  it('BookGenerationChapterCompleteSchema accepts complete event', () => {
    const result = BookGenerationChapterCompleteSchema.safeParse({
      type: 'chapter-complete',
      bookId: 'book-1',
      volumeIndex: 1,
      chapterIndex: 5,
    });
    expect(result.success).toBe(true);
  });

  it('BookGenerationErrorSchema accepts error event', () => {
    const result = BookGenerationErrorSchema.safeParse({
      type: 'error',
      bookId: 'book-1',
      phase: 'writing',
      stepLabel: 'Failed',
    });
    expect(result.success).toBe(true);
  });

  it('ExecutionLogSchema accepts valid log', () => {
    const result = ExecutionLogSchema.safeParse({
      id: 1,
      bookId: 'book-1',
      timestamp: '2026-05-02T00:00:00.000Z',
      level: 'info',
      event: 'chapter.complete',
      message: 'Chapter 5 completed',
    });
    expect(result.success).toBe(true);
  });
});
