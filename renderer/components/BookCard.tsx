import ProgressBar from './ProgressBar';
import StatusBadge from './StatusBadge';
import { cn } from '@/lib/utils';

export default function BookCard({
  id,
  title,
  status,
  progress,
  completedChapters,
  totalChapters,
  selected = false,
  onView,
}: {
  id: string;
  title: string;
  status: string;
  progress: number;
  completedChapters?: number;
  totalChapters?: number;
  selected?: boolean;
  onView?: (bookId: string) => void;
}) {
  return (
    <button
      type="button"
      aria-label={title}
      aria-pressed={selected}
      className={cn(
        'grid w-full gap-4 rounded-xl border p-5 text-left transition-colors',
        selected
          ? 'border-primary/50 bg-accent/40'
          : 'bg-card hover:bg-accent/20'
      )}
      onClick={() => onView?.(id)}
    >
      <div className="flex flex-row items-start justify-between gap-4">
        <span className="text-base font-semibold">{title}</span>
        <StatusBadge status={status} />
      </div>
      <div className="grid gap-4">
        <ProgressBar value={progress} />
        {typeof totalChapters === 'number' && totalChapters > 0 ? (
          <p className="m-0 text-sm text-muted-foreground">{`${completedChapters ?? 0}/${totalChapters} 章 · ${progress}%`}</p>
        ) : null}
      </div>
    </button>
  );
}
