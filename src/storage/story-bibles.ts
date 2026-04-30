import type { Database as SqliteDatabase } from 'better-sqlite3';
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
  return {
    saveGraph(bookId: string, bible: NarrativeBible) {
      const now = new Date().toISOString();
      db.prepare(
        `
          INSERT INTO story_bibles (
            book_id,
            premise,
            genre_contract,
            target_reader_experience,
            theme_question,
            theme_answer_direction,
            central_dramatic_question,
            ending_state_json,
            voice_guide,
            viral_protocol_json,
            created_at,
            updated_at
          )
          VALUES (
            @bookId,
            @premise,
            @genreContract,
            @targetReaderExperience,
            @themeQuestion,
            @themeAnswerDirection,
            @centralDramaticQuestion,
            @endingStateJson,
            @voiceGuide,
            @viralProtocolJson,
            @createdAt,
            @updatedAt
          )
          ON CONFLICT(book_id) DO UPDATE SET
            premise = excluded.premise,
            genre_contract = excluded.genre_contract,
            target_reader_experience = excluded.target_reader_experience,
            theme_question = excluded.theme_question,
            theme_answer_direction = excluded.theme_answer_direction,
            central_dramatic_question = excluded.central_dramatic_question,
            ending_state_json = excluded.ending_state_json,
            voice_guide = excluded.voice_guide,
            viral_protocol_json = excluded.viral_protocol_json,
            updated_at = excluded.updated_at
        `
      ).run({
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
      });

      graphRepos.characterArcs.upsertMany(bookId, bible.characterArcs);
      graphRepos.relationshipEdges.upsertMany(bookId, bible.relationshipEdges);
      graphRepos.worldRules.upsertMany(bookId, bible.worldRules);
      graphRepos.narrativeThreads.upsertMany(bookId, bible.narrativeThreads);
    },

    getByBook(bookId: string) {
      const row = db
        .prepare(
          `
            SELECT
              premise,
              genre_contract AS genreContract,
              target_reader_experience AS targetReaderExperience,
              theme_question AS themeQuestion,
              theme_answer_direction AS themeAnswerDirection,
              central_dramatic_question AS centralDramaticQuestion,
              ending_state_json AS endingStateJson,
              voice_guide AS voiceGuide,
              viral_protocol_json AS viralProtocolJson
            FROM story_bibles
            WHERE book_id = ?
          `
        )
        .get(bookId) as
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
