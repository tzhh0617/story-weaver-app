import type { AuditDecision, NarrativeAudit } from './types.js';

type AuditActionContext = {
  chapterIndex?: number | null;
};

function isOpeningStrictChapter(chapterIndex?: number | null) {
  return typeof chapterIndex === 'number' && chapterIndex >= 1 && chapterIndex <= 3;
}

function isOpeningControlChapter(chapterIndex?: number | null) {
  return typeof chapterIndex === 'number' && chapterIndex >= 1 && chapterIndex <= 5;
}

function hasIssue(audit: NarrativeAudit, type: NarrativeAudit['issues'][number]['type']) {
  return audit.issues.some((issue) => issue.type === type);
}

export function decideAuditAction(
  audit: NarrativeAudit,
  context: AuditActionContext = {}
): AuditDecision {
  if (audit.issues.some((issue) => issue.severity === 'blocker')) {
    return 'rewrite';
  }

  if (hasIssue(audit, 'mainline_drift')) {
    const driftIssue = audit.issues.find((issue) => issue.type === 'mainline_drift');
    if (driftIssue?.severity === 'blocker') return 'rewrite';
  }

  const viral = audit.scoring.viral;
  if (viral) {
    if (
      hasIssue(audit, 'weak_reader_promise') &&
      (hasIssue(audit, 'unclear_desire') || viral.desireClarity < 50)
    ) {
      return 'rewrite';
    }

    if (
      isOpeningStrictChapter(context.chapterIndex) &&
      viral.openingHook < 80
    ) {
      return 'revise';
    }

    if (
      viral.desireClarity < 65 ||
      viral.payoffStrength < 70 ||
      viral.readerQuestionStrength < 70 ||
      viral.antiClicheFreshness < 50 ||
      hasIssue(audit, 'missing_payoff') ||
      hasIssue(audit, 'payoff_without_cost') ||
      hasIssue(audit, 'generic_trope') ||
      hasIssue(audit, 'weak_reader_question') ||
      hasIssue(audit, 'stale_hook_engine')
    ) {
      return 'revise';
    }
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

  if (
    audit.issues.some(
      (issue) =>
        issue.severity === 'major' &&
        (issue.type === 'mainline_drift' ||
          issue.type === 'loose_ending' ||
          issue.type === 'unearned_hook')
    )
  ) {
    return 'revise';
  }

  if (
    isOpeningControlChapter(context.chapterIndex) &&
    (hasIssue(audit, 'weak_title_promise') || hasIssue(audit, 'mainline_drift'))
  ) {
    return 'revise';
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
