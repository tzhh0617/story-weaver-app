import type { Database as SqliteDatabase } from 'better-sqlite3';
import type { WorldRule } from '../core/narrative/types.js';

export function createWorldRuleRepository(db: SqliteDatabase) {
  return {
    upsertMany(bookId: string, rules: WorldRule[]) {
      const statement = db.prepare(
        `
          INSERT INTO world_rules (
            id, book_id, category, rule_text, cost, who_benefits, who_suffers,
            taboo, violation_consequence, allowed_exception, current_status
          )
          VALUES (
            @id, @bookId, @category, @ruleText, @cost, @whoBenefits, @whoSuffers,
            @taboo, @violationConsequence, @allowedException, @currentStatus
          )
          ON CONFLICT(book_id, id) DO UPDATE SET
            category = excluded.category,
            rule_text = excluded.rule_text,
            cost = excluded.cost,
            who_benefits = excluded.who_benefits,
            who_suffers = excluded.who_suffers,
            taboo = excluded.taboo,
            violation_consequence = excluded.violation_consequence,
            allowed_exception = excluded.allowed_exception,
            current_status = excluded.current_status
        `
      );

      for (const rule of rules) statement.run({ ...rule, bookId });
    },

    listByBook(bookId: string): WorldRule[] {
      return db
        .prepare(
          `
            SELECT
              id,
              category,
              rule_text AS ruleText,
              cost,
              who_benefits AS whoBenefits,
              who_suffers AS whoSuffers,
              taboo,
              violation_consequence AS violationConsequence,
              allowed_exception AS allowedException,
              current_status AS currentStatus
            FROM world_rules
            WHERE book_id = ?
            ORDER BY id ASC
          `
        )
        .all(bookId) as WorldRule[];
    },
  };
}
