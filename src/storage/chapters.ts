import type { Database as SqliteDatabase } from 'better-sqlite3';

export function createChapterRepository(db: SqliteDatabase) {
  return {
    upsertOutline(input: {
      bookId: string;
      volumeIndex: number;
      chapterIndex: number;
      title: string;
      outline: string;
    }) {
      db.prepare(
        `
          INSERT INTO chapters (
            book_id,
            volume_index,
            chapter_index,
            title,
            outline,
            created_at
          )
          VALUES (
            @bookId,
            @volumeIndex,
            @chapterIndex,
            @title,
            @outline,
            @createdAt
          )
          ON CONFLICT(book_id, volume_index, chapter_index) DO UPDATE SET
            title = excluded.title,
            outline = excluded.outline
        `
      ).run({
        ...input,
        createdAt: new Date().toISOString(),
      });
    },

    listByBook(bookId: string) {
      return db
        .prepare(
          `
            SELECT
              book_id AS bookId,
              volume_index AS volumeIndex,
              chapter_index AS chapterIndex,
              title,
              outline,
              content,
              summary,
              word_count AS wordCount
            FROM chapters
            WHERE book_id = ?
            ORDER BY volume_index ASC, chapter_index ASC
          `
        )
        .all(bookId) as Array<{
        bookId: string;
        volumeIndex: number;
        chapterIndex: number;
        title: string | null;
        outline: string | null;
        content: string | null;
        summary: string | null;
        wordCount: number;
      }>;
    },

    saveContent(input: {
      bookId: string;
      volumeIndex: number;
      chapterIndex: number;
      content: string;
      summary?: string | null;
      wordCount: number;
    }) {
      db.prepare(
        `
          UPDATE chapters
          SET
            content = @content,
            summary = @summary,
            word_count = @wordCount
          WHERE
            book_id = @bookId
            AND volume_index = @volumeIndex
            AND chapter_index = @chapterIndex
        `
      ).run({
        ...input,
        summary: input.summary ?? null,
      });
    },

    clearGeneratedContent(bookId: string) {
      db.prepare(
        `
          UPDATE chapters
          SET
            content = NULL,
            summary = NULL,
            word_count = 0
          WHERE book_id = ?
        `
      ).run(bookId);
    },

    deleteByBook(bookId: string) {
      db.prepare('DELETE FROM chapters WHERE book_id = ?').run(bookId);
    },
  };
}
