import type { AuditDecision, NarrativeAudit } from './types.js';

export function decideAuditAction(audit: NarrativeAudit): AuditDecision {
  if (audit.issues.some((issue) => issue.severity === 'blocker')) {
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
