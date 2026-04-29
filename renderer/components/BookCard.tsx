import ProgressBar from './ProgressBar';
import StatusBadge from './StatusBadge';
import { formatChapterWordCount } from '../word-count-format';

export default function BookCard({
  id,
  title,
  idea,
  status,
  progress,
  targetChapters,
  wordsPerChapter,
  updatedAt,
  completedChapters,
  totalChapters,
  onView,
}: {
  id: string;
  title: string;
  idea: string;
  status: string;
  progress: number;
  targetChapters: number;
  wordsPerChapter: number;
  updatedAt: string;
  completedChapters?: number;
  totalChapters?: number;
  onView?: (bookId: string) => void;
}) {
  const chapterText =
    typeof totalChapters === 'number' && totalChapters > 0
      ? `${completedChapters ?? 0} / ${totalChapters} 章`
      : '章节待生成';
  const targetText = `${targetChapters} 章目标`;
  const chapterLengthText = `${formatChapterWordCount(wordsPerChapter)}/章`;
  const updatedDate = new Date(updatedAt);
  const updatedText = Number.isNaN(updatedDate.getTime())
    ? '最近更新待同步'
    : `最近更新 ${updatedDate.toLocaleDateString('zh-CN')}`;
  const progressText = `${Math.round(progress)}%`;

  return (
    <button
      type="button"
      aria-label={title}
      className="group grid min-h-52 w-full grid-cols-[6rem_minmax(0,1fr)] gap-4 rounded-lg border border-border/80 bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
      onClick={() => onView?.(id)}
    >
      <div
        aria-hidden="true"
        className="relative min-h-44 overflow-hidden rounded-md border border-border/80 bg-[linear-gradient(145deg,hsl(var(--primary)/0.96),hsl(26_38%_45%),hsl(var(--accent)))] shadow-inner"
      >
        <div className="absolute inset-y-0 left-0 w-4 bg-foreground/20" />
        <div className="absolute inset-x-4 top-5 h-px bg-primary-foreground/35" />
        <div className="absolute inset-x-4 bottom-5 h-px bg-foreground/18" />
        <div className="absolute bottom-8 left-5 right-4 rounded-sm border border-primary-foreground/35 bg-primary-foreground/18 px-2 py-1">
          <span className="block truncate text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-primary-foreground/90">
            Manuscript
          </span>
        </div>
      </div>
      <div className="grid min-w-0 content-between gap-4">
        <div className="grid gap-3">
          <div className="flex items-start justify-between gap-3">
            <span className="text-xl font-semibold leading-tight">{title}</span>
            <StatusBadge status={status} />
          </div>
          <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
            {idea}
          </p>
        </div>
        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <span>章节进度</span>
            <span>{progressText}</span>
          </div>
          <ProgressBar value={progress} />
          <div className="grid gap-2 border-t border-border/70 pt-3 text-xs text-muted-foreground sm:grid-cols-3">
            <span>{targetText}</span>
            <span>{chapterLengthText}</span>
            <span>{chapterText}</span>
          </div>
          <span className="text-xs text-muted-foreground">{updatedText}</span>
        </div>
      </div>
    </button>
  );
}
