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
