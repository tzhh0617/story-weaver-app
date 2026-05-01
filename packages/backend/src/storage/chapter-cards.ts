import type { Database as SqliteDatabase } from 'better-sqlite3';

type ReaderReward =
  | 'reversal'
  | 'breakthrough'
  | 'failure'
  | 'truth'
  | 'upgrade'
  | 'confession'
  | 'dread'
  | 'relief';

type ChapterCard = {
  bookId: string;
  volumeIndex: number;
  chapterIndex: number;
  title: string;
  plotFunction: string;
  povCharacterId: string | null;
  externalConflict: string;
  internalConflict: string;
  relationshipChange: string;
  worldRuleUsedOrTested: string;
  informationReveal: string;
  readerReward: ReaderReward;
  endingHook: string;
  mustChange: string;
  forbiddenMoves: string[];
};

type ThreadAction = 'plant' | 'advance' | 'misdirect' | 'payoff';
type RelationshipAction =
  | 'strain'
  | 'repair'
  | 'betray'
  | 'reveal'
  | 'deepen'
  | 'reverse';

type ChapterThreadAction = {
  bookId: string;
  volumeIndex: number;
  chapterIndex: number;
  threadId: string;
  action: ThreadAction;
  requiredEffect: string;
};

type ChapterCharacterPressure = {
  bookId: string;
  volumeIndex: number;
  chapterIndex: number;
  characterId: string;
  desirePressure: string;
  fearPressure: string;
  flawTrigger: string;
  expectedChoice: string;
};

type ChapterRelationshipAction = {
  bookId: string;
  volumeIndex: number;
  chapterIndex: number;
  relationshipId: string;
  action: RelationshipAction;
  requiredChange: string;
};

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapCard(row: Omit<ChapterCard, 'forbiddenMoves'> & { forbiddenMovesJson: string }) {
  return {
    ...row,
    forbiddenMoves: safeJsonParse<string[]>(row.forbiddenMovesJson, []),
  };
}

