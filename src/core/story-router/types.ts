export type StoryTaskType =
  | 'write_chapter'
  | 'revise_chapter'
  | 'design_opening'
  | 'design_character'
  | 'audit_story'
  | 'de_ai';

export type StorySkillType = 'process' | 'execution' | 'audit';
export type StorySkillRigidity = 'hard' | 'soft';

export type StorySkill = {
  id: string;
  name: string;
  type: StorySkillType;
  priority: number;
  rigidity: StorySkillRigidity;
  triggers: StoryTaskType[];
  requiredContext: string[];
  promptRules: string[];
  auditQuestions: string[];
  redFlags: string[];
};

export type StoryRouteContext = {
  hasNarrativeBible: boolean;
  hasChapterCard: boolean;
  hasTensionBudget: boolean;
};

export type StoryRoutePlan = {
  taskType: StoryTaskType;
  requiredSkills: StorySkill[];
  optionalSkills: StorySkill[];
  hardConstraints: string[];
  promptRules: string[];
  auditQuestions: string[];
  redFlags: string[];
  checklist: string[];
  warnings: string[];
};

export type RouteStoryTaskInput = {
  taskType: StoryTaskType;
  context: StoryRouteContext;
};
