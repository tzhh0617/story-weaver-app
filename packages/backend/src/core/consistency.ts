type PlotThreadLite = {
  id: string;
  description?: string;
  plantedAt?: number;
  expectedPayoff: number | null;
  resolvedAt: number | null;
  importance?: string;
};

type ChapterSummaryLite = {
  volumeIndex: number;
  chapterIndex: number;
  summary: string | null;
  content?: string | null;
};

type CharacterStateLite = {
  characterName: string;
  location: string | null;
  status: string | null;
  knowledge: string | null;
  emotion: string | null;
  powerLevel: string | null;
};

type SceneRecordLite = {
  location: string;
  timeInStory: string;
  charactersPresent: string[];
  events: string | null;
};

function chapterMarker(input: { volumeIndex: number; chapterIndex: number }) {
  return input.volumeIndex * 100000 + input.chapterIndex;
}

function splitNonEmptyLines(text: string | null) {
  return (text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function tailText(text: string, maxCharacters: number) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxCharacters) {
    return normalized;
  }

  return normalized.slice(normalized.length - maxCharacters);
}

function formatCharacterState(state: CharacterStateLite) {
  return [
    `${state.characterName}: location=${state.location ?? 'unknown'}`,
    `status=${state.status ?? 'unknown'}`,
    `knowledge=${state.knowledge ?? 'unknown'}`,
    `emotion=${state.emotion ?? 'unknown'}`,
    `power=${state.powerLevel ?? 'unknown'}`,
  ].join('; ');
}

function formatPlotThread(thread: PlotThreadLite) {
  const prefix = [
    `${thread.id}${thread.importance ? ` [${thread.importance}]` : ''}`,
    thread.plantedAt === undefined ? null : `planted=${thread.plantedAt}`,
    `payoff=${thread.expectedPayoff ?? 'unknown'}`,
  ]
    .filter(Boolean)
    .join(' ');

  return thread.description ? `${prefix}: ${thread.description}` : prefix;
}

function formatScene(scene: SceneRecordLite | null) {
  if (!scene) {
    return null;
  }

  return [
    `${scene.timeInStory} at ${scene.location}`,
    `characters=${scene.charactersPresent.join(', ') || 'none'}`,
    scene.events ? `events=${scene.events}` : null,
  ]
    .filter(Boolean)
    .join('; ');
}

function joinLines(lines: string[]) {
  return lines.join('\n');
}

function canAppendLine(input: {
  lines: string[];
  line: string;
  requiredTail: string;
  maxCharacters: number;
}) {
  return (
    joinLines([...input.lines, input.line, input.requiredTail]).length <=
    input.maxCharacters
  );
}

function buildBudgetedChapterContext(input: {
  worldRules: string[];
  personalities: string[];
  recentStates: string[];
  openThreads: string[];
  lastScene: string | null;
  recentSummaries: string[];
  previousChapterEnding?: string | null;
  currentChapterOutline: string;
  maxCharacters?: number;
}) {
  const fullContext = buildChapterContext(input);
  if (!input.maxCharacters || fullContext.length <= input.maxCharacters) {
    return fullContext;
  }

  const requiredTail = `Current chapter outline: ${input.currentChapterOutline}`;
  if (requiredTail.length >= input.maxCharacters) {
    return requiredTail.slice(0, input.maxCharacters);
  }

  const lines: string[] = [];
  const sections: Array<readonly [string, readonly string[]]> = [
    ['World rules:', input.worldRules],
    ['Character anchors:', input.personalities],
    ['Recent states:', input.recentStates],
    ['Open threads:', input.openThreads],
    [`Last scene: ${input.lastScene ?? 'none'}`, []],
    ['Recent chapter summaries:', input.recentSummaries],
  ];

  if (input.previousChapterEnding) {
    sections.push([
      `Previous chapter ending: ${input.previousChapterEnding}`,
      [],
    ]);
  }

  for (const [heading, values] of sections) {
    if (
      canAppendLine({
        lines,
        line: heading,
        requiredTail,
        maxCharacters: input.maxCharacters,
      })
    ) {
      lines.push(heading);
    }

    for (const value of values) {
      if (
        canAppendLine({
          lines,
          line: value,
          requiredTail,
          maxCharacters: input.maxCharacters,
        })
      ) {
        lines.push(value);
      }
    }
  }

  lines.push(requiredTail);
  return joinLines(lines);
}

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
  previousChapterEnding?: string | null;
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
    ...(input.previousChapterEnding
      ? [`Previous chapter ending: ${input.previousChapterEnding}`]
      : []),
    `Current chapter outline: ${input.currentChapterOutline}`,
  ].join('\n');
}

export function buildStoredChapterContext(input: {
  worldSetting: string | null;
  characterStates: CharacterStateLite[];
  plotThreads: PlotThreadLite[];
  latestScene: SceneRecordLite | null;
  chapters: ChapterSummaryLite[];
  currentChapter: {
    volumeIndex: number;
    chapterIndex: number;
    outline: string;
  };
  maxCharacters?: number;
}) {
  const currentMarker = chapterMarker(input.currentChapter);
  const previousChapters = input.chapters.filter(
    (chapter) => chapterMarker(chapter) < currentMarker
  );
  const recentSummaries = previousChapters
    .filter(
      (chapter) =>
        chapter.summary
    )
    .slice(-2)
    .map(
      (chapter) => `Chapter ${chapter.chapterIndex}: ${chapter.summary ?? ''}`
    );
  const previousChapterEnding =
    previousChapters
      .filter((chapter) => chapter.content)
      .slice(-1)
      .map((chapter) => tailText(chapter.content ?? '', 500))[0] ?? null;

  const openThreads = selectOpenThreads(input.plotThreads)
    .filter(
      (thread) =>
        thread.expectedPayoff === null ||
        thread.expectedPayoff >= input.currentChapter.chapterIndex
    )
    .slice(0, 5)
    .map(formatPlotThread);

  return buildBudgetedChapterContext({
    worldRules: splitNonEmptyLines(input.worldSetting).slice(0, 8),
    personalities: [],
    recentStates: input.characterStates.slice(0, 12).map(formatCharacterState),
    openThreads,
    lastScene: formatScene(input.latestScene),
    recentSummaries,
    previousChapterEnding,
    currentChapterOutline: input.currentChapter.outline,
    maxCharacters: input.maxCharacters,
  });
}
