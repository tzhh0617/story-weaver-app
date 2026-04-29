function trimCompactNumber(value: number) {
  return Number(value.toFixed(1)).toString();
}

function formatScaledWordCount(wordCount: number, divisor: number, unit: string) {
  const safeWordCount = Number.isFinite(wordCount) ? Math.max(0, wordCount) : 0;

  return `${trimCompactNumber(safeWordCount / divisor)}${unit}`;
}

export function formatTotalWordCount(wordCount: number) {
  return formatScaledWordCount(wordCount, 10000, ' 万字');
}

export function formatChapterWordCount(wordCount: number) {
  return formatScaledWordCount(wordCount, 1000, ' 千字');
}
