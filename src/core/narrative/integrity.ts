import type {
  DriftLevel,
  IntegrityReport,
  StoryRepairAction,
} from './types.js';

export type IntegrityReportInput = {
  mainlineProblems?: string[];
  characterProblems?: string[];
  subplotProblems?: string[];
  payoffProblems?: string[];
  rhythmProblems?: string[];
};

function clampScore(score: number) {
  return Math.max(0, Math.min(100, score));
}

function scoreFromProblems(problems: string[], weight: number) {
  return clampScore(100 - problems.length * weight);
}

function determineDriftLevel(
  scores: {
  mainlineAlignmentScore: number;
  characterStabilityScore: number;
  subplotControlScore: number;
  payoffProgressScore: number;
  rhythmFitScore: number;
  },
  input: Required<IntegrityReportInput>
): DriftLevel {
  if (input.mainlineProblems.length > 0 && input.payoffProblems.length > 0) {
    return 'medium';
  }

  const minimum = Math.min(
    scores.mainlineAlignmentScore,
    scores.characterStabilityScore,
    scores.subplotControlScore,
    scores.payoffProgressScore,
    scores.rhythmFitScore
  );

  if (minimum >= 85) {
    return 'none';
  }

  if (minimum >= 70) {
    return 'light';
  }

  if (minimum >= 40) {
    return 'medium';
  }

  return 'heavy';
}

function determineRepairAction(input: Required<IntegrityReportInput>): StoryRepairAction {
  if (input.mainlineProblems.length > 0 && input.payoffProblems.length > 0) {
    return 'rebuild_chapter_window';
  }

  if (input.subplotProblems.length >= 2) {
    return 'rebalance_subplots';
  }

  if (input.payoffProblems.length > 0) {
    return 'refresh_payoff_plan';
  }

  if (input.characterProblems.length > 0 || input.rhythmProblems.length > 0) {
    return 'patch_scene';
  }

  return 'continue';
}

export function buildIntegrityReport(
  input: IntegrityReportInput
): IntegrityReport {
  const normalized: Required<IntegrityReportInput> = {
    mainlineProblems: input.mainlineProblems ?? [],
    characterProblems: input.characterProblems ?? [],
    subplotProblems: input.subplotProblems ?? [],
    payoffProblems: input.payoffProblems ?? [],
    rhythmProblems: input.rhythmProblems ?? [],
  };

  const report = {
    mainlineAlignmentScore: scoreFromProblems(normalized.mainlineProblems, 30),
    characterStabilityScore: scoreFromProblems(normalized.characterProblems, 18),
    subplotControlScore: scoreFromProblems(normalized.subplotProblems, 20),
    payoffProgressScore: scoreFromProblems(normalized.payoffProblems, 30),
    rhythmFitScore: scoreFromProblems(normalized.rhythmProblems, 18),
  };

  return {
    ...report,
    driftLevel: determineDriftLevel(report, normalized),
    repairAction: determineRepairAction(normalized),
    findings: [
      ...normalized.mainlineProblems,
      ...normalized.characterProblems,
      ...normalized.subplotProblems,
      ...normalized.payoffProblems,
      ...normalized.rhythmProblems,
    ],
  };
}
