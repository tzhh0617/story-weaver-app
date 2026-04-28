export type OutlineGenerationInput = {
  bookId: string;
  idea: string;
  targetWords: number;
  modelId?: string;
};

export type ChapterOutline = {
  volumeIndex: number;
  chapterIndex: number;
  title: string;
  outline: string;
};

export type OutlineBundle = {
  worldSetting: string;
  masterOutline: string;
  volumeOutlines: string[];
  chapterOutlines: ChapterOutline[];
};
