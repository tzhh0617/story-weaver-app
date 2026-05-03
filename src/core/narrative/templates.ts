import type {
  StoryTemplateId,
  StoryTemplatePreset,
} from './types.js';

export const storyTemplatePresets: Record<
  StoryTemplateId,
  StoryTemplatePreset
> = {
  progression: {
    id: 'progression',
    label: 'Progression',
    summary: 'Escalate growth, cost, and visible advancement on a steady loop.',
    rubric: {
      subplotLimit: 3,
      maxPayoffGapChapters: 4,
      rhythmPattern: ['setup', 'escalation', 'payoff', 'cost'],
      driftWarnings: [
        'Do not let training replace competitive pressure for too long.',
        'Each mini-arc should end with a visible gain or loss.',
      ],
    },
  },
  romance_growth: {
    id: 'romance_growth',
    label: 'Romance Growth',
    summary: 'Balance emotional intimacy, misalignment, and earned relationship turns.',
    rubric: {
      subplotLimit: 2,
      maxPayoffGapChapters: 3,
      rhythmPattern: ['setup', 'escalation', 'twist', 'payoff'],
      driftWarnings: [
        'Do not stall the central relationship with repetitive almost-confessions.',
        'External plot should keep forcing emotional decisions.',
      ],
    },
  },
  mystery_serial: {
    id: 'mystery_serial',
    label: 'Mystery Serial',
    summary: 'Feed clue chains, reversals, and answer pacing without collapsing suspense.',
    rubric: {
      subplotLimit: 4,
      maxPayoffGapChapters: 3,
      rhythmPattern: ['setup', 'escalation', 'twist', 'payoff', 'cost'],
      driftWarnings: [
        'Each reveal should open a sharper follow-up question.',
        'Do not hide answers by withholding basic scene logic.',
      ],
    },
  },
};
