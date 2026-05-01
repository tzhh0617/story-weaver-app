import type {
  ChapterTensionBudget,
  FlatnessScoring,
  NarrativeAudit,
  TensionCheckpoint,
} from './types.js';

export function shouldRunCheckpoint(input: {
  chapterIndex: number;
  interval?: number;
}) {
  const interval = input.interval ?? 10;
  return interval > 0 && input.chapterIndex > 0 && input.chapterIndex % interval === 0;
}

export function shouldRunNarrativeCheckpoint(chapterIndex: number) {
  return shouldRunCheckpoint({ chapterIndex, interval: 10 });
}

function flatnessAverage(flatness: FlatnessScoring) {
  return Math.round(
    (flatness.conflictEscalation +
      flatness.choicePressure +
      flatness.consequenceVisibility +
      flatness.irreversibleChange +
      flatness.hookStrength) /
      5
  );
}

function latestAuditByChapter(
  audits: Array<{
    chapterIndex: number;
    attempt?: number;
    scoring: Partial<NarrativeAudit['scoring']>;
  }>
) {
  const latest = new Map<
    number,
    { chapterIndex: number; attempt?: number; scoring: Partial<NarrativeAudit['scoring']> }
  >();

  for (const audit of audits) {
    const existing = latest.get(audit.chapterIndex);
    if (!existing || (audit.attempt ?? 0) >= (existing.attempt ?? 0)) {
      latest.set(audit.chapterIndex, audit);
    }
  }

  return latest;
}

export function buildTensionCheckpoint(input: {
  chapterIndex: number;
  budgets: ChapterTensionBudget[];
  audits: Array<{
    chapterIndex: number;
    attempt?: number;
    scoring: Partial<NarrativeAudit['scoring']>;
  }>;
  windowSize?: number;
}): TensionCheckpoint {
  const windowSize = input.windowSize ?? 5;
  const recentBudgets = [...input.budgets]
    .filter((budget) => budget.chapterIndex <= input.chapterIndex)
    .sort((left, right) => left.chapterIndex - right.chapterIndex)
    .slice(-windowSize);
  const auditsByChapter = latestAuditByChapter(input.audits);

  const recentPressureCurve = recentBudgets.map((budget) => {
    const flatness = auditsByChapter.get(budget.chapterIndex)?.scoring.flatness;

    return {
      chapterIndex: budget.chapterIndex,
      pressureLevel: budget.pressureLevel,
      dominantTension: budget.dominantTension,
      flatnessScore: flatness ? flatnessAverage(flatness) : null,
    };
  });

  const flatChapterIndexes = recentPressureCurve
    .filter(
      (point): point is typeof point & { flatnessScore: number } =>
        point.flatnessScore !== null && point.flatnessScore < 70
    )
    .map((point) => point.chapterIndex);

  const repeatedPatterns: string[] = [];
  let currentTension: string | null = null;
  let currentRun = 0;
  for (const point of recentPressureCurve) {
    if (point.dominantTension === currentTension) {
      currentRun += 1;
    } else {
      if (currentTension && currentRun >= 3) {
        repeatedPatterns.push(
          `dominantTension ${currentTension} repeated for ${currentRun} chapters`
        );
      }
      currentTension = point.dominantTension;
      currentRun = 1;
    }
  }
  if (currentTension && currentRun >= 3) {
    repeatedPatterns.push(
      `dominantTension ${currentTension} repeated for ${currentRun} chapters`
    );
  }

  const rewardGaps: string[] = [];
  const lowFlatnessCount = flatChapterIndexes.length;
  const instructionParts: string[] = [];
  if (repeatedPatterns.length > 0) {
    instructionParts.push(
      'Switch dominant tension in the next 2 chapters to relationship, moral_choice, status_loss, or resource_cost.'
    );
  }
  if (lowFlatnessCount >= 2) {
    instructionParts.push(
      'Raise pressure for the next 3 chapters and require visible choice, cost, and irreversible change.'
    );
  }

  return {
    recentPressureCurve,
    repeatedPatterns,
    flatChapterIndexes,
    rewardGaps,
    nextBudgetInstruction:
      instructionParts.join(' ') ||
      'Current tension curve is stable; keep alternating pressure and tension sources.',
  };
}
