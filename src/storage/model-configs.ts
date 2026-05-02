import { asc, eq, ne } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import { modelConfigs } from '../db/schema/index.js';
import {
  type ModelConfigInput,
  validateModelConfig,
} from '../models/config.js';

export function createModelConfigRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  return {
    save(input: ModelConfigInput) {
      const config = validateModelConfig(input);

      drizzleDb.delete(modelConfigs).where(ne(modelConfigs.id, config.id)).run();

      drizzleDb
        .insert(modelConfigs)
        .values({
          id: config.id,
          provider: config.provider,
          modelName: config.modelName,
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          isActive: 1,
          configJson: JSON.stringify(config.config),
        })
        .onConflictDoUpdate({
          target: modelConfigs.id,
          set: {
            provider: config.provider,
            modelName: config.modelName,
            apiKey: config.apiKey,
            baseUrl: config.baseUrl,
            isActive: 1,
            configJson: JSON.stringify(config.config),
          },
        })
        .run();

      return config;
    },

    list(): ModelConfigInput[] {
      const rows = drizzleDb
        .select({
          id: modelConfigs.id,
          provider: modelConfigs.provider,
          modelName: modelConfigs.modelName,
          apiKey: modelConfigs.apiKey,
          baseUrl: modelConfigs.baseUrl,
          configJson: modelConfigs.configJson,
        })
        .from(modelConfigs)
        .where(eq(modelConfigs.isActive, 1))
        .orderBy(asc(modelConfigs.id))
        .limit(1)
        .all() as Array<{
        id: string;
        provider: ModelConfigInput['provider'];
        modelName: string;
        apiKey: string | null;
        baseUrl: string | null;
        configJson: string;
      }>;

      return rows.map((row) => ({
        id: row.id,
        provider: row.provider,
        modelName: row.modelName,
        apiKey: row.apiKey ?? '',
        baseUrl: row.baseUrl ?? '',
        config: JSON.parse(row.configJson || '{}') as Record<string, unknown>,
      }));
    },

    getById(id: string) {
      const row = drizzleDb
        .select({
          id: modelConfigs.id,
          provider: modelConfigs.provider,
          modelName: modelConfigs.modelName,
          apiKey: modelConfigs.apiKey,
          baseUrl: modelConfigs.baseUrl,
          configJson: modelConfigs.configJson,
        })
        .from(modelConfigs)
        .where(eq(modelConfigs.id, id))
        .get();

      if (!row) {
        return null;
      }

      return {
        id: row.id,
        provider: row.provider,
        modelName: row.modelName,
        apiKey: row.apiKey ?? '',
        baseUrl: row.baseUrl ?? '',
        config: JSON.parse(row.configJson || '{}') as Record<string, unknown>,
      };
    },
  };
}
