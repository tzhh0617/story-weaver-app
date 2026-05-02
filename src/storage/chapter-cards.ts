import { and, asc, eq, isNull } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import {
  chapterCards,
  chapterCharacterPressures,
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

function mapCard(row: Omit<ChapterCard, 'forbiddenMoves'> & { forbiddenMovesJson: string }) {
  return {
    ...row,
    forbiddenMoves: JSON.parse(row.forbiddenMovesJson) as string[],
  };
}

export function createChapterCardRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  function upsert(card: ChapterCard) {
    drizzleDb
      .insert(chapterCards)
      .values({
        ...card,
        forbiddenMovesJson: JSON.stringify(card.forbiddenMoves),
      })
      .onConflictDoUpdate({
        target: [chapterCards.bookId, chapterCards.volumeIndex, chapterCards.chapterIndex],
        set: {
          title: card.title,
          plotFunction: card.plotFunction,
          povCharacterId: card.povCharacterId ?? null,
          externalConflict: card.externalConflict,
          internalConflict: card.internalConflict,
          relationshipChange: card.relationshipChange,
          worldRuleUsedOrTested: card.worldRuleUsedOrTested,
          informationReveal: card.informationReveal,
          readerReward: card.readerReward,
          endingHook: card.endingHook,
          mustChange: card.mustChange,
          forbiddenMovesJson: JSON.stringify(card.forbiddenMoves),
        },
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
      return drizzleDb
        .select({
          bookId: chapterCards.bookId,
          volumeIndex: chapterCards.volumeIndex,
          chapterIndex: chapterCards.chapterIndex,
          title: chapterCards.title,
          plotFunction: chapterCards.plotFunction,
          povCharacterId: chapterCards.povCharacterId,
          externalConflict: chapterCards.externalConflict,
          internalConflict: chapterCards.internalConflict,
          relationshipChange: chapterCards.relationshipChange,
          worldRuleUsedOrTested: chapterCards.worldRuleUsedOrTested,
          informationReveal: chapterCards.informationReveal,
          readerReward: chapterCards.readerReward,
          endingHook: chapterCards.endingHook,
          mustChange: chapterCards.mustChange,
          forbiddenMovesJson: chapterCards.forbiddenMovesJson,
        })
        .from(chapterCards)
        .where(eq(chapterCards.bookId, bookId))
        .orderBy(asc(chapterCards.volumeIndex), asc(chapterCards.chapterIndex))
        .all()
        .map((row) =>
          mapCard(
            row as Omit<ChapterCard, 'forbiddenMoves'> & { forbiddenMovesJson: string }
          )
        );
    },

    getNextUnwritten(bookId: string): ChapterCard | null {
      const row = drizzleDb
        .select({
          bookId: chapterCards.bookId,
          volumeIndex: chapterCards.volumeIndex,
          chapterIndex: chapterCards.chapterIndex,
          title: chapterCards.title,
          plotFunction: chapterCards.plotFunction,
          povCharacterId: chapterCards.povCharacterId,
          externalConflict: chapterCards.externalConflict,
          internalConflict: chapterCards.internalConflict,
          relationshipChange: chapterCards.relationshipChange,
          worldRuleUsedOrTested: chapterCards.worldRuleUsedOrTested,
          informationReveal: chapterCards.informationReveal,
          readerReward: chapterCards.readerReward,
          endingHook: chapterCards.endingHook,
          mustChange: chapterCards.mustChange,
          forbiddenMovesJson: chapterCards.forbiddenMovesJson,
        })
        .from(chapterCards)
        .leftJoin(
          chapters,
          and(
            eq(chapters.bookId, chapterCards.bookId),
            eq(chapters.volumeIndex, chapterCards.volumeIndex),
            eq(chapters.chapterIndex, chapterCards.chapterIndex)
          )
        )
        .where(and(eq(chapterCards.bookId, bookId), isNull(chapters.content)))
        .orderBy(asc(chapterCards.volumeIndex), asc(chapterCards.chapterIndex))
        .limit(1)
        .get();

      return row
        ? mapCard(
            row as Omit<ChapterCard, 'forbiddenMoves'> & {
              forbiddenMovesJson: string;
            }
          )
        : null;
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
