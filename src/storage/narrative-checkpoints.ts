import { asc, eq } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import { narrativeCheckpoints } from '../db/schema/index.js';

export function createNarrativeCheckpointRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  return {
    save(input: {
      bookId: string;
      chapterIndex: number;
      report?: unknown;
      checkpointType?: string;
      arcReport?: unknown;
      threadDebt?: unknown;
      pacingReport?: unknown;
      replanningNotes?: string | null;
      futureCardRevisions?: unknown[];
    }) {
      const report =
        input.report ?? {
          checkpointType: input.checkpointType,
          arcReport: input.arcReport,
          threadDebt: input.threadDebt,
          pacingReport: input.pacingReport,
          replanningNotes: input.replanningNotes ?? null,
        };
      drizzleDb
        .insert(narrativeCheckpoints)
        .values({
          bookId: input.bookId,
          chapterIndex: input.chapterIndex,
          reportJson: JSON.stringify(report),
          futureCardRevisionsJson: JSON.stringify(input.futureCardRevisions ?? []),
          createdAt: new Date().toISOString(),
        })
        .run();
    },

    listByBook(bookId: string) {
      return drizzleDb
        .select({
          bookId: narrativeCheckpoints.bookId,
          chapterIndex: narrativeCheckpoints.chapterIndex,
          reportJson: narrativeCheckpoints.reportJson,
          futureCardRevisionsJson: narrativeCheckpoints.futureCardRevisionsJson,
          createdAt: narrativeCheckpoints.createdAt,
        })
        .from(narrativeCheckpoints)
        .where(eq(narrativeCheckpoints.bookId, bookId))
        .orderBy(
          asc(narrativeCheckpoints.chapterIndex),
          asc(narrativeCheckpoints.id)
        )
        .all()
        .map((row) => {
          const typed = row as {
            bookId: string;
            chapterIndex: number;
            reportJson: string;
            futureCardRevisionsJson: string;
            createdAt: string;
          };
          return {
            bookId: typed.bookId,
            chapterIndex: typed.chapterIndex,
            checkpointType: (JSON.parse(typed.reportJson) as { checkpointType?: string })
              .checkpointType,
            report: JSON.parse(typed.reportJson) as unknown,
            futureCardRevisions: JSON.parse(typed.futureCardRevisionsJson) as unknown[],
            createdAt: typed.createdAt,
          };
        });
    },
  };
}
