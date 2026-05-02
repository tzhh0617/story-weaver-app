import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: './.tmp/story-weaver-plan.sqlite',
  },
  strict: true,
  verbose: true,
});
