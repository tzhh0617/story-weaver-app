import type { BookRecord } from '../../src/shared/contracts';

export type BookDetailData = {
  book: BookRecord;
  context: {
    worldSetting?: string | null;
    outline?: string | null;
    styleGuide?: string | null;
  } | null;
  latestScene: {
    location: string;
    timeInStory: string;
    charactersPresent: string[];
    events: string | null;
  } | null;
  characterStates: Array<{
    characterId: string;
    characterName: string;
    volumeIndex: number;
    chapterIndex: number;
    location: string | null;
    status: string | null;
    knowledge: string | null;
    emotion: string | null;
    powerLevel: string | null;
  }>;
  plotThreads: Array<{
    id: string;
    description: string;
    plantedAt: number;
    expectedPayoff: number | null;
    resolvedAt: number | null;
    importance: string;
  }>;
  chapters: Array<{
    bookId: string;
    volumeIndex: number;
    chapterIndex: number;
    title: string | null;
    outline: string | null;
    content: string | null;
    summary: string | null;
    wordCount: number;
  }>;
  progress: {
    phase?: string | null;
  } | null;
};
