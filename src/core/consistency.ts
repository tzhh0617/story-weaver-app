type PlotThreadLite = {
  id: string;
  expectedPayoff: number | null;
  resolvedAt: number | null;
};

export function selectOpenThreads(threads: PlotThreadLite[]) {
  return threads
    .filter((thread) => thread.resolvedAt === null)
    .sort(
      (left, right) =>
        (left.expectedPayoff ?? Number.MAX_SAFE_INTEGER) -
        (right.expectedPayoff ?? Number.MAX_SAFE_INTEGER)
    );
}

export function buildChapterContext(input: {
  worldRules: string[];
  personalities: string[];
  recentStates: string[];
  openThreads: string[];
  lastScene: string | null;
  recentSummaries: string[];
  currentChapterOutline: string;
}) {
  return [
    'World rules:',
    ...input.worldRules,
    'Character anchors:',
    ...input.personalities,
    'Recent states:',
    ...input.recentStates,
    'Open threads:',
    ...input.openThreads,
    `Last scene: ${input.lastScene ?? 'none'}`,
    'Recent chapter summaries:',
    ...input.recentSummaries,
    `Current chapter outline: ${input.currentChapterOutline}`,
  ].join('\n');
}
