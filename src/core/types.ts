import type {
  ArcPlan,
  ChapterCard,
  ChapterPlan,
  ChapterCharacterPressure,
  ChapterRelationshipAction,
  ChapterTensionBudget,
  ChapterThreadAction,
  EndgamePlan,
  NarrativeBible,
  StagePlan,
  TitleIdeaContract,
  ViralStrategyInput,
  VolumePlan,
} from './narrative/types.js';

export type OutlineGenerationInput = {
  bookId: string;
  idea: string;
  targetChapters: number;
  wordsPerChapter: number;
  modelId?: string;
  viralStrategy?: ViralStrategyInput | null;
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
  titleIdeaContract?: Omit<TitleIdeaContract, 'createdAt' | 'updatedAt'>;
  endgamePlan?: Omit<EndgamePlan, 'createdAt' | 'updatedAt'>;
  stagePlans?: StagePlan[];
  arcPlans?: ArcPlan[];
  chapterPlans?: ChapterPlan[];
  narrativeBible?: NarrativeBible;
  volumePlans?: VolumePlan[];
  chapterCards?: ChapterCard[];
  chapterTensionBudgets?: ChapterTensionBudget[];
  chapterThreadActions?: ChapterThreadAction[];
  chapterCharacterPressures?: ChapterCharacterPressure[];
  chapterRelationshipActions?: ChapterRelationshipAction[];
};
