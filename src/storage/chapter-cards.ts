import { and, asc, eq, isNull } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import {
  chapterCharacterPressures,
  chapterPlans,
  chapterRelationshipActions,
  chapterThreadActions,
  chapters,
} from '../db/schema/index.js';
import type {
  ChapterCard,
  ChapterCharacterPressure,
  ChapterRelationshipAction,
  ChapterThreadAction,
} from '../core/narrative/types.js';

type ChapterCardBridgePayload = Omit<
  ChapterCard,
  'bookId' | 'volumeIndex' | 'chapterIndex' | 'forbiddenMoves'
> & {
  forbiddenMoves: string[];
};

function encodeCardPayload(card: ChapterCard): ChapterCardBridgePayload {
  return {
    title: card.title,
    plotFunction: card.plotFunction,
    povCharacterId: card.povCharacterId,
    externalConflict: card.externalConflict,
    internalConflict: card.internalConflict,
    relationshipChange: card.relationshipChange,
    worldRuleUsedOrTested: card.worldRuleUsedOrTested,
    informationReveal: card.informationReveal,
    readerReward: card.readerReward,
    endingHook: card.endingHook,
    mustChange: card.mustChange,
    forbiddenMoves: card.forbiddenMoves,
  };
}

function decodeCardRow(row: {
  bookId: string;
  batchIndex: number;
  chapterIndex: number;
  goal: string;
  conflict: string;
  pressureSource: string;
  changeType: string;
  threadActionsJson: string;
  reveal: string;
  payoffOrCost: string;
  endingHook: string;
  titleIdeaLink: string;
  batchGoal: string;
  forbiddenDriftJson: string;
}): ChapterCard {
  const payload = JSON.parse(row.threadActionsJson) as ChapterCardBridgePayload;
  const forbiddenMoves = JSON.parse(row.forbiddenDriftJson) as string[];

  return {
    bookId: row.bookId,
    volumeIndex: row.batchIndex,
    chapterIndex: row.chapterIndex,
    title: payload.title,
    plotFunction: payload.plotFunction ?? row.goal,
    povCharacterId: payload.povCharacterId ?? null,
    externalConflict: payload.externalConflict ?? row.conflict,
    internalConflict: payload.internalConflict ?? row.pressureSource,
    relationshipChange: payload.relationshipChange ?? row.changeType,
    worldRuleUsedOrTested: payload.worldRuleUsedOrTested ?? row.titleIdeaLink,
    informationReveal: payload.informationReveal ?? row.reveal,
    readerReward: payload.readerReward,
    endingHook: payload.endingHook ?? row.endingHook,
    mustChange: payload.mustChange ?? row.payoffOrCost,
    forbiddenMoves: payload.forbiddenMoves ?? forbiddenMoves,
  };
}

function chapterPlanValues(card: ChapterCard) {
  return {
    bookId: card.bookId,
    batchIndex: card.volumeIndex,
    chapterIndex: card.chapterIndex,
    arcIndex: card.volumeIndex,
    goal: card.plotFunction,
    conflict: card.externalConflict,
    pressureSource: card.internalConflict,
    changeType: card.relationshipChange,
    threadActionsJson: JSON.stringify(encodeCardPayload(card)),
    reveal: card.informationReveal,
    payoffOrCost: card.mustChange,
    endingHook: card.endingHook,
    titleIdeaLink: card.worldRuleUsedOrTested,
    batchGoal: card.title,
    requiredPayoffsJson: JSON.stringify([card.readerReward]),
    forbiddenDriftJson: JSON.stringify(card.forbiddenMoves),
    status: 'planned' as const,
  };
}

