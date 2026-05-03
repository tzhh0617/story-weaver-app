import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSqliteConnection } from '../../src/db/client';
import { runDrizzleMigrations } from '../../src/db/migrate';
import { createDatabase, createRepositories } from '../../src/storage/database';

describe('createDatabase', () => {
  it('creates the expected tables on first boot', () => {
    const db = createDatabase(':memory:');
    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>;
    const tableNames = rows.map((row) => row.name);

    expect(tableNames).toContain('books');
    expect(tableNames).toContain('writing_progress');
    expect(tableNames).not.toContain('execution_logs');
    expect(tableNames).toContain('model_configs');
  });

  it('tracks applied schema through drizzle migration metadata', () => {
    const db = createDatabase(':memory:');
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'")
      .get() as { name: string } | undefined;

    expect(row?.name).toBe('__drizzle_migrations');
  });

  it('exposes autopilot runtime repositories from the central factory', () => {
    const db = createDatabase(':memory:');
    const repositories = createRepositories(db);

    expect(repositories.bookContracts).toBeDefined();
    expect(repositories.storyLedgers).toBeDefined();
    expect(repositories.storyEvents).toBeDefined();
    expect(repositories.storyCheckpoints).toBeDefined();
  });

  it('saves and loads book contracts through the repository factory', () => {
    const db = createDatabase(':memory:');
    const repositories = createRepositories(db);

    repositories.books.create({
      id: 'book-contract-repo',
      title: 'Contract Repo',
      idea: 'A city taxes memories.',
      targetChapters: 10,
      wordsPerChapter: 2200,
    });

    repositories.bookContracts.save({
      bookId: 'book-contract-repo',
      titlePromise: 'A vow survives the city ledger.',
      corePremise: 'A clerk hunts a stolen promise.',
      mainlinePromise: 'Every chapter tightens the cost of memory.',
      protagonistCoreDesire: 'Restore her family name.',
      protagonistNoDriftRules: ['Never abandon the erased promise.'],
      keyCharacterBoundaries: [
        {
          characterId: 'hero',
          publicPersona: 'Disciplined records clerk',
          hiddenDrive: 'Undo the shame on her house',
          lineWillNotCross: 'Sell out her brother',
          lineMayEventuallyCross: 'Erase her own memory',
        },
      ],
      mandatoryPayoffs: ['The original vow must resurface.'],
      antiDriftRules: ['No easy absolution.'],
      activeTemplate: 'progression',
    });

    expect(repositories.bookContracts.getByBook('book-contract-repo')).toEqual(
      expect.objectContaining({
        bookId: 'book-contract-repo',
        titlePromise: 'A vow survives the city ledger.',
        corePremise: 'A clerk hunts a stolen promise.',
        mainlinePromise: 'Every chapter tightens the cost of memory.',
        protagonistCoreDesire: 'Restore her family name.',
        protagonistNoDriftRules: ['Never abandon the erased promise.'],
        keyCharacterBoundaries: [
          {
            characterId: 'hero',
            publicPersona: 'Disciplined records clerk',
            hiddenDrive: 'Undo the shame on her house',
            lineWillNotCross: 'Sell out her brother',
            lineMayEventuallyCross: 'Erase her own memory',
          },
        ],
        mandatoryPayoffs: ['The original vow must resurface.'],
        antiDriftRules: ['No easy absolution.'],
        activeTemplate: 'progression',
      })
    );
  });

  it('saves ledgers and returns the latest chapter ledger for a book', () => {
    const db = createDatabase(':memory:');
    const repositories = createRepositories(db);

    repositories.books.create({
      id: 'book-ledger-repo',
      title: 'Ledger Repo',
      idea: 'A city taxes memories.',
      targetChapters: 10,
      wordsPerChapter: 2200,
    });

    repositories.storyLedgers.save({
      bookId: 'book-ledger-repo',
      chapterIndex: 1,
      mainlineProgress: 'The investigation opens.',
      activeSubplots: [{ threadId: 'debt', state: 'active', chapterDebt: 1 }],
      openPromises: [
        {
          id: 'promise-1',
          promise: 'Who erased the vow?',
          introducedAt: 1,
          dueBy: 5,
          severity: 'critical',
        },
      ],
      characterTruths: [
        {
          characterId: 'hero',
          currentDesire: 'Protect the family name',
          currentFear: 'Becoming the next erased witness',
          currentMask: 'Professional calm',
          stabilityRisk: 'medium',
        },
      ],
      relationshipDeltas: [
        {
          edgeId: 'hero-brother',
          currentState: 'strained alliance',
          trustLevel: 4,
          tensionLevel: 7,
        },
      ],
      worldFacts: [{ fact: 'Memories can be bartered', status: 'stable' }],
      rhythmPosition: 'setup',
      riskFlags: ['drift-risk-low'],
    });

    repositories.storyLedgers.save({
      bookId: 'book-ledger-repo',
      chapterIndex: 3,
      mainlineProgress: 'The false witness is exposed.',
      activeSubplots: [{ threadId: 'debt', state: 'due_for_payoff', chapterDebt: 3 }],
      openPromises: [
        {
          id: 'promise-1',
          promise: 'Who erased the vow?',
          introducedAt: 1,
          dueBy: 5,
          severity: 'critical',
        },
      ],
      characterTruths: [
        {
          characterId: 'hero',
          currentDesire: 'Expose the broker',
          currentFear: 'Losing the last witness',
          currentMask: 'Cold certainty',
          stabilityRisk: 'high',
        },
      ],
      relationshipDeltas: [
        {
          edgeId: 'hero-brother',
          currentState: 'brittle trust',
          trustLevel: 3,
          tensionLevel: 8,
        },
      ],
      worldFacts: [{ fact: 'The archive can rewrite records', status: 'fragile' }],
      rhythmPosition: 'twist',
      riskFlags: ['payoff-overdue'],
    });

    expect(repositories.storyLedgers.getLatestByBook('book-ledger-repo')).toEqual(
      expect.objectContaining({
        bookId: 'book-ledger-repo',
        chapterIndex: 3,
        mainlineProgress: 'The false witness is exposed.',
        activeSubplots: [{ threadId: 'debt', state: 'due_for_payoff', chapterDebt: 3 }],
        openPromises: [
          {
            id: 'promise-1',
            promise: 'Who erased the vow?',
            introducedAt: 1,
            dueBy: 5,
            severity: 'critical',
          },
        ],
        characterTruths: [
          {
            characterId: 'hero',
            currentDesire: 'Expose the broker',
            currentFear: 'Losing the last witness',
            currentMask: 'Cold certainty',
            stabilityRisk: 'high',
          },
        ],
        relationshipDeltas: [
          {
            edgeId: 'hero-brother',
            currentState: 'brittle trust',
            trustLevel: 3,
            tensionLevel: 8,
          },
        ],
        worldFacts: [{ fact: 'The archive can rewrite records', status: 'fragile' }],
        rhythmPosition: 'twist',
        riskFlags: ['payoff-overdue'],
      })
    );
  });

  it('appends story events and preserves batch order when listing by book', () => {
    const db = createDatabase(':memory:');
    const repositories = createRepositories(db);

    repositories.books.create({
      id: 'book-events-repo',
      title: 'Events Repo',
      idea: 'A city taxes memories.',
      targetChapters: 10,
      wordsPerChapter: 2200,
    });

    repositories.storyEvents.appendMany([
      {
        id: 'z-event',
        bookId: 'book-events-repo',
        chapterIndex: 4,
        eventType: 'relationship_turn',
        summary: 'She finally admits the ledger knows her name.',
        affectedIds: ['hero', 'broker'],
        irreversible: false,
      },
      {
        id: 'a-event',
        bookId: 'book-events-repo',
        chapterIndex: 4,
        eventType: 'cost_paid',
        summary: 'Her brother loses a year of memory.',
        affectedIds: ['brother'],
        irreversible: true,
      },
      {
        id: 'm-event',
        bookId: 'book-events-repo',
        chapterIndex: 5,
        eventType: 'promise_paid',
        summary: 'The first erased vow is restored.',
        affectedIds: ['hero', 'promise-1'],
        irreversible: true,
      },
    ]);

    const events = repositories.storyEvents.listByBook('book-events-repo');

    expect(events.map((event) => event.id)).toEqual(['z-event', 'a-event', 'm-event']);
    expect(events.map((event) => event.eventType)).toEqual([
      'relationship_turn',
      'cost_paid',
      'promise_paid',
    ]);
  });

  it('saves checkpoints and returns the latest checkpoint for a book', () => {
    const db = createDatabase(':memory:');
    const repositories = createRepositories(db);

    repositories.books.create({
      id: 'book-checkpoint-repo',
      title: 'Checkpoint Repo',
      idea: 'A city taxes memories.',
      targetChapters: 10,
      wordsPerChapter: 2200,
    });

    repositories.storyCheckpoints.save({
      bookId: 'book-checkpoint-repo',
      chapterIndex: 4,
      checkpointType: 'light',
      contractDigest: 'contract-v1',
      planDigest: 'plan-v1',
      ledgerDigest: {
        bookId: 'book-checkpoint-repo',
        chapterIndex: 4,
        mainlineProgress: 'The archive points to the broker.',
      },
    });

    repositories.storyCheckpoints.save({
      bookId: 'book-checkpoint-repo',
      chapterIndex: 8,
      checkpointType: 'heavy',
      contractDigest: 'contract-v2',
      planDigest: 'plan-v3',
      ledgerDigest: {
        bookId: 'book-checkpoint-repo',
        chapterIndex: 8,
        mainlineProgress: 'The false archive burns.',
      },
    });

    expect(repositories.storyCheckpoints.getLatestByBook('book-checkpoint-repo')).toEqual(
      expect.objectContaining({
        bookId: 'book-checkpoint-repo',
        chapterIndex: 8,
        checkpointType: 'heavy',
        contractDigest: 'contract-v2',
        planDigest: 'plan-v3',
        ledgerDigest: {
          bookId: 'book-checkpoint-repo',
          chapterIndex: 8,
          mainlineProgress: 'The false archive burns.',
        },
      })
    );
  });

  it('upgrades an existing 0000 database with follow-up writing progress columns', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'story-weaver-migrate-'));
    const dbPath = path.join(tempDir, 'upgrade.sqlite');
    const sqlite = createSqliteConnection(dbPath);

    sqlite.exec(`
      CREATE TABLE books (
        id text PRIMARY KEY NOT NULL,
        title text NOT NULL,
        idea text NOT NULL,
        status text NOT NULL DEFAULT 'creating',
        target_chapters integer NOT NULL DEFAULT 100,
        words_per_chapter integer NOT NULL DEFAULT 2000,
        viral_strategy_json text,
        created_at text NOT NULL,
        updated_at text NOT NULL
      );
      CREATE TABLE writing_progress (
        book_id text PRIMARY KEY NOT NULL,
        current_volume integer,
        current_chapter integer,
        phase text,
        step_label text,
        retry_count integer DEFAULT 0 NOT NULL,
        error_msg text,
        FOREIGN KEY (book_id) REFERENCES books(id) ON UPDATE no action ON DELETE no action
      );
      CREATE TABLE __drizzle_migrations (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        hash text NOT NULL,
        created_at numeric
      );
    `);
    sqlite
      .prepare(
        'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)'
      )
      .run(
        '892c01f94024b80de448e5f2854c2b0e494889f0d3764e96e83b9ff67bcce57c',
        1777745068107
      );
    sqlite.close();

    const migrated = runDrizzleMigrations(dbPath);
    const columns = migrated
      .prepare("PRAGMA table_info('writing_progress')")
      .all() as Array<{ name: string }>;
    const columnNames = columns.map((column) => column.name);

    expect(columnNames).toContain('current_stage');
    expect(columnNames).toContain('current_arc');
    expect(columnNames).toContain('active_task_type');

    migrated.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('upgrades a pre-0002 database with autopilot control-plane schema', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'story-weaver-migrate-'));
    const dbPath = path.join(tempDir, 'upgrade-0002.sqlite');
    const sqlite = createSqliteConnection(dbPath);

    sqlite.exec(`
      CREATE TABLE books (
        id text PRIMARY KEY NOT NULL,
        title text NOT NULL,
        idea text NOT NULL,
        status text NOT NULL DEFAULT 'creating',
        model_id text NOT NULL,
        target_chapters integer NOT NULL,
        words_per_chapter integer NOT NULL,
        viral_strategy_json text,
        created_at text NOT NULL,
        updated_at text NOT NULL
      );
      CREATE TABLE writing_progress (
        book_id text PRIMARY KEY NOT NULL,
        current_volume integer,
        current_chapter integer,
        phase text,
        step_label text,
        retry_count integer DEFAULT 0 NOT NULL,
        error_msg text,
        current_stage integer,
        current_arc integer,
        active_task_type text,
        FOREIGN KEY (book_id) REFERENCES books(id) ON UPDATE no action ON DELETE no action
      );
      CREATE TABLE __drizzle_migrations (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        hash text NOT NULL,
        created_at numeric
      );
    `);
    sqlite
      .prepare(
        'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)'
      )
      .run(
        'df87cbdfc24e6e765f9a4366511404a0972ed6dc',
        1777777056820
      );
    sqlite.close();

    const migrated = runDrizzleMigrations(dbPath);
    const tableRows = migrated
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>;
    const tableNames = tableRows.map((row) => row.name);
    const columns = migrated
      .prepare("PRAGMA table_info('writing_progress')")
      .all() as Array<{ name: string }>;
    const columnNames = columns.map((column) => column.name);

    expect(tableNames).toEqual(
      expect.arrayContaining([
        'book_contracts',
        'story_ledgers',
        'story_events',
        'story_checkpoints',
      ])
    );
    expect(columnNames).toEqual(
      expect.arrayContaining([
        'drift_level',
        'last_healthy_checkpoint_chapter',
        'cooldown_until',
        'starvation_score',
      ])
    );

    migrated.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
