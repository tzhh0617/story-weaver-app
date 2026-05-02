import { and, asc, eq } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import { chapterGenerationAudits } from '../db/schema/index.js';
import type { NarrativeAudit } from '../core/narrative/types.js';

export function createChapterAuditRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  return {
    save(input: {
      bookId: string;
      volumeIndex: number;
      chapterIndex: number;
      attempt: number;
      audit: NarrativeAudit;
    }) {
      drizzleDb
        .insert(chapterGenerationAudits)
        .values({
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
        })
        .run();
    },

    listByChapter(bookId: string, volumeIndex: number, chapterIndex: number) {
      const rows = drizzleDb
        .select({
          attempt: chapterGenerationAudits.attempt,
          passed: chapterGenerationAudits.passed,
          score: chapterGenerationAudits.score,
          decision: chapterGenerationAudits.decision,
          issuesJson: chapterGenerationAudits.issuesJson,
          scoringJson: chapterGenerationAudits.scoringJson,
          stateUpdatesJson: chapterGenerationAudits.stateUpdatesJson,
          createdAt: chapterGenerationAudits.createdAt,
        })
        .from(chapterGenerationAudits)
        .where(
          and(
            eq(chapterGenerationAudits.bookId, bookId),
            eq(chapterGenerationAudits.volumeIndex, volumeIndex),
            eq(chapterGenerationAudits.chapterIndex, chapterIndex)
          )
        )
        .orderBy(
          asc(chapterGenerationAudits.attempt),
          asc(chapterGenerationAudits.id)
        )
        .all() as Array<{
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
        issues: JSON.parse(row.issuesJson) as NarrativeAudit['issues'],
        scoring: JSON.parse(row.scoringJson) as NarrativeAudit['scoring'],
        stateUpdates: JSON.parse(row.stateUpdatesJson) as NarrativeAudit['stateUpdates'],
        createdAt: row.createdAt,
      }));
    },

    listLatestByBook(bookId: string) {
      const rows = drizzleDb
        .select({
          volumeIndex: chapterGenerationAudits.volumeIndex,
          chapterIndex: chapterGenerationAudits.chapterIndex,
          attempt: chapterGenerationAudits.attempt,
          passed: chapterGenerationAudits.passed,
          score: chapterGenerationAudits.score,
          decision: chapterGenerationAudits.decision,
          issuesJson: chapterGenerationAudits.issuesJson,
          scoringJson: chapterGenerationAudits.scoringJson,
          stateUpdatesJson: chapterGenerationAudits.stateUpdatesJson,
          createdAt: chapterGenerationAudits.createdAt,
        })
        .from(chapterGenerationAudits)
        .where(eq(chapterGenerationAudits.bookId, bookId))
        .orderBy(
          asc(chapterGenerationAudits.chapterIndex),
          asc(chapterGenerationAudits.attempt),
          asc(chapterGenerationAudits.id)
        )
        .all() as Array<{
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
        issues: JSON.parse(row.issuesJson) as NarrativeAudit['issues'],
        scoring: JSON.parse(row.scoringJson) as NarrativeAudit['scoring'],
        stateUpdates: JSON.parse(row.stateUpdatesJson) as NarrativeAudit['stateUpdates'],
        createdAt: row.createdAt,
      }));
    },
  };
}
