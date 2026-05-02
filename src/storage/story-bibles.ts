import { eq } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import { storyBibles } from '../db/schema/index.js';
import type { NarrativeBible } from '../core/narrative/types.js';
import type { createCharacterArcRepository } from './character-arcs.js';
import type { createNarrativeThreadRepository } from './narrative-threads.js';
import type { createRelationshipEdgeRepository } from './relationship-edges.js';
import type { createWorldRuleRepository } from './world-rules.js';

export function createStoryBibleRepository(
  db: SqliteDatabase,
  graphRepos: {
    characterArcs: ReturnType<typeof createCharacterArcRepository>;
    relationshipEdges: ReturnType<typeof createRelationshipEdgeRepository>;
    worldRules: ReturnType<typeof createWorldRuleRepository>;
    narrativeThreads: ReturnType<typeof createNarrativeThreadRepository>;
  }
) {
  const drizzleDb = createDrizzleDb(db);

  return {
    saveGraph(bookId: string, bible: NarrativeBible) {
      const now = new Date().toISOString();
      drizzleDb
        .insert(storyBibles)
        .values({
          bookId,
          premise: bible.premise,
          genreContract: bible.genreContract,
          targetReaderExperience: bible.targetReaderExperience,
          themeQuestion: bible.themeQuestion,
          themeAnswerDirection: bible.themeAnswerDirection,
          centralDramaticQuestion: bible.centralDramaticQuestion,
          endingStateJson: JSON.stringify(bible.endingState),
          voiceGuide: bible.voiceGuide,
          viralProtocolJson: bible.viralStoryProtocol
            ? JSON.stringify(bible.viralStoryProtocol)
            : null,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: storyBibles.bookId,
          set: {
            premise: bible.premise,
            genreContract: bible.genreContract,
            targetReaderExperience: bible.targetReaderExperience,
            themeQuestion: bible.themeQuestion,
            themeAnswerDirection: bible.themeAnswerDirection,
            centralDramaticQuestion: bible.centralDramaticQuestion,
            endingStateJson: JSON.stringify(bible.endingState),
            voiceGuide: bible.voiceGuide,
            viralProtocolJson: bible.viralStoryProtocol
              ? JSON.stringify(bible.viralStoryProtocol)
              : null,
            updatedAt: now,
          },
        })
        .run();

      graphRepos.characterArcs.upsertMany(bookId, bible.characterArcs);
      graphRepos.relationshipEdges.upsertMany(bookId, bible.relationshipEdges);
      graphRepos.worldRules.upsertMany(bookId, bible.worldRules);
      graphRepos.narrativeThreads.upsertMany(bookId, bible.narrativeThreads);
    },

    getByBook(bookId: string) {
      const row = drizzleDb
        .select({
          premise: storyBibles.premise,
          genreContract: storyBibles.genreContract,
          targetReaderExperience: storyBibles.targetReaderExperience,
          themeQuestion: storyBibles.themeQuestion,
          themeAnswerDirection: storyBibles.themeAnswerDirection,
          centralDramaticQuestion: storyBibles.centralDramaticQuestion,
          endingStateJson: storyBibles.endingStateJson,
          voiceGuide: storyBibles.voiceGuide,
          viralProtocolJson: storyBibles.viralProtocolJson,
        })
        .from(storyBibles)
        .where(eq(storyBibles.bookId, bookId))
        .get() as
        | {
            premise: string;
            genreContract: string;
            targetReaderExperience: string;
            themeQuestion: string;
            themeAnswerDirection: string;
            centralDramaticQuestion: string;
            endingStateJson: string;
            voiceGuide: string;
            viralProtocolJson: string | null;
          }
        | undefined;

      if (!row) return null;

      return {
        premise: row.premise,
        genreContract: row.genreContract,
        targetReaderExperience: row.targetReaderExperience,
        themeQuestion: row.themeQuestion,
        themeAnswerDirection: row.themeAnswerDirection,
        centralDramaticQuestion: row.centralDramaticQuestion,
        endingState: JSON.parse(row.endingStateJson) as NarrativeBible['endingState'],
        voiceGuide: row.voiceGuide,
        viralStoryProtocol: row.viralProtocolJson
          ? (JSON.parse(row.viralProtocolJson) as NarrativeBible['viralStoryProtocol'])
          : undefined,
      };
    },
  };
}
