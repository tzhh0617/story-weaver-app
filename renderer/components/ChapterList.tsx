import { useEffect, useRef } from 'react';

const chapterStatusLabels: Record<'done' | 'writing' | 'queued', string> = {
  done: '已完成',
  writing: '写作中',
  queued: '待写作',
};

const chapterVisualStatusLabels: Record<'done' | 'writing' | 'queued', string> = {
  done: '',
  writing: '写作中',
  queued: '待写',
};

function getChapterVisualMeta(chapter: {
  wordCount: number;
  status: 'done' | 'writing' | 'queued';
}) {
  if (chapter.status === 'done') {
    return `${chapter.wordCount} 字`;
  }

  const statusLabel = chapterVisualStatusLabels[chapter.status];

  if (chapter.wordCount > 0) {
    if (chapter.status === 'queued') {
      return `${chapter.wordCount} 字`;
    }

    return `${chapter.wordCount} 字 · ${statusLabel}`;
  }

  return statusLabel;
}

const AUTO_REVEAL_IDLE_DELAY_MS = 5000;

export default function ChapterList({
  chapters,
  activeChapterId,
  selectedChapterId,
  onSelectChapter,
}: {
  chapters: Array<{
    id: string;
    volumeIndex?: number;
    chapterIndex?: number;
    title: string;
    wordCount: number;
    status: 'done' | 'writing' | 'queued';
  }>;
  activeChapterId?: string | null;
  selectedChapterId?: string | null;
  onSelectChapter?: (chapterId: string) => void;
}) {
  const activeChapterButtonRef = useRef<HTMLButtonElement | null>(null);
  const autoRevealTimerRef = useRef<number | null>(null);
  const lastManualScrollAtRef = useRef(0);
  const activeWritingChapter = chapters.find(
    (chapter) => chapter.id === activeChapterId && chapter.status === 'writing'
  );
  const shouldAutoRevealActiveChapter =
    Boolean(activeWritingChapter) &&
    (!selectedChapterId || selectedChapterId === activeChapterId);

  function clearAutoRevealTimer() {
    if (autoRevealTimerRef.current) {
      window.clearTimeout(autoRevealTimerRef.current);
      autoRevealTimerRef.current = null;
    }
  }

  function scheduleActiveChapterReveal(delayMs = AUTO_REVEAL_IDLE_DELAY_MS) {
    clearAutoRevealTimer();

    if (!shouldAutoRevealActiveChapter) {
      return;
    }

    autoRevealTimerRef.current = window.setTimeout(() => {
      const quietForMs = Date.now() - lastManualScrollAtRef.current;

      if (quietForMs < AUTO_REVEAL_IDLE_DELAY_MS) {
        scheduleActiveChapterReveal(AUTO_REVEAL_IDLE_DELAY_MS - quietForMs);
        return;
      }

      activeChapterButtonRef.current?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'smooth',
      });
    }, delayMs);
  }

  function markManualListScroll() {
    lastManualScrollAtRef.current = Date.now();
    scheduleActiveChapterReveal();
  }

  useEffect(() => {
    lastManualScrollAtRef.current = 0;
    scheduleActiveChapterReveal();

    return clearAutoRevealTimer;
  }, [activeWritingChapter?.id, selectedChapterId, shouldAutoRevealActiveChapter]);

  return (
    <ul
      className="m-0 grid list-none gap-0 p-0"
      onTouchMoveCapture={markManualListScroll}
      onWheelCapture={markManualListScroll}
    >
      {chapters.map((chapter, index) => {
        const isActive = activeChapterId === chapter.id;
        const isSelected = selectedChapterId === chapter.id;
        const previousChapter = chapters[index - 1];
        const shouldShowVolumeLabel =
          chapter.volumeIndex &&
          previousChapter?.volumeIndex !== chapter.volumeIndex;
        const chapterNumber = `第 ${index + 1} 章`;
        const statusLabel = chapterStatusLabels[chapter.status];
        const visualMeta = getChapterVisualMeta(chapter);
        const buttonStateClassName = isActive
          ? 'bg-transparent text-primary'
          : isSelected
            ? 'bg-transparent text-foreground'
            : 'bg-transparent';
        const chapterNumberClassName =
          isActive || isSelected ? 'text-primary' : 'text-muted-foreground';
        const inkWashClassName =
          isActive || isSelected
            ? 'opacity-90'
            : 'opacity-0 group-hover/chapter-row:opacity-70';

        return (
          <li key={chapter.id} className="grid gap-1 py-0.5">
            {shouldShowVolumeLabel ? (
              <div className="px-1.5 pb-1 pt-3 text-[11px] font-semibold text-muted-foreground/85">
                <span>{`第 ${chapter.volumeIndex} 卷`}</span>
              </div>
            ) : null}
            <button
              ref={
                isActive && chapter.status === 'writing'
                  ? activeChapterButtonRef
                  : undefined
              }
              type="button"
              aria-label={`${chapterNumber} · ${chapter.title} ${chapter.wordCount} 字 ${statusLabel}`}
              aria-current={isActive ? 'step' : undefined}
              aria-pressed={isSelected}
              data-selected={isSelected ? 'true' : 'false'}
              className={`group/chapter-row relative flex h-9 w-full items-center gap-1.5 rounded-sm px-1.5 text-left text-sm shadow-none transition-colors ${buttonStateClassName}`}
              onClick={() => onSelectChapter?.(chapter.id)}
            >
              <span
                aria-hidden="true"
                data-ink-wash
                className={`chapter-ink-wash transition-opacity duration-200 ${inkWashClassName}`}
              />
              <span
                className={`relative shrink-0 whitespace-nowrap font-serif text-[13px] font-semibold tabular-nums ${chapterNumberClassName}`}
              >
                {chapterNumber}
              </span>
              <span className="relative min-w-0">
                <span className="relative block truncate font-medium leading-5 text-foreground">
                  {chapter.title}
                </span>
              </span>
              <span className="ml-auto shrink-0 tabular-nums text-[11px] font-medium leading-5 text-muted-foreground/75">
                {visualMeta}
              </span>
            </button>
            <span
              aria-hidden="true"
              data-row-divider
              className="ml-0 h-px bg-border/35 last:hidden"
            />
          </li>
        );
      })}
    </ul>
  );
}
