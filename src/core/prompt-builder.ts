import type { OutlineGenerationInput } from './types.js';

export function buildWorldPrompt(
  input: Pick<OutlineGenerationInput, 'idea' | 'targetWords'>
) {
  return [
    'You are designing a long-form Chinese web novel.',
    `User idea: ${input.idea}`,
    `Target length: ${input.targetWords} words`,
    'Return world rules, character anchors, power system, core conflict, and tone guide.',
  ].join('\n');
}

export function buildMasterOutlinePrompt(
  worldSetting: string,
  input: Pick<OutlineGenerationInput, 'idea' | 'targetWords'>
) {
  return [
    `User idea: ${input.idea}`,
    `World setting:\n${worldSetting}`,
    `Target length: ${input.targetWords} words`,
    'Return the full-book outline, volume breakdown, and chapter count guidance.',
  ].join('\n');
}

export function buildVolumeOutlinePrompt(masterOutline: string, volumeCount = 10) {
  return [
    `Master outline:\n${masterOutline}`,
    `Expand this into ${volumeCount} volume outlines.`,
    'For each volume, return a heading and 10-20 chapter beats.',
    'Separate volumes with a line containing only ---',
  ].join('\n');
}

export function buildChapterOutlinePrompt(
  volumeOutline: string,
  volumeIndex: number
) {
  return [
    `Volume ${volumeIndex} outline:\n${volumeOutline}`,
    'Return chapter-level outlines in the format "chapterIndex|title|outline".',
    'Generate one line per chapter.',
  ].join('\n');
}
