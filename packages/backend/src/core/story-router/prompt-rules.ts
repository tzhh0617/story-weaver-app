import type { StoryRoutePlan, StorySkill } from './types.js';

function renderSkills(skills: StorySkill[]) {
  return skills.map(
    (skill) =>
      `- ${skill.id} (${skill.name}; ${skill.type}; ${skill.rigidity})`
  );
}

function renderSection(title: string, lines: string[]) {
  return [
    title,
    ...(lines.length ? lines.map((line) => `- ${line}`) : ['- None']),
  ];
}

export function formatStoryRoutePlanForPrompt(plan: StoryRoutePlan) {
  return [
    'Story Skill Route Plan',
    `Task Type: ${plan.taskType}`,
    '',
    ...renderSection('Priority Rules', plan.hardConstraints),
    '',
    ...renderSection('Hard Constraints', plan.hardConstraints),
    '',
    'Required Skills',
    ...renderSkills(plan.requiredSkills),
    '',
    'Optional Skills',
    ...renderSkills(plan.optionalSkills),
    '',
    ...renderSection('Prompt Rules', plan.promptRules),
    '',
    ...renderSection('Audit Questions', plan.auditQuestions),
    '',
    ...renderSection('Red Flags', plan.redFlags),
    '',
    ...renderSection('Checklist', plan.checklist),
    '',
    ...(plan.openingRetentionLines?.length
      ? [
          ...renderSection('Opening Retention', plan.openingRetentionLines),
          '',
        ]
      : []),
    ...(plan.viralProtocolLines?.length
      ? [
          ...renderSection('Viral Protocol', plan.viralProtocolLines),
          '',
        ]
      : []),
    ...renderSection('Warnings', plan.warnings),
  ].join('\n');
}
