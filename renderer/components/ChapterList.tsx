import { Badge } from './ui/badge';

const chapterStatusLabels: Record<'done' | 'writing' | 'queued', string> = {
  done: '已完成',
  writing: '写作中',
  queued: '待写作',
};

const chapterStatusClasses: Record<'done' | 'writing' | 'queued', string> = {
  done: 'border-emerald-700/20 bg-emerald-100 text-emerald-800',
  writing: 'bg-primary/10 text-primary border-primary/20',
  queued: 'bg-muted text-muted-foreground',
};

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
  return (
    <ul className="m-0 grid list-none gap-3 p-0">
      {chapters.map((chapter) => {
        const isActive = activeChapterId === chapter.id;
        const isSelected = selectedChapterId === chapter.id;
        const chapterNumber =
          chapter.volumeIndex && chapter.chapterIndex
            ? `第 ${chapter.volumeIndex}.${chapter.chapterIndex} 章`
            : null;

        return (
          <li key={chapter.id}>
            <button
              type="button"
              aria-current={isActive ? 'step' : undefined}
              data-selected={isSelected ? 'true' : 'false'}
              className={`flex w-full items-center justify-between gap-4 rounded-lg border px-4 py-3 text-left shadow-sm transition-colors ${
                isActive
                  ? 'border-primary/45 bg-primary/10'
                  : 'border-border/75 bg-card/90 hover:bg-muted/40'
              }`}
              onClick={() => onSelectChapter?.(chapter.id)}
            >
              <span className="grid min-w-0 gap-1">
                {chapterNumber ? (
                  <span className="text-xs font-medium text-muted-foreground">
                    {chapterNumber}
                  </span>
                ) : null}
                <span className="truncate font-medium">{chapter.title}</span>
              </span>
              <span className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
                <span>{`${chapter.wordCount} 字`}</span>
                <Badge className={chapterStatusClasses[chapter.status]}>
                  {chapterStatusLabels[chapter.status]}
                </Badge>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
