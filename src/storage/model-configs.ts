import type { Database as SqliteDatabase } from 'better-sqlite3';
import {
  type ModelConfigInput,
  validateModelConfig,
} from '../models/config.js';

export function createModelConfigRepository(db: SqliteDatabase) {
  return {
    save(input: ModelConfigInput) {
      const config = validateModelConfig(input);

      db.prepare(
        `
          INSERT INTO model_configs (
            id,
            provider,
            model_name,
            api_key,
            base_url,
            is_active,
            config_json
          )
          VALUES (
            @id,
            @provider,
            @modelName,
            @apiKey,
            @baseUrl,
            1,
            @configJson
          )
          ON CONFLICT(id) DO UPDATE SET
            provider = excluded.provider,
            model_name = excluded.model_name,
            api_key = excluded.api_key,
            base_url = excluded.base_url,
            is_active = excluded.is_active,
            config_json = excluded.config_json
        `
      ).run({
        ...config,
        configJson: JSON.stringify(config.config),
      });

      return config;
    },

    list(): ModelConfigInput[] {
      const rows = db
        .prepare(
          `
            SELECT
              id,
              provider,
              model_name AS modelName,
              api_key AS apiKey,
              base_url AS baseUrl,
              config_json AS configJson
            FROM model_configs
            WHERE is_active = 1
            ORDER BY id ASC
          `
        )
        .all() as Array<{
        id: string;
        provider: ModelConfigInput['provider'];
        modelName: string;
        apiKey: string;
        baseUrl: string;
        configJson: string;
      }>;

      return rows.map((row) => ({
        id: row.id,
        provider: row.provider,
        modelName: row.modelName,
        apiKey: row.apiKey,
        baseUrl: row.baseUrl,
        config: JSON.parse(row.configJson || '{}') as Record<string, unknown>,
      }));
    },

    getById(id: string) {
      return this.list().find((config) => config.id === id) ?? null;
    },

    delete(id: string) {
      db.prepare('DELETE FROM model_configs WHERE id = ?').run(id);
    },
  };
}