export function createChapterCardRepository(db: SqliteDatabase) {
  function upsert(card: ChapterCard) {
    db.prepare(
      `
        INSERT INTO chapter_cards (
          book_id, volume_index, chapter_index, title, plot_function,
          pov_character_id, external_conflict, internal_conflict,
          relationship_change, world_rule_used_or_tested, information_reveal,
          reader_reward, ending_hook, must_change, forbidden_moves_json
        )
        VALUES (
          @bookId, @volumeIndex, @chapterIndex, @title, @plotFunction,
          @povCharacterId, @externalConflict, @internalConflict,
          @relationshipChange, @worldRuleUsedOrTested, @informationReveal,
          @readerReward, @endingHook, @mustChange, @forbiddenMovesJson
        )
        ON CONFLICT(book_id, volume_index, chapter_index) DO UPDATE SET
          title = excluded.title,
          plot_function = excluded.plot_function,
          pov_character_id = excluded.pov_character_id,
          external_conflict = excluded.external_conflict,
          internal_conflict = excluded.internal_conflict,
          relationship_change = excluded.relationship_change,
          world_rule_used_or_tested = excluded.world_rule_used_or_tested,
          information_reveal = excluded.information_reveal,
          reader_reward = excluded.reader_reward,
          ending_hook = excluded.ending_hook,
          must_change = excluded.must_change,
          forbidden_moves_json = excluded.forbidden_moves_json
      `
    ).run({
      ...card,
      forbiddenMovesJson: JSON.stringify(card.forbiddenMoves),
    });

    db.prepare(
      `
        INSERT INTO chapters (
          book_id, volume_index, chapter_index, title, created_at, updated_at
        )
        VALUES (@bookId, @volumeIndex, @chapterIndex, @title, @createdAt, @createdAt)
        ON CONFLICT(book_id, volume_index, chapter_index) DO UPDATE SET
          title = excluded.title,
          updated_at = excluded.updated_at
      `
    ).run({ ...card, createdAt: new Date().toISOString() });
  }

  function selectCards(bookId: string, extraWhere = '') {
    return db
      .prepare(
        `
          SELECT
            book_id AS bookId,
            volume_index AS volumeIndex,
            chapter_index AS chapterIndex,
            title,
            plot_function AS plotFunction,
            pov_character_id AS povCharacterId,
            external_conflict AS externalConflict,
            internal_conflict AS internalConflict,
            relationship_change AS relationshipChange,
            world_rule_used_or_tested AS worldRuleUsedOrTested,
            information_reveal AS informationReveal,
            reader_reward AS readerReward,
            ending_hook AS endingHook,
            must_change AS mustChange,
            forbidden_moves_json AS forbiddenMovesJson
          FROM chapter_cards
          WHERE book_id = ?
          ${extraWhere}
          ORDER BY volume_index ASC, chapter_index ASC
        `
      )
      .all(bookId) as Array<
      Omit<ChapterCard, 'forbiddenMoves'> & { forbiddenMovesJson: string }
    >;
  }

  return {
    upsert,

    upsertMany(cards: ChapterCard[]) {
      for (const card of cards) upsert(card);
    },

    listByBook(bookId: string): ChapterCard[] {
      return selectCards(bookId).map(mapCard);
    },

    getNextUnwritten(bookId: string): ChapterCard | null {
      const rows = db
        .prepare(
          `
            SELECT
              cards.book_id AS bookId,
              cards.volume_index AS volumeIndex,
              cards.chapter_index AS chapterIndex,
              cards.title,
              cards.plot_function AS plotFunction,
              cards.pov_character_id AS povCharacterId,
              cards.external_conflict AS externalConflict,
              cards.internal_conflict AS internalConflict,
              cards.relationship_change AS relationshipChange,
              cards.world_rule_used_or_tested AS worldRuleUsedOrTested,
              cards.information_reveal AS informationReveal,
              cards.reader_reward AS readerReward,
              cards.ending_hook AS endingHook,
              cards.must_change AS mustChange,
              cards.forbidden_moves_json AS forbiddenMovesJson
            FROM chapter_cards cards
            LEFT JOIN chapters
              ON chapters.book_id = cards.book_id
             AND chapters.volume_index = cards.volume_index
             AND chapters.chapter_index = cards.chapter_index
            WHERE cards.book_id = ? AND chapters.content IS NULL
            ORDER BY cards.volume_index ASC, cards.chapter_index ASC
            LIMIT 1
          `
        )
        .all(bookId) as Array<
        Omit<ChapterCard, 'forbiddenMoves'> & { forbiddenMovesJson: string }
      >;

      return rows[0] ? mapCard(rows[0]) : null;
    },

    upsertThreadActions(
      bookId: string,
      volumeIndex: number,
      chapterIndex: number,
      actions: ChapterThreadAction[]
    ) {
      db.prepare(
        'DELETE FROM chapter_thread_actions WHERE book_id = ? AND volume_index = ? AND chapter_index = ?'
      ).run(bookId, volumeIndex, chapterIndex);
      const statement = db.prepare(
        `
          INSERT INTO chapter_thread_actions (
            book_id, volume_index, chapter_index, thread_id, action, required_effect
          )
          VALUES (
            @bookId, @volumeIndex, @chapterIndex, @threadId, @action, @requiredEffect
          )
        `
      );
      for (const action of actions) {
        statement.run({ ...action, bookId, volumeIndex, chapterIndex });
      }
    },

    listThreadActions(
      bookId: string,
      volumeIndex: number,
      chapterIndex: number
    ): ChapterThreadAction[] {
      return db
        .prepare(
          `
            SELECT
              book_id AS bookId,
              volume_index AS volumeIndex,
              chapter_index AS chapterIndex,
              thread_id AS threadId,
              action,
              required_effect AS requiredEffect
            FROM chapter_thread_actions
            WHERE book_id = ? AND volume_index = ? AND chapter_index = ?
            ORDER BY thread_id ASC, action ASC
          `
        )
        .all(bookId, volumeIndex, chapterIndex) as ChapterThreadAction[];
    },

    upsertCharacterPressures(
      bookId: string,
      volumeIndex: number,
      chapterIndex: number,
      pressures: ChapterCharacterPressure[]
    ) {
      db.prepare(
        'DELETE FROM chapter_character_pressures WHERE book_id = ? AND volume_index = ? AND chapter_index = ?'
      ).run(bookId, volumeIndex, chapterIndex);
      const statement = db.prepare(
        `
          INSERT INTO chapter_character_pressures (
            book_id, volume_index, chapter_index, character_id, desire_pressure,
            fear_pressure, flaw_trigger, expected_choice
          )
          VALUES (
            @bookId, @volumeIndex, @chapterIndex, @characterId, @desirePressure,
            @fearPressure, @flawTrigger, @expectedChoice
          )
        `
      );
      for (const pressure of pressures) {
        statement.run({ ...pressure, bookId, volumeIndex, chapterIndex });
      }
    },

    listCharacterPressures(
      bookId: string,
      volumeIndex: number,
      chapterIndex: number
    ): ChapterCharacterPressure[] {
      return db
        .prepare(
          `
            SELECT
              book_id AS bookId,
              volume_index AS volumeIndex,
              chapter_index AS chapterIndex,
              character_id AS characterId,
              desire_pressure AS desirePressure,
              fear_pressure AS fearPressure,
              flaw_trigger AS flawTrigger,
              expected_choice AS expectedChoice
            FROM chapter_character_pressures
            WHERE book_id = ? AND volume_index = ? AND chapter_index = ?
            ORDER BY character_id ASC
          `
        )
        .all(bookId, volumeIndex, chapterIndex) as ChapterCharacterPressure[];
    },

    upsertRelationshipActions(
      bookId: string,
      volumeIndex: number,
      chapterIndex: number,
      actions: ChapterRelationshipAction[]
    ) {
      db.prepare(
        'DELETE FROM chapter_relationship_actions WHERE book_id = ? AND volume_index = ? AND chapter_index = ?'
      ).run(bookId, volumeIndex, chapterIndex);
      const statement = db.prepare(
        `
          INSERT INTO chapter_relationship_actions (
            book_id, volume_index, chapter_index, relationship_id, action, required_change
          )
          VALUES (
            @bookId, @volumeIndex, @chapterIndex, @relationshipId, @action, @requiredChange
          )
        `
      );
      for (const action of actions) {
        statement.run({ ...action, bookId, volumeIndex, chapterIndex });
      }
    },

    listRelationshipActions(
      bookId: string,
      volumeIndex: number,
      chapterIndex: number
    ): ChapterRelationshipAction[] {
      return db
        .prepare(
          `
            SELECT
              book_id AS bookId,
              volume_index AS volumeIndex,
              chapter_index AS chapterIndex,
              relationship_id AS relationshipId,
              action,
              required_change AS requiredChange
            FROM chapter_relationship_actions
            WHERE book_id = ? AND volume_index = ? AND chapter_index = ?
            ORDER BY relationship_id ASC, action ASC
          `
        )
        .all(bookId, volumeIndex, chapterIndex) as ChapterRelationshipAction[];
    },
  };
}
