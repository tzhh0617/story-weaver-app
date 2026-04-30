import type { AuditDecision, NarrativeAudit } from './types.js';

export function decideAuditAction(audit: NarrativeAudit): AuditDecision {
  if (audit.issues.some((issue) => issue.severity === 'blocker')) {
    return 'rewrite';
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
