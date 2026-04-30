import type { OutlineGenerationInput } from './types.js';

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
    'Treat these as hard structure constraints for all later outline and chapter work.',
    'Return world rules, character anchors, power system, core conflict, and tone guide.',
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
    'Return the full-book outline and volume breakdown for exactly this chapter count.',
  ].join('\n');
}

export function buildVolumeOutlinePrompt(
  masterOutline: string,
  input: StoryLengthConstraints,
  volumeCount = 10
) {
  return [
    `Master outline:\n${masterOutline}`,
    ...buildLengthConstraintLines(input),
    `Allocate exactly ${input.targetChapters} chapters across the volumes.`,
    `Expand this into ${volumeCount} volume outlines.`,
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
}) {
  return [
    'Write the next chapter of a long-form Chinese web novel.',
    `Book idea: ${input.idea}`,
    ...buildLengthConstraintLines(input),
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
    `Chapter title: ${input.chapterTitle}`,
    `Chapter outline: ${input.chapterOutline}`,
    'Return only the final chapter prose.',
  ].join('\n');
}
