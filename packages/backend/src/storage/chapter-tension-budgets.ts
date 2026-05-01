import type { Database as SqliteDatabase } from 'better-sqlite3';

type TensionPressureLevel = 'low' | 'medium' | 'high' | 'peak';
type DominantTension =
  | 'danger'
  | 'desire'
  | 'relationship'
  | 'mystery'
  | 'moral_choice'
  | 'deadline'
  | 'status_loss'
  | 'resource_cost';

type ChapterTensionBudget = {
  bookId: string;
  volumeIndex: number;
  chapterIndex: number;
  pressureLevel: TensionPressureLevel;
  dominantTension: DominantTension;
  requiredTurn: string;
  forcedChoice: string;
  costToPay: string;
  irreversibleChange: string;
  readerQuestion: string;
  hookPressure: string;
  flatnessRisks: string[];
};

type TensionBudgetRow = Omit<ChapterTensionBudget, 'flatnessRisks'> & {
  flatnessRisksJson: string;
};

function mapBudget(row: TensionBudgetRow): ChapterTensionBudget {
  return {
    ...row,
    flatnessRisks: JSON.parse(row.flatnessRisksJson) as string[],
  };
}

export function createChapterTensionBudgetRepository(db: SqliteDatabase) {
  function upsert(budget: ChapterTensionBudget) {
    db.prepare(
      `
        INSERT INTO chapter_tension_budgets (
          book_id, volume_index, chapter_index, pressure_level, dominant_tension,
          required_turn, forced_choice, cost_to_pay, irreversible_change,
          reader_question, hook_pressure, flatness_risks_json, updated_at
        )
        VALUES (
          @bookId, @volumeIndex, @chapterIndex, @pressureLevel, @dominantTension,
          @requiredTurn, @forcedChoice, @costToPay, @irreversibleChange,
          @readerQuestion, @hookPressure, @flatnessRisksJson, @updatedAt
        )
        ON CONFLICT(book_id, volume_index, chapter_index) DO UPDATE SET
          pressure_level = excluded.pressure_level,
          dominant_tension = excluded.dominant_tension,
          required_turn = excluded.required_turn,
          forced_choice = excluded.forced_choice,
          cost_to_pay = excluded.cost_to_pay,
          irreversible_change = excluded.irreversible_change,
          reader_question = excluded.reader_question,
          hook_pressure = excluded.hook_pressure,
          flatness_risks_json = excluded.flatness_risks_json,
          updated_at = excluded.updated_at
      `
    ).run({
      ...budget,
      flatnessRisksJson: JSON.stringify(budget.flatnessRisks),
      updatedAt: new Date().toISOString(),
    });
  }

  function selectBudgets(bookId: string, extraWhere = '', params: unknown[] = []) {
    return db
      .prepare(
        `
          SELECT
            book_id AS bookId,
            volume_index AS volumeIndex,
            chapter_index AS chapterIndex,
            pressure_level AS pressureLevel,
            dominant_tension AS dominantTension,
            required_turn AS requiredTurn,
            forced_choice AS forcedChoice,
            cost_to_pay AS costToPay,
            irreversible_change AS irreversibleChange,
            reader_question AS readerQuestion,
            hook_pressure AS hookPressure,
            flatness_risks_json AS flatnessRisksJson
          FROM chapter_tension_budgets
          WHERE book_id = ?
          ${extraWhere}
          ORDER BY volume_index ASC, chapter_index ASC
        `
      )
      .all(bookId, ...params) as TensionBudgetRow[];
  }

  return {
    upsert,

    upsertMany(budgets: ChapterTensionBudget[]) {
      for (const budget of budgets) upsert(budget);
    },

    getByChapter(
      bookId: string,
      volumeIndex: number,
      chapterIndex: number
    ): ChapterTensionBudget | null {
      const [row] = selectBudgets(
        bookId,
        'AND volume_index = ? AND chapter_index = ?',
        [volumeIndex, chapterIndex]
      );

      return row ? mapBudget(row) : null;
    },

    listByBook(bookId: string): ChapterTensionBudget[] {
      return selectBudgets(bookId).map(mapBudget);
    },

    clearByBook(bookId: string) {
      db.prepare('DELETE FROM chapter_tension_budgets WHERE book_id = ?').run(
        bookId
      );
    },

    deleteByBook(bookId: string) {
      db.prepare('DELETE FROM chapter_tension_budgets WHERE book_id = ?').run(
        bookId
      );
    },
  };
}
