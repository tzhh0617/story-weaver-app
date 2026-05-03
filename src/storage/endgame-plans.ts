import { eq } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import { endgamePlans } from '../db/schema/index.js';

type CompatibleCoreCharacterOutcomes = {
  protagonistLoses: string;
  relationshipOutcome: string;
  plannerCoreCharacterOutcomes: unknown;
};

type CompatibleMajorPayoffs = {
  themeAnswer: string | null;
  plannerMajorPayoffs: unknown;
};

function encodeCoreCharacterOutcomes(input: {
  coreCharacterOutcomes: unknown;
  finalConflict: string;
  finalOpponent: string;
}) {
  const plannerValue = input.coreCharacterOutcomes;
  const plannerRecord =
    plannerValue && typeof plannerValue === 'object' && !Array.isArray(plannerValue)
      ? (plannerValue as Record<string, unknown>)
      : null;

  const payload: CompatibleCoreCharacterOutcomes = {
    protagonistLoses:
      typeof plannerRecord?.protagonistLoses === 'string'
        ? plannerRecord.protagonistLoses
        : input.finalConflict,
    relationshipOutcome:
      typeof plannerRecord?.relationshipOutcome === 'string'
        ? plannerRecord.relationshipOutcome
        : input.finalOpponent,
    plannerCoreCharacterOutcomes: plannerValue,
  };

  return JSON.stringify(payload);
}

function encodeMajorPayoffs(input: { majorPayoffs: unknown; worldEndState: string }) {
  const plannerValue = input.majorPayoffs;
  const plannerRecord =
    plannerValue && typeof plannerValue === 'object' && !Array.isArray(plannerValue)
      ? (plannerValue as Record<string, unknown>)
      : null;

  const payload: CompatibleMajorPayoffs = {
    themeAnswer:
      typeof plannerRecord?.themeAnswer === 'string'
        ? plannerRecord.themeAnswer
        : null,
    plannerMajorPayoffs: plannerValue,
  };

  return JSON.stringify(payload);
}

function decodeCoreCharacterOutcomes(value: string) {
  const parsed = JSON.parse(value) as
    | CompatibleCoreCharacterOutcomes
    | Record<string, unknown>
    | unknown[];

  if (
    parsed &&
    typeof parsed === 'object' &&
    'plannerCoreCharacterOutcomes' in parsed
  ) {
    return parsed.plannerCoreCharacterOutcomes;
  }

  return parsed;
}

function decodeMajorPayoffs(value: string) {
  const parsed = JSON.parse(value) as CompatibleMajorPayoffs | Record<string, unknown> | unknown[];

  if (parsed && typeof parsed === 'object' && 'plannerMajorPayoffs' in parsed) {
    return parsed.plannerMajorPayoffs;
  }

  return parsed;
}

export function createEndgamePlanRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  return {
    save(input: {
      bookId: string;
      titleIdeaContract: string;
      protagonistEndState: string;
      finalConflict: string;
      finalOpponent: string;
      worldEndState: string;
      coreCharacterOutcomes: unknown;
      majorPayoffs: unknown;
    }) {
      const now = new Date().toISOString();

      drizzleDb
        .insert(endgamePlans)
        .values({
          bookId: input.bookId,
          titleIdeaContract: input.titleIdeaContract,
          protagonistEndState: input.protagonistEndState,
          finalConflict: input.finalConflict,
          finalOpponent: input.finalOpponent,
          worldEndState: input.worldEndState,
          coreCharacterOutcomesJson: encodeCoreCharacterOutcomes(input),
          majorPayoffsJson: encodeMajorPayoffs(input),
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: endgamePlans.bookId,
          set: {
            titleIdeaContract: input.titleIdeaContract,
            protagonistEndState: input.protagonistEndState,
            finalConflict: input.finalConflict,
            finalOpponent: input.finalOpponent,
            worldEndState: input.worldEndState,
            coreCharacterOutcomesJson: encodeCoreCharacterOutcomes(input),
            majorPayoffsJson: encodeMajorPayoffs(input),
            updatedAt: now,
          },
        })
        .run();
    },

    getByBook(bookId: string) {
      const row = drizzleDb
        .select({
          bookId: endgamePlans.bookId,
          titleIdeaContract: endgamePlans.titleIdeaContract,
          protagonistEndState: endgamePlans.protagonistEndState,
          finalConflict: endgamePlans.finalConflict,
          finalOpponent: endgamePlans.finalOpponent,
          worldEndState: endgamePlans.worldEndState,
          coreCharacterOutcomesJson: endgamePlans.coreCharacterOutcomesJson,
          majorPayoffsJson: endgamePlans.majorPayoffsJson,
          createdAt: endgamePlans.createdAt,
          updatedAt: endgamePlans.updatedAt,
        })
        .from(endgamePlans)
        .where(eq(endgamePlans.bookId, bookId))
        .get() as
        | {
            bookId: string;
            titleIdeaContract: string;
            protagonistEndState: string;
            finalConflict: string;
            finalOpponent: string;
            worldEndState: string;
            coreCharacterOutcomesJson: string;
            majorPayoffsJson: string;
            createdAt: string;
            updatedAt: string;
          }
        | undefined;

      if (!row) {
        return null;
      }

      return {
        bookId: row.bookId,
        titleIdeaContract: row.titleIdeaContract,
        protagonistEndState: row.protagonistEndState,
        finalConflict: row.finalConflict,
        finalOpponent: row.finalOpponent,
        worldEndState: row.worldEndState,
        coreCharacterOutcomes: decodeCoreCharacterOutcomes(row.coreCharacterOutcomesJson),
        majorPayoffs: decodeMajorPayoffs(row.majorPayoffsJson),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    },
  };
}
