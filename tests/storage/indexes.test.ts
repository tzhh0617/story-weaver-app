import { describe, expect, it } from 'vitest';
import { createDatabase } from '@story-weaver/backend/storage/database';

describe('database indexes', () => {
  it('has index on books.status', () => {
    const db = createDatabase(':memory:');
    const indexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='books'"
    ).all().map((r: any) => r.name);
    expect(indexes).toContain('idx_books_status');
  });

  it('has index on chapters.book_id', () => {
    const db = createDatabase(':memory:');
    const indexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='chapters'"
    ).all().map((r: any) => r.name);
    expect(indexes).toContain('idx_chapters_book_id');
  });

  it('has index on api_logs book_id and created_at', () => {
    const db = createDatabase(':memory:');
    const indexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='api_logs'"
    ).all().map((r: any) => r.name);
    expect(indexes).toContain('idx_api_logs_book_id_created_at');
  });

  it('has index on writing_progress.book_id', () => {
    const db = createDatabase(':memory:');
    const indexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='writing_progress'"
    ).all().map((r: any) => r.name);
    expect(indexes).toContain('idx_writing_progress_book_id');
  });
});
