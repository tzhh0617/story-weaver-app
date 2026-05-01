import type { Database as SqliteDatabase } from 'better-sqlite3';

export type CharacterRoleType =
  | 'protagonist'
  | 'deuteragonist'
  | 'supporting'
  | 'antagonist'
  | 'minor';

export type ArcDirection =
  | 'growth'
  | 'fall'
  | 'corruption'
  | 'recovery'
  | 'flat';

export type CharacterArc = {
  id: string;
  name: string;
  roleType: CharacterRoleType;
  desire: string;
  fear: string;
  flaw: string;
  misbelief: string;
  wound: string | null;
  externalGoal: string;
  internalNeed: string;
  arcDirection: ArcDirection;
  decisionLogic: string;
  lineWillNotCross: string | null;
  lineMayEventuallyCross: string | null;
  currentArcPhase: string;
};

export type CharacterStateInput = {
  bookId: string;
  characterId: string;
  characterName: string;
  volumeIndex: number;
  chapterIndex: number;
  location?: string | null;
  status?: string | null;
  knowledge?: string | null;
  emotion?: string | null;
  powerLevel?: string | null;
  arcPhase?: string | null;
};

export type CharacterStateOutput = Required<
  Pick<CharacterStateInput, 'bookId' | 'characterId' | 'characterName' | 'volumeIndex' | 'chapterIndex'>
> &
  Pick<
    CharacterStateInput,
    'location' | 'status' | 'knowledge' | 'emotion' | 'powerLevel' | 'arcPhase'
  >;

export function createCharacterArcRepository(db: SqliteDatabase) {
  return {
    upsertMany(bookId: string, arcs: CharacterArc[]) {
      const statement = db.prepare(
        `
          INSERT INTO character_arcs (
            id, book_id, name, role_type, desire, fear, flaw, misbelief, wound,
            external_goal, internal_need, arc_direction, decision_logic,
            line_will_not_cross, line_may_eventually_cross, current_arc_phase
          )
          VALUES (
            @id, @bookId, @name, @roleType, @desire, @fear, @flaw, @misbelief, @wound,
            @externalGoal, @internalNeed, @arcDirection, @decisionLogic,
            @lineWillNotCross, @lineMayEventuallyCross, @currentArcPhase
          )
          ON CONFLICT(book_id, id) DO UPDATE SET
            name = excluded.name,
            role_type = excluded.role_type,
            desire = excluded.desire,
            fear = excluded.fear,
            flaw = excluded.flaw,
            misbelief = excluded.misbelief,
            wound = excluded.wound,
            external_goal = excluded.external_goal,
            internal_need = excluded.internal_need,
            arc_direction = excluded.arc_direction,
            decision_logic = excluded.decision_logic,
            line_will_not_cross = excluded.line_will_not_cross,
            line_may_eventually_cross = excluded.line_may_eventually_cross,
            current_arc_phase = excluded.current_arc_phase
        `
      );

      for (const arc of arcs) statement.run({ ...arc, bookId });
    },

    listByBook(bookId: string): CharacterArc[] {
      return db
        .prepare(
          `
            SELECT
              id,
              name,
              role_type AS roleType,
              desire,
              fear,
              flaw,
              misbelief,
              wound,
              external_goal AS externalGoal,
              internal_need AS internalNeed,
              arc_direction AS arcDirection,
              decision_logic AS decisionLogic,
              line_will_not_cross AS lineWillNotCross,
              line_may_eventually_cross AS lineMayEventuallyCross,
              current_arc_phase AS currentArcPhase
            FROM character_arcs
            WHERE book_id = ?
            ORDER BY id ASC
          `
        )
        .all(bookId) as CharacterArc[];
    },

    saveState(input: CharacterStateInput) {
      db.prepare(
        `
          INSERT INTO character_states (
            book_id, character_id, character_name, volume_index, chapter_index,
            location, status, knowledge, emotion, power_level, arc_phase
          )
          VALUES (
            @bookId, @characterId, @characterName, @volumeIndex, @chapterIndex,
            @location, @status, @knowledge, @emotion, @powerLevel, @arcPhase
          )
          ON CONFLICT(book_id, character_id, volume_index, chapter_index) DO UPDATE SET
            character_name = excluded.character_name,
            location = excluded.location,
            status = excluded.status,
            knowledge = excluded.knowledge,
            emotion = excluded.emotion,
            power_level = excluded.power_level,
            arc_phase = excluded.arc_phase
        `
      ).run({
        ...input,
        location: input.location ?? null,
        status: input.status ?? null,
        knowledge: input.knowledge ?? null,
        emotion: input.emotion ?? null,
        powerLevel: input.powerLevel ?? null,
        arcPhase: input.arcPhase ?? null,
      });
    },

    listLatestStatesByBook(bookId: string): CharacterStateOutput[] {
      return db
        .prepare(
          `
            SELECT
              latest.book_id AS bookId,
              latest.character_id AS characterId,
              latest.character_name AS characterName,
              latest.volume_index AS volumeIndex,
              latest.chapter_index AS chapterIndex,
              latest.location,
              latest.status,
              latest.knowledge,
              latest.emotion,
              latest.power_level AS powerLevel,
              latest.arc_phase AS arcPhase
            FROM character_states latest
            INNER JOIN (
              SELECT character_id, MAX(volume_index * 100000 + chapter_index) AS latestMarker
              FROM character_states
              WHERE book_id = ?
              GROUP BY character_id
            ) grouped
              ON grouped.character_id = latest.character_id
             AND grouped.latestMarker = (latest.volume_index * 100000 + latest.chapter_index)
            WHERE latest.book_id = ?
            ORDER BY latest.character_id ASC
          `
        )
        .all(bookId, bookId) as CharacterStateOutput[];
    },
  };
}
