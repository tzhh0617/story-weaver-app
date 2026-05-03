import type { StoryCheckpoint, StoryCheckpointType } from './types.js';

export function shouldCreateCheckpoint(
  chapterIndex: number
): StoryCheckpointType | null {
  if (chapterIndex <= 0) {
    return null;
  }

  if (chapterIndex % 50 === 0) {
    return 'heavy';
  }

  if (chapterIndex % 10 === 0) {
    return 'light';
  }

  return null;
}

export function pickRecoveryCheckpoint(
  checkpoints: Pick<StoryCheckpoint, 'chapterIndex' | 'checkpointType'>[],
  chapterIndex: number
) {
  const eligible = checkpoints
    .filter((checkpoint) => checkpoint.chapterIndex <= chapterIndex)
    .sort((left, right) => right.chapterIndex - left.chapterIndex);

  return (
    eligible.find((checkpoint) => checkpoint.checkpointType === 'heavy') ??
    eligible[0] ??
    null
  );
}
