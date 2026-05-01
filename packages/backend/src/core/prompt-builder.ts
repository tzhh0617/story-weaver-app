import type { OutlineGenerationInput } from './types.js';
import {
  buildAiFirstTextPolicyLines,
  buildPlainChineseOutputPolicyLines,
} from './narrative/text-policy.js';

export {
  buildChapterAuditPrompt,
  buildChapterCardPrompt,
  buildNarrativeBiblePrompt,
  buildNarrativeDraftPrompt,
  buildRevisionPrompt,
  buildVolumePlanPrompt,
} from './narrative/prompts.js';

const WORLD_SETTING_MAX_CHARACTERS = 3000;
const MASTER_OUTLINE_MAX_CHARACTERS = 3000;

type StoryLengthConstraints = Pick<
  OutlineGenerationInput,
  'targetChapters' | 'wordsPerChapter'
>;

function trimPromptText(text: string | null, maxCharacters: number) {
  if (!text) {
    return 'N/A';
  }

  if (text.length <= maxCharacters) {
    return text;
  }

  return `${text.slice(0, maxCharacters)}\n[truncated]`;
}

function buildLengthConstraintLines(input: StoryLengthConstraints) {
  return [
    `Target chapters: ${input.targetChapters}`,
    `Words per chapter: ${input.wordsPerChapter}`,
  ];
}

export function buildWorldPrompt(
  input: Pick<
    OutlineGenerationInput,
    'idea' | 'targetChapters' | 'wordsPerChapter'
  >
) {
  return [
    'You are designing a long-form Chinese web novel.',
    `User idea: ${input.idea}`,
    ...buildLengthConstraintLines(input),
    ...buildPlainChineseOutputPolicyLines(),
    'Treat these as hard structure constraints for all later outline and chapter work.',
    'Return world rules, character anchors, power system, core conflict, and tone guide.',
    'Return plain Chinese text only. Do not use Markdown headings, bullets, bold markers, or code fences.',
  ].join('\n');
}

export function buildTitlePrompt(
  input: Pick<
    OutlineGenerationInput,
    'idea' | 'targetChapters' | 'wordsPerChapter'
  >
) {
  return [
    'Name this long-form Chinese web novel.',
    `User idea: ${input.idea}`,
    ...buildLengthConstraintLines(input),
    ...buildAiFirstTextPolicyLines(),
    'Return only one concise Chinese book title, without quotes or explanation.',
  ].join('\n');
}

export function buildMasterOutlinePrompt(
  worldSetting: string,
  input: Pick<
    OutlineGenerationInput,
    'idea' | 'targetChapters' | 'wordsPerChapter'
  >
) {
  return [
    `User idea: ${input.idea}`,
    `World setting:\n${worldSetting}`,
    ...buildLengthConstraintLines(input),
    ...buildAiFirstTextPolicyLines(),
    'Return the full-book outline and volume breakdown for exactly this chapter count.',
  ].join('\n');
}

export function buildVolumeOutlinePrompt(
  masterOutline: string,
  input: StoryLengthConstraints,
  volumeCount = 10
) {
  const effectiveVolumeCount = Math.max(
    1,
    Math.min(volumeCount, input.targetChapters)
  );

  return [
    `Master outline:\n${masterOutline}`,
    ...buildLengthConstraintLines(input),
    ...buildAiFirstTextPolicyLines(),
    `Allocate exactly ${input.targetChapters} chapters across the volumes.`,
    `Expand this into ${effectiveVolumeCount} volume outlines.`,
    `For each volume, include chapter ranges and pacing guidance for chapters of about ${input.wordsPerChapter} words.`,
    'Separate volumes with a line containing only ---',
  ].join('\n');
}

export function buildChapterOutlinePrompt(
  volumeOutline: string,
  volumeIndex: number,
  input: StoryLengthConstraints
) {
  return [
    `Volume ${volumeIndex} outline:\n${volumeOutline}`,
    ...buildLengthConstraintLines(input),
    ...buildAiFirstTextPolicyLines(),
    'Return chapter-level outlines in the format "chapterIndex|title|outline".',
    'chapterIndex must be the cumulative full-book chapter number, not a volume-local chapter number.',
    `Generate one line per chapter, and each chapter should be planned for about ${input.wordsPerChapter} words.`,
  ].join('\n');
}

export function buildChapterDraftPrompt(input: {
  idea: string;
  worldSetting: string | null;
  masterOutline: string | null;
  continuityContext: string | null;
  chapterTitle: string;
  chapterOutline: string;
  targetChapters: number;
  wordsPerChapter: number;
  routePlanText?: string | null;
}) {
  return [
    'Write the next chapter of a long-form Chinese web novel.',
    `Book idea: ${input.idea}`,
    ...buildLengthConstraintLines(input),
    ...buildAiFirstTextPolicyLines(),
    `Write approximately ${input.wordsPerChapter} Chinese characters for this chapter.`,
    `World setting:\n${trimPromptText(
      input.worldSetting,
      WORLD_SETTING_MAX_CHARACTERS
    )}`,
    `Master outline:\n${trimPromptText(
      input.masterOutline,
      MASTER_OUTLINE_MAX_CHARACTERS
    )}`,
    `Continuity context:\n${input.continuityContext ?? 'N/A'}`,
    'Treat the continuity context as hard constraints: do not contradict character states, last scene timing/location, unresolved plot threads, or established world rules.',
    input.routePlanText ? `Story route requirements:\n${input.routePlanText}` : '',
    `Chapter title: ${input.chapterTitle}`,
    `Chapter outline: ${input.chapterOutline}`,
    'Return only the final chapter prose. Do not include any chapter title, heading, Markdown title, or title line in the body text.',
  ].join('\n');
}
