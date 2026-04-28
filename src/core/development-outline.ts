import type { OutlineBundle, OutlineGenerationInput } from './types.js';

function pickStoryLabel(idea: string) {
  const cleaned = idea.trim();
  return cleaned.length > 32 ? `${cleaned.slice(0, 32)}...` : cleaned;
}

export function createDevelopmentOutlineService() {
  return {
    async generateFromIdea(
      input: OutlineGenerationInput
    ): Promise<OutlineBundle> {
      const storyLabel = pickStoryLabel(input.idea);

      return {
        worldSetting: [
          `Core premise: ${input.idea}`,
          'Power structure: factions compete over a scarce supernatural resource.',
          'Narrative anchor: every major choice should increase personal and social stakes.',
        ].join('\n'),
        masterOutline: [
          `Target length: ${input.targetWords} words`,
          `Book concept: ${storyLabel}`,
          'Arc 1: discover the hidden rule that governs the world.',
          'Arc 2: allies fracture as the cost of power becomes public.',
          'Arc 3: the protagonist rewrites the system at personal cost.',
        ].join('\n'),
        volumeOutlines: [
          `Volume 1 - Inciting pressure around ${storyLabel}`,
          `Volume 2 - Escalation and betrayal around ${storyLabel}`,
        ],
        chapterOutlines: [
          {
            volumeIndex: 1,
            chapterIndex: 1,
            title: 'A Debt Comes Due',
            outline: `Introduce ${storyLabel} and force the protagonist into the central conflict.`,
          },
          {
            volumeIndex: 1,
            chapterIndex: 2,
            title: 'Terms Of The System',
            outline: 'Reveal the first irreversible rule of the world and the price of resisting it.',
          },
          {
            volumeIndex: 2,
            chapterIndex: 1,
            title: 'Allies Under Audit',
            outline: 'Pressure the supporting cast until loyalty and survival begin to diverge.',
          },
        ],
      };
    },
  };
}
