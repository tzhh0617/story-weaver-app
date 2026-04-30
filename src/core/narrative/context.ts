type CompactBible = {
  themeQuestion: string;
  themeAnswerDirection: string;
  voiceGuide: string;
};

type CompactChapterCard = {
  title: string;
  plotFunction: string;
  externalConflict: string;
  internalConflict: string;
  relationshipChange: string;
  worldRuleUsedOrTested: string;
  informationReveal: string;
  readerReward: string;
  endingHook: string;
  mustChange: string;
  forbiddenMoves: string[];
};

function appendIfFits(
  lines: string[],
  line: string,
  requiredTail: string,
  maxCharacters: number
) {
  const next = [...lines, line, requiredTail].join('\n');
  if (next.length <= maxCharacters) lines.push(line);
}

export function buildNarrativeCommandContext(input: {
  bible: CompactBible;
  chapterCard: CompactChapterCard;
  hardContinuity: string[];
  characterPressures: string[];
  relationshipActions: string[];
  threadActions: string[];
  worldRules: string[];
  recentSummaries: string[];
  previousChapterEnding: string | null;
  maxCharacters?: number;
}) {
  const requiredTail = [
    'Chapter Mission:',
    `title: ${input.chapterCard.title}`,
    `plotFunction: ${input.chapterCard.plotFunction}`,
    `externalConflict: ${input.chapterCard.externalConflict}`,
    `internalConflict: ${input.chapterCard.internalConflict}`,
    `relationshipChange: ${input.chapterCard.relationshipChange}`,
    `worldRuleUsedOrTested: ${input.chapterCard.worldRuleUsedOrTested}`,
    `informationReveal: ${input.chapterCard.informationReveal}`,
    `readerReward: ${input.chapterCard.readerReward}`,
    `endingHook: ${input.chapterCard.endingHook}`,
    `mustChange: ${input.chapterCard.mustChange}`,
    'Forbidden Moves:',
    ...input.chapterCard.forbiddenMoves,
  ].join('\n');

  const optionalLines = [
    'Hard Continuity:',
    ...input.hardContinuity,
    'Character Pressure:',
    ...input.characterPressures,
    'Relationship Delta:',
    ...input.relationshipActions,
    'Thread Obligations:',
    ...input.threadActions,
    'World Rule and Cost:',
    ...input.worldRules,
    'Theme Pressure:',
    `themeQuestion: ${input.bible.themeQuestion}`,
    `themeAnswerDirection: ${input.bible.themeAnswerDirection}`,
    `voiceGuide: ${input.bible.voiceGuide}`,
    'Recent Summaries:',
    ...input.recentSummaries,
    ...(input.previousChapterEnding
      ? [`Previous Chapter Ending: ${input.previousChapterEnding}`]
      : []),
  ];

  const full = [...optionalLines, requiredTail].join('\n');
  if (!input.maxCharacters || full.length <= input.maxCharacters) return full;
  if (requiredTail.length >= input.maxCharacters) {
    return requiredTail.slice(0, input.maxCharacters);
  }

  const lines: string[] = [];
  for (const line of optionalLines) {
    appendIfFits(lines, line, requiredTail, input.maxCharacters);
  }

  return [...lines, requiredTail].join('\n');
}
