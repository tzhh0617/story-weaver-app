import type { NarrativeAudit } from '../../narrative/types.js';

export const FLATNESS_ISSUE_TYPES = new Set<NarrativeAudit['issues'][number]['type']>([
  'flat_chapter',
  'weak_choice_pressure',
  'missing_consequence',
  'soft_hook',
  'repeated_tension_pattern',
]);

export const VIRAL_ISSUE_TYPES = new Set<NarrativeAudit['issues'][number]['type']>([
  'weak_reader_promise',
  'unclear_desire',
  'missing_payoff',
  'payoff_without_cost',
  'generic_trope',
  'weak_reader_question',
  'stale_hook_engine',
]);

export function calculateFlatnessScore(scoring: NarrativeAudit['scoring']) {
  const flatness = scoring.flatness;
  if (!flatness) {
    return null;
  }

  return Math.round(
    (flatness.conflictEscalation +
      flatness.choicePressure +
      flatness.consequenceVisibility +
      flatness.irreversibleChange +
      flatness.hookStrength) /
      5
  );
}

export function calculateViralScore(scoring: NarrativeAudit['scoring']) {
  const viral = scoring.viral;
  if (!viral) {
    return null;
  }

  return Math.round(
    (viral.openingHook +
      viral.desireClarity +
      viral.payoffStrength +
      viral.readerQuestionStrength +
      viral.tropeFulfillment +
      viral.antiClicheFreshness) /
      6
  );
}
