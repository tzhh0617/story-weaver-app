import { describe, expect, it } from 'vitest';
import { createChapterTensionBudgetRepository } from '@story-weaver/backend/storage/chapter-tension-budgets';
import { createDatabase } from '@story-weaver/backend/storage/database';

describe('narrative schema', () => {
  it('creates structured narrative planning and audit tables', () => {
    const db = createDatabase(':memory:');
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tables).toEqual(
      expect.arrayContaining([
        'story_bibles',
        'character_arcs',
        'relationship_edges',
        'world_rules',
        'narrative_threads',
        'volume_plans',
        'chapter_cards',
        'chapter_tension_budgets',
        'chapter_generation_audits',
        'relationship_states',
        'narrative_checkpoints',
      ])
    );
  });

  it('stores audit metadata on chapters without legacy outline ownership', () => {
    const db = createDatabase(':memory:');
    const columns = db
      .prepare('PRAGMA table_info(chapters)')
      .all()
      .map((row) => (row as { name: string }).name);

    expect(columns).toEqual(expect.arrayContaining(['audit_score', 'draft_attempts', 'updated_at']));
    expect(columns).not.toContain('outline');
  });

  it('round-trips chapter tension budgets', () => {
    const db = createDatabase(':memory:');
    db.prepare(
      `
        INSERT INTO books (
          id, title, idea, status, model_id, target_chapters,
          words_per_chapter, created_at, updated_at
        )
        VALUES (
          'book-1', '旧页', '命簿修复师追查家族旧案。', 'creating',
          'mock', 1, 2000, '2026-04-30T00:00:00.000Z',
          '2026-04-30T00:00:00.000Z'
        )
      `
    ).run();
    const repository = createChapterTensionBudgetRepository(db);

    repository.upsertMany([
      {
        bookId: 'book-1',
        volumeIndex: 1,
        chapterIndex: 1,
        pressureLevel: 'high',
        dominantTension: 'moral_choice',
        requiredTurn: '胜利会伤害同伴。',
        forcedChoice: '保住证据，或救下同伴。',
        costToPay: '失去同伴信任。',
        irreversibleChange: '林牧无法继续旁观。',
        readerQuestion: '谁安排了这次选择？',
        hookPressure: '章末出现更坏记录。',
        flatnessRisks: ['不要用解释代替冲突。'],
      },
    ]);

    expect(repository.getByChapter('book-1', 1, 1)).toMatchObject({
      bookId: 'book-1',
      volumeIndex: 1,
      chapterIndex: 1,
      pressureLevel: 'high',
      dominantTension: 'moral_choice',
      flatnessRisks: ['不要用解释代替冲突。'],
    });
    expect(repository.listByBook('book-1')).toHaveLength(1);

    repository.clearByBook('book-1');
    expect(repository.listByBook('book-1')).toEqual([]);
  });
});
