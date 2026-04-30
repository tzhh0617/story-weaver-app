import type { AuditDecision, NarrativeAudit } from './types.js';

type AuditActionContext = {
  chapterIndex?: number | null;
};

function isOpeningStrictChapter(chapterIndex?: number | null) {
  return typeof chapterIndex === 'number' && chapterIndex >= 1 && chapterIndex <= 3;
}

export function decideAuditAction(
  audit: NarrativeAudit,
  context: AuditActionContext = {}
): AuditDecision {
  if (audit.issues.some((issue) => issue.severity === 'blocker')) {
    return 'rewrite';
  }

  if (
    isOpeningStrictChapter(context.chapterIndex) &&
    audit.issues.some((issue) => issue.type === 'flat_chapter')
  ) {
    return 'rewrite';
  }

  const flatness = audit.scoring.flatness;
  if (flatness) {
    const flatnessAverage =
      (flatness.conflictEscalation +
        flatness.choicePressure +
        flatness.consequenceVisibility +
        flatness.irreversibleChange +
        flatness.hookStrength) /
      5;

    if (flatnessAverage < 60) return 'rewrite';

    if (isOpeningStrictChapter(context.chapterIndex)) {
      if (
        flatness.hookStrength < 80 ||
        flatness.choicePressure < 70 ||
        flatness.irreversibleChange < 75 ||
        audit.issues.some((issue) => issue.type === 'soft_hook')
      ) {
        return 'revise';
      }
    }

    if (
      flatness.choicePressure < 60 ||
      flatness.consequenceVisibility < 60 ||
      flatness.irreversibleChange < 70
    ) {
      return 'revise';
    }
  }

  if (!audit.passed || audit.score < 80) {
    return audit.score < 60 ? 'rewrite' : 'revise';
  }
  if (audit.issues.some((issue) => issue.severity === 'major')) {
    return 'revise';
  }
  return audit.decision === 'rewrite' || audit.decision === 'revise'
    ? audit.decision
    : 'accept';
}
