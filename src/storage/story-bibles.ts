import { and, eq } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import {
  endgamePlans,
  titleIdeaContracts,
} from '../db/schema/index.js';
import type { NarrativeBible } from '../core/narrative/types.js';
import type { createCharacterArcRepository } from './character-arcs.js';
import type { createNarrativeThreadRepository } from './narrative-threads.js';
import type { createRelationshipEdgeRepository } from './relationship-edges.js';
import type { createWorldRuleRepository } from './world-rules.js';

type StoryBibleBridgePayload = Pick<
  NarrativeBible,
  | 'premise'
  | 'genreContract'
  | 'targetReaderExperience'
  | 'themeQuestion'
  | 'themeAnswerDirection'
  | 'centralDramaticQuestion'
  | 'voiceGuide'
  | 'viralStoryProtocol'
>;

type EndgameRow = {
  protagonistEndState: string;
  finalConflict: string;
  finalOpponent: string;
  worldEndState: string;
  coreCharacterOutcomesJson: string;
  majorPayoffsJson: string;
};

type CompatibleStoryBibleBridgePayload = StoryBibleBridgePayload & {
  plannerCorePromise?: string;
};

function parseContractPayload(row: {
  title: string;
  idea: string;
  corePromise: string;
  titleHooksJson: string;
  forbiddenDriftJson: string;
}) {
  try {
    const payload = JSON.parse(row.corePromise) as Partial<CompatibleStoryBibleBridgePayload>;

    return {
      premise: payload.premise ?? row.idea,
      genreContract: payload.genreContract ?? row.title,
      targetReaderExperience:
        payload.targetReaderExperience ??
        (JSON.parse(row.titleHooksJson) as string[]).join(' / '),
      themeQuestion:
        payload.themeQuestion ?? (JSON.parse(row.forbiddenDriftJson) as string[])[0] ?? row.title,
      themeAnswerDirection:
        payload.themeAnswerDirection ?? payload.plannerCorePromise ?? row.corePromise,
      centralDramaticQuestion: payload.centralDramaticQuestion ?? row.title,
      voiceGuide:
        payload.voiceGuide ?? (JSON.parse(row.forbiddenDriftJson) as string[]).join(' / '),
      viralStoryProtocol: payload.viralStoryProtocol,
    } satisfies StoryBibleBridgePayload;
  } catch {
    const titleHooks = JSON.parse(row.titleHooksJson) as string[];
    const forbiddenDrift = JSON.parse(row.forbiddenDriftJson) as string[];

    return {
      premise: row.idea,
      genreContract: titleHooks[0] ?? row.title,
      targetReaderExperience: titleHooks.join(' / '),
      themeQuestion: forbiddenDrift[0] ?? row.title,
      themeAnswerDirection: row.corePromise,
      centralDramaticQuestion: row.title,
      voiceGuide: forbiddenDrift.join(' / '),
      viralStoryProtocol: undefined,
    } satisfies StoryBibleBridgePayload;
  }
}

function encodeContractPayload(bible: NarrativeBible) {
  const payload: StoryBibleBridgePayload = {
    premise: bible.premise,
    genreContract: bible.genreContract,
    targetReaderExperience: bible.targetReaderExperience,
    themeQuestion: bible.themeQuestion,
    themeAnswerDirection: bible.themeAnswerDirection,
    centralDramaticQuestion: bible.centralDramaticQuestion,
    voiceGuide: bible.voiceGuide,
    viralStoryProtocol: bible.viralStoryProtocol,
  };

  return {
    corePromise: JSON.stringify(payload),
    titleHooksJson: JSON.stringify([
      bible.premise,
      bible.genreContract,
      bible.targetReaderExperience,
    ]),
    forbiddenDriftJson: JSON.stringify([
      bible.themeQuestion,
      bible.themeAnswerDirection,
      bible.centralDramaticQuestion,
      bible.voiceGuide,
    ]),
  };
}

