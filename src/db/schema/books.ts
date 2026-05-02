import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const books = sqliteTable('books', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  idea: text('idea').notNull(),
  status: text('status').notNull().default('creating'),
  modelId: text('model_id').notNull(),
  targetChapters: integer('target_chapters').notNull(),
  wordsPerChapter: integer('words_per_chapter').notNull(),
  viralStrategyJson: text('viral_strategy_json'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const bookContext = sqliteTable('book_context', {
  bookId: text('book_id')
    .primaryKey()
    .references(() => books.id),
  worldSetting: text('world_setting'),
  outline: text('outline'),
  styleGuide: text('style_guide'),
});

export const worldSettings = sqliteTable(
  'world_settings',
  {
    bookId: text('book_id')
      .notNull()
      .references(() => books.id),
    category: text('category').notNull(),
    key: text('key').notNull(),
    content: text('content').notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.bookId, table.category, table.key],
    }),
  })
);
