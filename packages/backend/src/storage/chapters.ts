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
      const now = new Date().toISOString();

      db.prepare(
        `
          INSERT INTO chapters (
            book_id,
            volume_index,
            chapter_index,
            title,
            created_at
          )
          VALUES (
            @bookId,
            @volumeIndex,
            @chapterIndex,
            @title,
            @createdAt
          )
          ON CONFLICT(book_id, volume_index, chapter_index) DO UPDATE SET
            title = excluded.title,
            updated_at = excluded.created_at
        `
      ).run({
        bookId: input.bookId,
        volumeIndex: input.volumeIndex,
        chapterIndex: input.chapterIndex,
        title: input.title,
        createdAt: now,
      });

      db.prepare(
        `
          INSERT INTO chapter_cards (
            book_id,
            volume_index,
            chapter_index,
            title,
            plot_function,
            pov_character_id,
            external_conflict,
            internal_conflict,
            relationship_change,
            world_rule_used_or_tested,
            information_reveal,
            reader_reward,
            ending_hook,
            must_change,
            forbidden_moves_json
          )
          VALUES (
            @bookId,
            @volumeIndex,
            @chapterIndex,
            @title,
            @outline,
            NULL,
            @outline,
            @outline,
            '',
            '',
            '',
            'truth',
            '',
            @outline,
            '[]'
          )
          ON CONFLICT(book_id, volume_index, chapter_index) DO UPDATE SET
            title = excluded.title,
            plot_function = excluded.plot_function
        `
      ).run(input);
    },

    upsertPlanned(input: {
      bookId: string;
      volumeIndex: number;
      chapterIndex: number;
      title: string;
      outline: string;
    }) {
      this.upsertOutline(input);
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
              (
                SELECT plot_function
                FROM chapter_cards
                WHERE chapter_cards.book_id = chapters.book_id
                  AND chapter_cards.volume_index = chapters.volume_index
                  AND chapter_cards.chapter_index = chapters.chapter_index
              ) AS outline,
              content,
              summary,
              word_count AS wordCount,
              audit_score AS auditScore,
              draft_attempts AS draftAttempts
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
        auditScore: number | null;
        draftAttempts: number;
      }>;
    },

    listProgressByBookIds(bookIds: string[]) {
      if (!bookIds.length) {
        return new Map<
          string,
          { completedChapters: number; totalChapters: number }
        >();
      }

      const placeholders = bookIds.map(() => '?').join(', ');
      const rows = db
        .prepare(
          `
            SELECT
              book_id AS bookId,
              COUNT(*) AS totalChapters,
              SUM(CASE WHEN content IS NOT NULL AND content != '' THEN 1 ELSE 0 END)
                AS completedChapters
            FROM chapters
            WHERE book_id IN (${placeholders})
            GROUP BY book_id
          `
        )
        .all(...bookIds) as Array<{
        bookId: string;
        completedChapters: number | null;
        totalChapters: number;
      }>;

      return new Map(
        rows.map((row) => [
          row.bookId,
          {
            completedChapters: row.completedChapters ?? 0,
            totalChapters: row.totalChapters,
          },
        ])
      );
    },

    saveContent(input: {
      bookId: string;
      volumeIndex: number;
      chapterIndex: number;
      content: string;
      summary?: string | null;
      wordCount: number;
      auditScore?: number | null;
      draftAttempts?: number;
    }) {
      db.prepare(
        `
          UPDATE chapters
          SET
            content = @content,
            summary = @summary,
            word_count = @wordCount,
            audit_score = COALESCE(@auditScore, audit_score),
            draft_attempts = COALESCE(@draftAttempts, draft_attempts),
            updated_at = @updatedAt
          WHERE
            book_id = @bookId
            AND volume_index = @volumeIndex
            AND chapter_index = @chapterIndex
        `
      ).run({
        ...input,
        summary: input.summary ?? null,
        auditScore: input.auditScore ?? null,
        draftAttempts: input.draftAttempts ?? null,
        updatedAt: new Date().toISOString(),
      });
    },

    clearGeneratedContent(bookId: string) {
      db.prepare(
        `
          UPDATE chapters
          SET
            content = NULL,
            summary = NULL,
            word_count = 0,
            audit_score = NULL,
            draft_attempts = 0,
            updated_at = ?
          WHERE book_id = ?
        `
      ).run(new Date().toISOString(), bookId);
    },

    deleteByBook(bookId: string) {
      db.prepare('DELETE FROM chapters WHERE book_id = ?').run(bookId);
    },
  };
}
