export type OpeningRetentionPhase = {
  chapterIndex: number;
  label: string;
  englishLabel: string;
  requiredEffect: string;
};

export const OPENING_RETENTION_PHASES: OpeningRetentionPhase[] = [
  {
    chapterIndex: 1,
    label: '异常入场',
    englishLabel: 'abnormal entry',
    requiredEffect:
      'Start with abnormality, desire, conflict, danger, or an unanswered question within the opening paragraphs, and make the title promise visible.',
  },
  {
    chapterIndex: 2,
    label: '问题变贵',
    englishLabel: 'rising cost',
    requiredEffect:
      'Make the chapter 1 problem visibly more expensive through status loss, relationship strain, resource cost, or danger, and show that it belongs to the mainline.',
  },
  {
    chapterIndex: 3,
    label: '不可逆入局',
    englishLabel: 'irreversible entry',
    requiredEffect:
      'Force a choice that makes the protagonist unable to return to the old safe life and locks the story onto the main thread.',
  },
  {
    chapterIndex: 4,
    label: '首次明确回报',
    englishLabel: 'first clear reward',
    requiredEffect:
      'Give the reader a breakthrough, truth, upgrade, ally, or partial victory, but attach a side effect that keeps the title promise alive.',
  },
  {
    chapterIndex: 5,
    label: '长线敌意',
    englishLabel: 'long-term hostility',
    requiredEffect:
      'Reveal that a larger hostile force, unresolved mystery, or long-term pressure is now aimed at the protagonist and can sustain the mainline.',
  },
];

export function getOpeningRetentionPhase(chapterIndex: number) {
  return (
    OPENING_RETENTION_PHASES.find(
      (phase) => phase.chapterIndex === chapterIndex
    ) ?? null
  );
}

export function buildOpeningRetentionProtocolLines(input: {
  targetChapters: number;
}) {
  const lines = [
    'Opening Retention Protocol:',
    'For the first five chapters, treat opening retention as stricter than normal chapter pacing.',
    'Chapter 1: abnormal entry. Pull the protagonist out of ordinary life through abnormality, desire, conflict, danger, or an unanswered question, and make the title promise visible.',
    'Chapter 2: rising cost. Make the chapter 1 problem visibly more expensive through status loss, relationship strain, resource cost, or danger, and show that it belongs to the mainline.',
    'Chapter 3: irreversible entry. Force a choice that makes the protagonist unable to return to the old safe life and locks the story onto the main thread.',
    'Chapter 4: first clear reward. Give the reader a breakthrough, truth, upgrade, ally, or partial victory, but attach a side effect that keeps the title promise alive.',
    'Chapter 5: long-term hostility. Reveal that a larger hostile force, unresolved mystery, or long-term pressure is now aimed at the protagonist and can sustain the mainline.',
    'Recommended opening pressure curve: medium -> high -> peak -> medium/high -> high.',
    'Do not solve all opening questions by chapter 5; answer one question while creating a larger one.',
  ];

  if (input.targetChapters < 5) {
    lines.push(
      'Compressed opening retention for short books:',
      'Chapter 1 still performs abnormal entry and establishes the title promise.',
      'The final available opening chapter performs irreversible entry and commits the protagonist to the mainline.',
      'Any middle opening chapter performs rising cost or first clear reward.'
    );
  }

  return lines;
}

export function buildOpeningRetentionContextLines(chapterIndex: number) {
  const phase = getOpeningRetentionPhase(chapterIndex);

  if (!phase) {
    return [];
  }

  return [
    'Opening retention phase:',
    `Current opening phase: chapter ${phase.chapterIndex} - ${phase.label} (${phase.englishLabel})`,
    `Required opening effect: ${phase.requiredEffect}`,
  ];
}
