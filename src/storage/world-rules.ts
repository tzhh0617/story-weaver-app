import { asc, eq } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import { worldRules } from '../db/schema/index.js';
import type { WorldRule } from '../core/narrative/types.js';

export function createWorldRuleRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  return {
    upsertMany(bookId: string, rules: WorldRule[]) {
      for (const rule of rules) {
        drizzleDb
          .insert(worldRules)
          .values({ ...rule, bookId })
          .onConflictDoUpdate({
            target: worldRules.id,
            set: {
              category: rule.category,
              ruleText: rule.ruleText,
              cost: rule.cost,
              whoBenefits: rule.whoBenefits ?? null,
              whoSuffers: rule.whoSuffers ?? null,
              taboo: rule.taboo ?? null,
              violationConsequence: rule.violationConsequence ?? null,
              allowedException: rule.allowedException ?? null,
              currentStatus: rule.currentStatus,
            },
          })
          .run();
      }
    },

    listByBook(bookId: string): WorldRule[] {
      return drizzleDb
        .select({
          id: worldRules.id,
          category: worldRules.category,
          ruleText: worldRules.ruleText,
          cost: worldRules.cost,
          whoBenefits: worldRules.whoBenefits,
          whoSuffers: worldRules.whoSuffers,
          taboo: worldRules.taboo,
          violationConsequence: worldRules.violationConsequence,
          allowedException: worldRules.allowedException,
          currentStatus: worldRules.currentStatus,
        })
        .from(worldRules)
        .where(eq(worldRules.bookId, bookId))
        .orderBy(asc(worldRules.id))
        .all() as WorldRule[];
    },
  };
}