function decodeContractPayload(
  row:
    | {
        title: string;
        idea: string;
        corePromise: string;
        titleHooksJson: string;
        forbiddenDriftJson: string;
      }
    | undefined,
  endgameRow: EndgameRow | undefined
): NarrativeBible | null {
  if (!row || !endgameRow) {
    return null;
  }

  const payload = parseContractPayload(row);
  const coreCharacterOutcomes = JSON.parse(endgameRow.coreCharacterOutcomesJson) as {
    protagonistLoses?: string;
    relationshipOutcome?: string;
  };
  const majorPayoffs = JSON.parse(endgameRow.majorPayoffsJson) as {
    themeAnswer?: string;
  };

  return {
    premise: payload.premise,
    genreContract: payload.genreContract,
    targetReaderExperience: payload.targetReaderExperience,
    themeQuestion: payload.themeQuestion,
    themeAnswerDirection: payload.themeAnswerDirection,
    centralDramaticQuestion: payload.centralDramaticQuestion,
    endingState: {
      protagonistWins: endgameRow.protagonistEndState,
      protagonistLoses: coreCharacterOutcomes.protagonistLoses ?? endgameRow.finalConflict,
      worldChange: endgameRow.worldEndState,
      relationshipOutcome:
        coreCharacterOutcomes.relationshipOutcome ?? endgameRow.finalOpponent,
      themeAnswer: majorPayoffs.themeAnswer ?? payload.themeAnswerDirection,
    },
    voiceGuide: payload.voiceGuide,
    characterArcs: [],
    relationshipEdges: [],
    worldRules: [],
    narrativeThreads: [],
    viralStoryProtocol: payload.viralStoryProtocol,
  };
}

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
      const contractPayload = encodeContractPayload(bible);

      drizzleDb
        .insert(titleIdeaContracts)
        .values({
          bookId,
          title: bible.centralDramaticQuestion,
          idea: bible.premise,
          ...contractPayload,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: titleIdeaContracts.bookId,
          set: {
            title: bible.centralDramaticQuestion,
            idea: bible.premise,
            ...contractPayload,
            updatedAt: now,
          },
        })
        .run();

      drizzleDb
        .insert(endgamePlans)
        .values({
          bookId,
          titleIdeaContract: bible.centralDramaticQuestion,
          protagonistEndState: bible.endingState.protagonistWins,
          finalConflict: bible.endingState.protagonistLoses,
          finalOpponent: bible.endingState.relationshipOutcome,
          worldEndState: bible.endingState.worldChange,
          coreCharacterOutcomesJson: JSON.stringify({
            protagonistLoses: bible.endingState.protagonistLoses,
            relationshipOutcome: bible.endingState.relationshipOutcome,
          }),
          majorPayoffsJson: JSON.stringify({
            themeAnswer: bible.endingState.themeAnswer,
          }),
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: endgamePlans.bookId,
          set: {
            titleIdeaContract: bible.centralDramaticQuestion,
            protagonistEndState: bible.endingState.protagonistWins,
            finalConflict: bible.endingState.protagonistLoses,
            finalOpponent: bible.endingState.relationshipOutcome,
            worldEndState: bible.endingState.worldChange,
            coreCharacterOutcomesJson: JSON.stringify({
              protagonistLoses: bible.endingState.protagonistLoses,
              relationshipOutcome: bible.endingState.relationshipOutcome,
            }),
            majorPayoffsJson: JSON.stringify({
              themeAnswer: bible.endingState.themeAnswer,
            }),
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
      const contractRow = drizzleDb
        .select({
          title: titleIdeaContracts.title,
          idea: titleIdeaContracts.idea,
          corePromise: titleIdeaContracts.corePromise,
          titleHooksJson: titleIdeaContracts.titleHooksJson,
          forbiddenDriftJson: titleIdeaContracts.forbiddenDriftJson,
        })
        .from(titleIdeaContracts)
        .where(eq(titleIdeaContracts.bookId, bookId))
        .get() as
        | {
            title: string;
            idea: string;
            corePromise: string;
            titleHooksJson: string;
            forbiddenDriftJson: string;
          }
        | undefined;

      const planRow = drizzleDb
        .select({
          protagonistEndState: endgamePlans.protagonistEndState,
          finalConflict: endgamePlans.finalConflict,
          finalOpponent: endgamePlans.finalOpponent,
          worldEndState: endgamePlans.worldEndState,
          coreCharacterOutcomesJson: endgamePlans.coreCharacterOutcomesJson,
          majorPayoffsJson: endgamePlans.majorPayoffsJson,
        })
        .from(endgamePlans)
        .where(eq(endgamePlans.bookId, bookId))
        .get() as EndgameRow | undefined;

      const bible = decodeContractPayload(contractRow, planRow);
      if (!bible) return null;

      return {
        ...bible,
        characterArcs: graphRepos.characterArcs.listByBook(bookId),
        relationshipEdges: graphRepos.relationshipEdges.listByBook(bookId),
        worldRules: graphRepos.worldRules.listByBook(bookId),
        narrativeThreads: graphRepos.narrativeThreads.listByBook(bookId),
      };
    },
  };
}
