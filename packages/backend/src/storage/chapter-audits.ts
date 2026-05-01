import type { Database as SqliteDatabase } from 'better-sqlite3';
import type { NarrativeAudit } from '../core/narrative/types.js';

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function createChapterAuditRepository(db: SqliteDatabase) {
  return {
    save(input: {
      bookId: string;
      volumeIndex: number;
      chapterIndex: number;
      attempt: number;
      audit: NarrativeAudit;
    }) {
      db.prepare(
        `
          INSERT INTO chapter_generation_audits (
            book_id, volume_index, chapter_index, attempt, passed, score,
            decision, issues_json, scoring_json, state_updates_json, created_at
          )
          VALUES (
            @bookId, @volumeIndex, @chapterIndex, @attempt, @passed, @score,
            @decision, @issuesJson, @scoringJson, @stateUpdatesJson, @createdAt
          )
        `
      ).run({
        bookId: input.bookId,
        volumeIndex: input.volumeIndex,
        chapterIndex: input.chapterIndex,
        attempt: input.attempt,
        passed: input.audit.passed ? 1 : 0,
        score: input.audit.score,
        decision: input.audit.decision,
        issuesJson: JSON.stringify(input.audit.issues),
        scoringJson: JSON.stringify(input.audit.scoring),
        stateUpdatesJson: JSON.stringify(input.audit.stateUpdates),
        createdAt: new Date().toISOString(),
      });
    },

    listByChapter(bookId: string, volumeIndex: number, chapterIndex: number) {
      const rows = db
        .prepare(
          `
            SELECT
              attempt,
              passed,
              score,
              decision,
              issues_json AS issuesJson,
              scoring_json AS scoringJson,
              state_updates_json AS stateUpdatesJson,
              created_at AS createdAt
            FROM chapter_generation_audits
            WHERE book_id = ? AND volume_index = ? AND chapter_index = ?
            ORDER BY attempt ASC, id ASC
          `
        )
        .all(bookId, volumeIndex, chapterIndex) as Array<{
        attempt: number;
        passed: number;
        score: number;
        decision: NarrativeAudit['decision'];
        issuesJson: string;
        scoringJson: string;
        stateUpdatesJson: string;
        createdAt: string;
      }>;

      return rows.map((row) => ({
        attempt: row.attempt,
        passed: Boolean(row.passed),
        score: row.score,
        decision: row.decision,
        issues: safeJsonParse<NarrativeAudit['issues']>(row.issuesJson, []),
        scoring: safeJsonParse<NarrativeAudit['scoring']>(row.scoringJson, {} as NarrativeAudit['scoring']),
        stateUpdates: safeJsonParse<NarrativeAudit['stateUpdates']>(row.stateUpdatesJson, {} as NarrativeAudit['stateUpdates']),
        createdAt: row.createdAt,
      }));
    },

    listLatestByBook(bookId: string) {
      const rows = db
        .prepare(
          `
            SELECT
              volume_index AS volumeIndex,
              chapter_index AS chapterIndex,
              attempt,
              passed,
              score,
              decision,
              issues_json AS issuesJson,
              scoring_json AS scoringJson,
              state_updates_json AS stateUpdatesJson,
              created_at AS createdAt
            FROM chapter_generation_audits
            WHERE book_id = ?
            ORDER BY chapter_index ASC, attempt ASC, id ASC
          `
        )
        .all(bookId) as Array<{
        volumeIndex: number;
        chapterIndex: number;
        attempt: number;
        passed: number;
        score: number;
        decision: NarrativeAudit['decision'];
        issuesJson: string;
        scoringJson: string;
        stateUpdatesJson: string;
        createdAt: string;
      }>;

      const latest = new Map<number, (typeof rows)[number]>();
      for (const row of rows) {
        latest.set(row.chapterIndex, row);
      }

      return [...latest.values()].map((row) => ({
        volumeIndex: row.volumeIndex,
        chapterIndex: row.chapterIndex,
        attempt: row.attempt,
        passed: Boolean(row.passed),
        score: row.score,
        decision: row.decision,
        issues: safeJsonParse<NarrativeAudit['issues']>(row.issuesJson, []),
        scoring: safeJsonParse<NarrativeAudit['scoring']>(row.scoringJson, {} as NarrativeAudit['scoring']),
        stateUpdates: safeJsonParse<NarrativeAudit['stateUpdates']>(row.stateUpdatesJson, {} as NarrativeAudit['stateUpdates']),
        createdAt: row.createdAt,
      }));
    },
  };
}
