import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDatabase, createRepositories } from '../../src/storage/database';
import { createBookRepository } from '../../src/storage/books';
import { createChapterCardRepository } from '../../src/storage/chapter-cards';
import { createChapterRepository } from '../../src/storage/chapters';

describe('book repository', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists books by creation time descending even when an older book is updated', () => {
    const db = createDatabase(':memory:');
    const repo = createBookRepository(db);

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-28T10:00:00.000Z'));
    repo.create({
      id: 'book-1',
      title: 'Book 1',
      idea: 'A city remembers every promise.',
      targetChapters: 500,
      wordsPerChapter: 2500,
    });

    vi.setSystemTime(new Date('2026-04-28T11:00:00.000Z'));
    repo.create({
      id: 'book-2',
      title: 'Book 2',
      idea: 'A lighthouse records every storm.',
      targetChapters: 500,
      wordsPerChapter: 2500,
    });

    vi.setSystemTime(new Date('2026-04-28T12:00:00.000Z'));
    repo.updateTitle('book-1', 'Promise Archive');

    expect(repo.list().map((book) => book.id)).toEqual(['book-2', 'book-1']);
  });

  it('persists optional viral strategy with the book record', () => {
    const db = createDatabase(':memory:');
    const repo = createBookRepository(db);

    repo.create({
      id: 'book-viral',
      title: '新书',
      idea: '旧案复仇',
      targetChapters: 500,
      wordsPerChapter: 2500,
      viralStrategy: {
        readerPayoff: 'revenge',
        protagonistDesire: '洗清旧案',
        tropeContracts: ['revenge_payback'],
        cadenceMode: 'steady',
        antiClicheDirection: '反派不降智',
      },
    });

    expect(repo.getById('book-viral')?.viralStrategy).toEqual({
      readerPayoff: 'revenge',
      protagonistDesire: '洗清旧案',
      tropeContracts: ['revenge_payback'],
      cadenceMode: 'steady',
      antiClicheDirection: '反派不降智',
    });
  });

  it('summarizes chapter completion for multiple books in one repository call', () => {
    const db = createDatabase(':memory:');
    const books = createBookRepository(db);
    const chapters = createChapterRepository(db);

    books.create({
      id: 'book-1',
      title: 'Book 1',
      idea: 'A city remembers every promise.',
      targetChapters: 2,
      wordsPerChapter: 2500,
    });
    books.create({
      id: 'book-2',
      title: 'Book 2',
      idea: 'A lighthouse records every storm.',
      targetChapters: 1,
      wordsPerChapter: 2500,
    });
    chapters.upsertOutline({
      bookId: 'book-1',
      volumeIndex: 1,
      chapterIndex: 1,
      title: 'Chapter 1',
      outline: 'Opening conflict',
    });
    chapters.upsertOutline({
      bookId: 'book-1',
      volumeIndex: 1,
      chapterIndex: 2,
      title: 'Chapter 2',
      outline: 'Escalation',
    });
    chapters.upsertOutline({
      bookId: 'book-2',
      volumeIndex: 1,
      chapterIndex: 1,
      title: 'Chapter 1',
      outline: 'Opening conflict',
    });
    chapters.saveContent({
      bookId: 'book-1',
      volumeIndex: 1,
      chapterIndex: 1,
      content: 'Generated chapter content',
      summary: 'Summary',
      wordCount: 1200,
    });

    expect(chapters.listProgressByBookIds(['book-1', 'book-2'])).toEqual(
      new Map([
        ['book-1', { completedChapters: 1, totalChapters: 2 }],
        ['book-2', { completedChapters: 0, totalChapters: 1 }],
      ])
    );
  });

  it('returns an empty progress map when no book ids are provided', () => {
    const db = createDatabase(':memory:');
    const chapters = createChapterRepository(db);

    expect(chapters.listProgressByBookIds([])).toEqual(new Map());
  });

  it('round-trips core planning repositories by book', () => {
    const db = createDatabase(':memory:');
    const repos = createRepositories(db);

    repos.books.create({
      id: 'book-planning',
      title: 'Book Planning',
      idea: 'A city remembers every promise.',
      targetChapters: 24,
      wordsPerChapter: 2500,
    });

    const titleIdeaContract = {
      bookId: 'book-planning',
      title: 'The Promise Archive',
      idea: 'A city remembers every promise.',
      corePromise: 'Every bargain leaves a scar.',
      titleHooks: ['promise', 'archive'],
      forbiddenDrift: ['cheap amnesia'],
    };
    repos.titleIdeaContracts.save(titleIdeaContract);

    const endgamePlan = {
      bookId: 'book-planning',
      titleIdeaContract: 'The Promise Archive',
      protagonistEndState: 'She tells the truth publicly.',
      finalConflict: 'Expose the archive or save her brother.',
      finalOpponent: 'The city registrar',
      worldEndState: 'Public memory becomes shared property.',
      coreCharacterOutcomes: {
        protagonist: 'Accepts the cost of honesty.',
        brother: 'Chooses testimony over safety.',
      },
      majorPayoffs: ['The missing vow is restored', 'The registrar is unmasked'],
    };
    repos.endgamePlans.save(endgamePlan);

    const chapterPlan = {
      batchIndex: 1,
      chapterIndex: 3,
      arcIndex: 1,
      goal: 'Steal the ledger key.',
      conflict: 'The vault can read her old promises.',
      pressureSource: 'Her guilt over her brother.',
      changeType: 'trust fracture',
      threadActions: [{ threadId: 'ledger', action: 'advance' }],
      reveal: 'The key responds to blood vows.',
      payoffOrCost: 'She burns her last private memory.',
      endingHook: 'The vault opens to her mother’s voice.',
      titleIdeaLink: 'Promises have weight.',
      batchGoal: 'Break into the archive',
      requiredPayoffs: ['ledger clue'],
      forbiddenDrift: ['easy win'],
      status: 'planned',
    };
    repos.chapterPlans.upsertMany('book-planning', [chapterPlan]);

    const snapshot = {
      bookId: 'book-planning',
      chapterIndex: 3,
      summary: 'She gets the key but loses a memory.',
      titleIdeaAlignment: 'strong',
      flatnessRisk: 'medium',
      characterChanges: [{ characterId: 'hero', change: 'accepts the cost' }],
      relationshipChanges: [{ relationshipId: 'hero-brother', change: 'trust drops' }],
      worldFacts: ['Blood vows can unlock sealed memory vaults.'],
      threadUpdates: [{ threadId: 'ledger', update: 'advanced to reveal' }],
      unresolvedPromises: ['Who forged the erased vow?'],
      stageProgress: 'midpoint complete',
      remainingChapterBudget: 21,
    };
    repos.storyStateSnapshots.save(snapshot);

    expect(repos.titleIdeaContracts.getByBook('book-planning')).toEqual({
      ...titleIdeaContract,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(repos.endgamePlans.getByBook('book-planning')).toEqual({
      ...endgamePlan,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(repos.chapterPlans.listByBook('book-planning')).toEqual([chapterPlan]);
    expect(repos.storyStateSnapshots.getLatestByBook('book-planning')).toEqual({
      ...snapshot,
      createdAt: expect.any(String),
    });
  });

  it('deletes legacy narrative tables before removing the book row', () => {
    const db = createDatabase(':memory:');
    const repo = createBookRepository(db);

    repo.create({
      id: 'book-cleanup',
      title: 'Cleanup Book',
      idea: 'A city remembers every promise.',
      targetChapters: 3,
      wordsPerChapter: 2500,
    });

    db.prepare(
      `
        INSERT INTO character_arcs (
          id, book_id, name, role_type, desire, fear, flaw, misbelief,
          wound, external_goal, internal_need, arc_direction, decision_logic,
          line_will_not_cross, line_may_eventually_cross, current_arc_phase
        ) VALUES (
          'arc-1', 'book-cleanup', 'Lin Mu', 'protagonist', 'Win', 'Lose', 'Doubt',
          'He is alone', NULL, 'Solve the case', 'Trust others', 'growth',
          'Protect the innocent', NULL, NULL, 'setup'
        )
      `
    ).run();
    db.prepare(
      `
        INSERT INTO relationship_edges (
          id, book_id, from_character_id, to_character_id, visible_label,
          hidden_truth, dependency, debt, misunderstanding, affection, harm_pattern,
          shared_goal, value_conflict, trust_level, tension_level, current_state,
          planned_turns_json
        ) VALUES (
          'rel-1', 'book-cleanup', 'lin-mu', 'ally', 'allies',
          NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, 'fragile', '[]'
        )
      `
    ).run();
    db.prepare(
      `
        INSERT INTO world_rules (
          id, book_id, category, rule_text, cost, who_benefits, who_suffers,
          taboo, violation_consequence, allowed_exception, current_status
        ) VALUES (
          'rule-1', 'book-cleanup', 'law', 'Memory has a price.', 'A year of life.',
          NULL, NULL, NULL, NULL, NULL, 'active'
        )
      `
    ).run();
    db.prepare(
      `
        INSERT INTO narrative_threads (
          id, book_id, type, promise, planted_at, expected_payoff, resolved_at,
          current_state, importance, payoff_must_change, owner_character_id,
          related_relationship_id, notes
        ) VALUES (
          'thread-1', 'book-cleanup', 'main', 'Who erased the record?', 1, 3, NULL,
          'open', 'critical', 'plot', NULL, NULL, NULL
        )
      `
    ).run();
    db.prepare(
      `
        INSERT INTO chapter_thread_actions (
          book_id, volume_index, chapter_index, thread_id, action, required_effect
        ) VALUES (
          'book-cleanup', 1, 1, 'thread-1', 'plant', 'Seed the mystery.'
        )
      `
    ).run();
    db.prepare(
      `
        INSERT INTO chapter_character_pressures (
          book_id, volume_index, chapter_index, character_id,
          desire_pressure, fear_pressure, flaw_trigger, expected_choice
        ) VALUES (
          'book-cleanup', 1, 1, 'lin-mu',
          'Protect the clue.', 'Losing family memory.', 'Acts alone.', 'Ask for help.'
        )
      `
    ).run();
    db.prepare(
      `
        INSERT INTO chapter_relationship_actions (
          book_id, volume_index, chapter_index, relationship_id, action, required_change
        ) VALUES (
          'book-cleanup', 1, 1, 'rel-1', 'deepen', 'Trust begins to grow.'
        )
      `
    ).run();
    db.prepare(
      `
        INSERT INTO chapter_tension_budgets (
          book_id, volume_index, chapter_index, pressure_level, dominant_tension,
          required_turn, forced_choice, cost_to_pay, irreversible_change,
          reader_question, hook_pressure, flatness_risks_json
        ) VALUES (
          'book-cleanup', 1, 1, 'high', 'mystery', 'Find the clue.', 'Reveal or hide.',
          'Lose the ally.', 'The case turns public.', 'Who changed the record?',
          'The clue burns.', '[]'
        )
      `
    ).run();

    expect(() => repo.delete('book-cleanup')).not.toThrow();
    expect(repo.getById('book-cleanup')).toBeUndefined();

    for (const table of [
      'character_arcs',
      'relationship_edges',
      'world_rules',
      'narrative_threads',
      'chapter_thread_actions',
      'chapter_character_pressures',
      'chapter_relationship_actions',
      'chapter_tension_budgets',
    ]) {
      const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE book_id = ?`).get('book-cleanup') as {
        count: number;
      };
      expect(row.count).toBe(0);
    }
  });

  it('preserves rich chapter-card bridge data while updating outline text on later outline save', () => {
    const db = createDatabase(':memory:');
    const books = createBookRepository(db);
    const chapterCards = createChapterCardRepository(db);
    const chapters = createChapterRepository(db);

    books.create({
      id: 'book-bridge',
      title: 'Bridge Book',
      idea: 'A city remembers every promise.',
      targetChapters: 1,
      wordsPerChapter: 2500,
    });

    chapterCards.upsert({
      bookId: 'book-bridge',
      volumeIndex: 2,
      chapterIndex: 1,
      title: 'Old Ledger',
      plotFunction: 'Lin Mu discovers the ledger reacts to his blood.',
      povCharacterId: 'lin-mu',
      externalConflict: 'The magistrate demands the ledger immediately.',
      internalConflict: 'He wants to hide the truth but needs help.',
      relationshipChange: 'He reluctantly trusts his ally.',
      worldRuleUsedOrTested: 'blood-ledger',
      informationReveal: 'The ledger consumes memories for power.',
      readerReward: 'truth',
      endingHook: 'The missing family name reappears in ash.',
      mustChange: 'Lin Mu stops running and starts investigating.',
      forbiddenMoves: ['Do not reveal the mastermind yet.'],
    });

    chapters.upsertOutline({
      bookId: 'book-bridge',
      volumeIndex: 2,
      chapterIndex: 1,
      title: 'Old Ledger',
      outline: 'A simple fallback outline',
    });

    expect(chapterCards.listByBook('book-bridge')).toEqual([
      expect.objectContaining({
        externalConflict: 'The magistrate demands the ledger immediately.',
        internalConflict: 'He wants to hide the truth but needs help.',
        relationshipChange: 'He reluctantly trusts his ally.',
        readerReward: 'truth',
        endingHook: 'The missing family name reappears in ash.',
        mustChange: 'Lin Mu stops running and starts investigating.',
        plotFunction: 'A simple fallback outline',
        title: 'Old Ledger',
      }),
    ]);

    expect(chapters.listByBook('book-bridge')).toEqual([
      expect.objectContaining({
        title: 'Old Ledger',
        outline: 'A simple fallback outline',
      }),
    ]);
  });
});
