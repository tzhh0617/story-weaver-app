import type { StoryRoutePlanView } from '@story-weaver/shared/contracts';
import type { StoryRoutePlan, StorySkill } from '../../story-router/index.js';

export function toStoryRoutePlanView(plan: StoryRoutePlan): StoryRoutePlanView {
  const mapSkill = (skill: StorySkill) => ({
    id: skill.id,
    name: skill.name,
    type: skill.type,
    rigidity: skill.rigidity,
  });

  return {
    taskType: plan.taskType,
    requiredSkills: plan.requiredSkills.map(mapSkill),
    optionalSkills: plan.optionalSkills.map(mapSkill),
    hardConstraints: plan.hardConstraints,
    checklist: plan.checklist,
    redFlags: plan.redFlags,
    warnings: plan.warnings,
  };
}
