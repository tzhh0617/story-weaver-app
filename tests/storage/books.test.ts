import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDatabase } from '../../src/storage/database';
import { createBookRepository } from '../../src/storage/books';
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
});
