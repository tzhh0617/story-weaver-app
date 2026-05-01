import type { ValidationResult, VolumePlan } from '../types.js';
import { isBlank, result } from './shared.js';

export function validateVolumePlans(
  volumePlans: VolumePlan[],
  input: { targetChapters: number }
): ValidationResult {
  const issues: string[] = [];
  let expectedStart = 1;
  const seenVolumeIndexes = new Set<number>();

  for (const volume of [...volumePlans].sort((left, right) => left.volumeIndex - right.volumeIndex)) {
    if (!Number.isInteger(volume.volumeIndex) || volume.volumeIndex <= 0) {
      issues.push(`Volume ${volume.volumeIndex} must use a positive volumeIndex.`);
    } else if (seenVolumeIndexes.has(volume.volumeIndex)) {
      issues.push(`Volume ${volume.volumeIndex} must not be duplicated.`);
    }
    seenVolumeIndexes.add(volume.volumeIndex);

    if (volume.chapterStart !== expectedStart) {
      issues.push(`Volume ${volume.volumeIndex} must start at chapter ${expectedStart}.`);
    }
    if (volume.chapterEnd < volume.chapterStart) {
      issues.push(
        `Volume ${volume.volumeIndex} chapterEnd must be greater than or equal to chapterStart.`
      );
    }
    if (isBlank(volume.title)) {
      issues.push(`Volume ${volume.volumeIndex} must include title.`);
    }
    if (isBlank(volume.roleInStory)) {
      issues.push(`Volume ${volume.volumeIndex} must include roleInStory.`);
    }
    if (isBlank(volume.mainPressure)) {
      issues.push(`Volume ${volume.volumeIndex} must include mainPressure.`);
    }
    if (isBlank(volume.promisedPayoff)) {
      issues.push(`Volume ${volume.volumeIndex} must include promisedPayoff.`);
    }
    if (isBlank(volume.characterArcMovement)) {
      issues.push(
        `Volume ${volume.volumeIndex} must include characterArcMovement.`
      );
    }
    if (isBlank(volume.relationshipMovement)) {
      issues.push(
        `Volume ${volume.volumeIndex} must include relationshipMovement.`
      );
    }
    if (isBlank(volume.worldExpansion)) {
      issues.push(`Volume ${volume.volumeIndex} must include worldExpansion.`);
    }
    if (isBlank(volume.endingTurn)) {
      issues.push(`Volume ${volume.volumeIndex} must include endingTurn.`);
    }
    expectedStart = volume.chapterEnd + 1;
  }

  if (expectedStart !== input.targetChapters + 1) {
    issues.push(`Volume plans must end at chapter ${input.targetChapters}.`);
  }

  return result(issues);
}
