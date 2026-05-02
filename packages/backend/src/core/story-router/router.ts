import { storySkillRegistry } from './registry.js';
import type {
  RouteStoryTaskInput,
  StoryRoutePlan,
  StorySkill,
  StoryTaskType,
} from './types.js';

const taskRoutes: Record<
  StoryTaskType,
  { required: string[]; optional: string[] }
> = {
  write_chapter: {
    required: [
      'story-structure',
      'chapter-goal',
      'character-logic',
      'emotion-curve',
      'opening-hook',
      'hook-technique',
      'dialogue-control',
      'genre-pattern',
      'viral-promise',
      'payoff-cadence',
      'anti-cliche',
      'prose-style',
      'consistency-audit',
      'pacing-audit',
      'red-flag-audit',
    ],
    optional: ['de-ai-style'],
  },
  revise_chapter: {
    required: [
      'story-structure',
      'chapter-goal',
      'character-logic',
      'emotion-curve',
      'hook-technique',
      'viral-promise',
      'payoff-cadence',
      'anti-cliche',
      'dialogue-control',
      'prose-style',
      'de-ai-style',
      'consistency-audit',
      'pacing-audit',
      'red-flag-audit',
    ],
    optional: [],
  },
  design_opening: {
    required: [
      'story-structure',
      'chapter-goal',
      'emotion-curve',
      'opening-hook',
      'hook-technique',
      'genre-pattern',
      'viral-promise',
      'anti-cliche',
      'pacing-audit',
    ],
    optional: [],
  },
  design_character: {
    required: ['character-logic'],
    optional: [],
  },
  audit_story: {
    required: [
      'story-structure',
      'character-logic',
      'genre-pattern',
      'viral-promise',
      'payoff-cadence',
      'consistency-audit',
      'pacing-audit',
      'red-flag-audit',
    ],
    optional: [],
  },
  de_ai: {
    required: [
      'dialogue-control',
      'prose-style',
      'de-ai-style',
      'red-flag-audit',
    ],
    optional: [],
  },
};

const priorityRules = [
  '用户本次明确要求优先。',
  '已有作品设定优先于章节技巧。',
  '当前章节卡优先于张力预算之外的风格建议。',
  '当前张力预算优先于通用文风润色。',
  '低优先级规则不能推翻用户要求、作品设定、章节卡和张力预算。',
];

const baseChecklist = [
  '必须完成章节卡 mustChange。',
  '必须体现可见选择、代价或后果。',
  '人物行动必须符合动机链。',
  '章末必须保留追读压力。',
  '主线必须产生可描述位移，不能只停留在设定或背景。',
  '结尾钩子必须由本章 mustChange、代价、揭示或强制选择触发。',
  '标题承诺和读者承诺必须进入场景行动。',
  '不得违反世界规则和已发生剧情。',
  '必须服务作品读者承诺。',
  '应有回报必须带代价或副作用。',
];

function getRoute(taskType: StoryTaskType) {
  const route = taskRoutes[taskType];
  if (!route) {
    throw new Error(`Unsupported story task type: ${String(taskType)}`);
  }
  return route;
}

function resolveSkills(ids: string[]): StorySkill[] {
  return ids.map((id) => {
    const skill = storySkillRegistry.find((candidate) => candidate.id === id);
    if (!skill) {
      throw new Error(`Story skill not found: ${id}`);
    }
    return skill;
  });
}

function uniqueLines(lines: string[]) {
  return [...new Set(lines.filter((line) => line.trim().length > 0))];
}

export function routeStoryTask(input: RouteStoryTaskInput): StoryRoutePlan {
  const route = getRoute(input.taskType);
  const requiredSkills = resolveSkills(route.required);
  const optionalSkills = resolveSkills(route.optional);
  const selectedSkills = [...requiredSkills, ...optionalSkills];
  const warnings: string[] = [];

  if (!input.context.hasNarrativeBible) {
    warnings.push(
      'Narrative Bible missing: use book idea and available continuity as fallback.'
    );
  }
  if (!input.context.hasChapterCard) {
    warnings.push('Chapter Card missing: use generic chapter-goal rules.');
  }
  if (!input.context.hasTensionBudget) {
    warnings.push('Tension Budget missing: skip budget-specific pressure rules.');
  }

  return {
    taskType: input.taskType,
    requiredSkills,
    optionalSkills,
    hardConstraints: priorityRules,
    promptRules: uniqueLines(selectedSkills.flatMap((skill) => skill.promptRules)),
    auditQuestions: uniqueLines(
      selectedSkills.flatMap((skill) => skill.auditQuestions)
    ),
    redFlags: uniqueLines(selectedSkills.flatMap((skill) => skill.redFlags)),
    checklist: baseChecklist,
    warnings,
    openingRetentionLines: [],
    viralProtocolLines: [],
  };
}
