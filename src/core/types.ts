import type {
  ChapterCard,
  ChapterCharacterPressure,
  ChapterRelationshipAction,
  ChapterTensionBudget,
  ChapterThreadAction,
  NarrativeBible,
  VolumePlan,
} from './narrative/types.js';

export type OutlineGenerationInput = {
  bookId: string;
  idea: string;
  targetChapters: number;
  wordsPerChapter: number;
  modelId?: string;
  onWorldSetting?: (worldSetting: string) => void;
  onMasterOutline?: (masterOutline: string) => void;
  onChapterOutlines?: (chapterOutlines: ChapterOutline[]) => void;
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
  narrativeBible?: NarrativeBible;
  volumePlans?: VolumePlan[];
  chapterCards?: ChapterCard[];
  chapterTensionBudgets?: ChapterTensionBudget[];
  chapterThreadActions?: ChapterThreadAction[];
  chapterCharacterPressures?: ChapterCharacterPressure[];
  chapterRelationshipActions?: ChapterRelationshipAction[];
};