export function createChapterCardRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  function upsert(card: ChapterCard) {
    const planValues = chapterPlanValues(card);
    drizzleDb
      .insert(chapterPlans)
      .values(planValues)
      .onConflictDoUpdate({
        target: [chapterPlans.bookId, chapterPlans.chapterIndex],
        set: planValues,
      })
      .run();

    const createdAt = new Date().toISOString();
    drizzleDb
      .insert(chapters)
      .values({
        bookId: card.bookId,
        volumeIndex: card.volumeIndex,
        chapterIndex: card.chapterIndex,
        title: card.title,
        createdAt,
        updatedAt: createdAt,
      })
      .onConflictDoUpdate({
        target: [chapters.bookId, chapters.volumeIndex, chapters.chapterIndex],
        set: {
          title: card.title,
          updatedAt: createdAt,
        },
      })
      .run();
  }

  return {
    upsert,

    upsertMany(cards: ChapterCard[]) {
      for (const card of cards) upsert(card);
    },

    listByBook(bookId: string): ChapterCard[] {
      const rows = drizzleDb
        .select({
          bookId: chapterPlans.bookId,
          batchIndex: chapterPlans.batchIndex,
          chapterIndex: chapterPlans.chapterIndex,
          goal: chapterPlans.goal,
          conflict: chapterPlans.conflict,
          pressureSource: chapterPlans.pressureSource,
          changeType: chapterPlans.changeType,
          threadActionsJson: chapterPlans.threadActionsJson,
          reveal: chapterPlans.reveal,
          payoffOrCost: chapterPlans.payoffOrCost,
          endingHook: chapterPlans.endingHook,
          titleIdeaLink: chapterPlans.titleIdeaLink,
          batchGoal: chapterPlans.batchGoal,
          forbiddenDriftJson: chapterPlans.forbiddenDriftJson,
        })
        .from(chapterPlans)
        .where(eq(chapterPlans.bookId, bookId))
        .orderBy(asc(chapterPlans.batchIndex), asc(chapterPlans.chapterIndex))
        .all() as Array<{
        bookId: string;
        batchIndex: number;
        chapterIndex: number;
        goal: string;
        conflict: string;
        pressureSource: string;
        changeType: string;
        threadActionsJson: string;
        reveal: string;
        payoffOrCost: string;
        endingHook: string;
        titleIdeaLink: string;
        batchGoal: string;
        forbiddenDriftJson: string;
      }>;

      return rows.map(decodeCardRow);
    },

    getNextUnwritten(bookId: string): ChapterCard | null {
      const row = drizzleDb
        .select({
          bookId: chapterPlans.bookId,
          batchIndex: chapterPlans.batchIndex,
          chapterIndex: chapterPlans.chapterIndex,
          goal: chapterPlans.goal,
          conflict: chapterPlans.conflict,
          pressureSource: chapterPlans.pressureSource,
          changeType: chapterPlans.changeType,
          threadActionsJson: chapterPlans.threadActionsJson,
          reveal: chapterPlans.reveal,
          payoffOrCost: chapterPlans.payoffOrCost,
          endingHook: chapterPlans.endingHook,
          titleIdeaLink: chapterPlans.titleIdeaLink,
          batchGoal: chapterPlans.batchGoal,
          forbiddenDriftJson: chapterPlans.forbiddenDriftJson,
        })
        .from(chapterPlans)
        .leftJoin(
          chapters,
          and(
            eq(chapters.bookId, chapterPlans.bookId),
            eq(chapters.volumeIndex, chapterPlans.batchIndex),
            eq(chapters.chapterIndex, chapterPlans.chapterIndex)
          )
        )
        .where(and(eq(chapterPlans.bookId, bookId), isNull(chapters.content)))
        .orderBy(asc(chapterPlans.batchIndex), asc(chapterPlans.chapterIndex))
        .limit(1)
        .get() as
        | {
            bookId: string;
            batchIndex: number;
            chapterIndex: number;
            goal: string;
            conflict: string;
            pressureSource: string;
            changeType: string;
            threadActionsJson: string;
            reveal: string;
            payoffOrCost: string;
            endingHook: string;
            titleIdeaLink: string;
            batchGoal: string;
            forbiddenDriftJson: string;
          }
        | undefined;

      return row ? decodeCardRow(row) : null;
    },

    upsertThreadActions(
      bookId: string,
      volumeIndex: number,
      chapterIndex: number,
      actions: ChapterThreadAction[]
    ) {
      drizzleDb
        .delete(chapterThreadActions)
        .where(
          and(
            eq(chapterThreadActions.bookId, bookId),
            eq(chapterThreadActions.volumeIndex, volumeIndex),
            eq(chapterThreadActions.chapterIndex, chapterIndex)
          )
        )
        .run();

      for (const action of actions) {
        drizzleDb.insert(chapterThreadActions).values(action).run();
      }
    },

    listThreadActions(
      bookId: string,
      volumeIndex: number,
      chapterIndex: number
    ): ChapterThreadAction[] {
      return drizzleDb
        .select({
          bookId: chapterThreadActions.bookId,
          volumeIndex: chapterThreadActions.volumeIndex,
          chapterIndex: chapterThreadActions.chapterIndex,
          threadId: chapterThreadActions.threadId,
          action: chapterThreadActions.action,
          requiredEffect: chapterThreadActions.requiredEffect,
        })
        .from(chapterThreadActions)
        .where(
          and(
            eq(chapterThreadActions.bookId, bookId),
            eq(chapterThreadActions.volumeIndex, volumeIndex),
            eq(chapterThreadActions.chapterIndex, chapterIndex)
          )
        )
        .orderBy(asc(chapterThreadActions.threadId), asc(chapterThreadActions.action))
        .all() as ChapterThreadAction[];
    },

    upsertCharacterPressures(
      bookId: string,
      volumeIndex: number,
      chapterIndex: number,
      pressures: ChapterCharacterPressure[]
    ) {
      drizzleDb
        .delete(chapterCharacterPressures)
        .where(
          and(
            eq(chapterCharacterPressures.bookId, bookId),
            eq(chapterCharacterPressures.volumeIndex, volumeIndex),
            eq(chapterCharacterPressures.chapterIndex, chapterIndex)
          )
        )
        .run();

      for (const pressure of pressures) {
        drizzleDb.insert(chapterCharacterPressures).values(pressure).run();
      }
    },

    listCharacterPressures(
      bookId: string,
      volumeIndex: number,
      chapterIndex: number
    ): ChapterCharacterPressure[] {
      return drizzleDb
        .select({
          bookId: chapterCharacterPressures.bookId,
          volumeIndex: chapterCharacterPressures.volumeIndex,
          chapterIndex: chapterCharacterPressures.chapterIndex,
          characterId: chapterCharacterPressures.characterId,
          desirePressure: chapterCharacterPressures.desirePressure,
          fearPressure: chapterCharacterPressures.fearPressure,
          flawTrigger: chapterCharacterPressures.flawTrigger,
          expectedChoice: chapterCharacterPressures.expectedChoice,
        })
        .from(chapterCharacterPressures)
        .where(
          and(
            eq(chapterCharacterPressures.bookId, bookId),
            eq(chapterCharacterPressures.volumeIndex, volumeIndex),
            eq(chapterCharacterPressures.chapterIndex, chapterIndex)
          )
        )
        .orderBy(asc(chapterCharacterPressures.characterId))
        .all() as ChapterCharacterPressure[];
    },

    upsertRelationshipActions(
      bookId: string,
      volumeIndex: number,
      chapterIndex: number,
      actions: ChapterRelationshipAction[]
    ) {
      drizzleDb
        .delete(chapterRelationshipActions)
        .where(
          and(
            eq(chapterRelationshipActions.bookId, bookId),
            eq(chapterRelationshipActions.volumeIndex, volumeIndex),
            eq(chapterRelationshipActions.chapterIndex, chapterIndex)
          )
        )
        .run();

      for (const action of actions) {
        drizzleDb.insert(chapterRelationshipActions).values(action).run();
      }
    },

    listRelationshipActions(
      bookId: string,
      volumeIndex: number,
      chapterIndex: number
    ): ChapterRelationshipAction[] {
      return drizzleDb
        .select({
          bookId: chapterRelationshipActions.bookId,
          volumeIndex: chapterRelationshipActions.volumeIndex,
          chapterIndex: chapterRelationshipActions.chapterIndex,
          relationshipId: chapterRelationshipActions.relationshipId,
          action: chapterRelationshipActions.action,
          requiredChange: chapterRelationshipActions.requiredChange,
        })
        .from(chapterRelationshipActions)
        .where(
          and(
            eq(chapterRelationshipActions.bookId, bookId),
            eq(chapterRelationshipActions.volumeIndex, volumeIndex),
            eq(chapterRelationshipActions.chapterIndex, chapterIndex)
          )
        )
        .orderBy(
          asc(chapterRelationshipActions.relationshipId),
          asc(chapterRelationshipActions.action)
        )
        .all() as ChapterRelationshipAction[];
    },
  };
}
