import {
  Download,
  Pause,
  Play,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import type { BookExportFormat } from '@story-weaver/shared/contracts';
import { Button } from '../../components/ui/button';
import { getStatusLabel } from '../../status-labels';
import { formatTotalWordCount } from '../../word-count-format';

export type BookHeaderProps = {
  book: { title: string; status: string; wordCount: number };
  currentPhase: string;
  isActive: boolean;
  hasRemainingChapters: boolean;
  hasGeneratedContent: boolean;
  onBackToLibrary?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onRestart?: () => void;
  onExport?: (format: BookExportFormat) => void;
  onDelete?: () => void;
};

export default function BookHeader({
  book,
  currentPhase,
  isActive,
  hasRemainingChapters,
  hasGeneratedContent,
  onBackToLibrary,
  onPause,
  onResume,
  onRestart,
  onExport,
  onDelete,
}: BookHeaderProps) {
  const totalWordCountText = formatTotalWordCount(book.wordCount);
  const canPause = currentPhase !== 'paused' && currentPhase !== 'completed';
  const canResume =
    !isActive && currentPhase !== 'completed' && hasRemainingChapters;

  return (
    <header
      data-testid="book-detail-topbar"
      className="grid gap-4 border-b border-border/60 bg-background/35 px-1 pb-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end"
    >
      <div className="min-w-0">
        {onBackToLibrary ? (
          <button
            type="button"
            className="mb-2 w-fit text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
            onClick={onBackToLibrary}
          >
            返回作品库
          </button>
        ) : null}
        <h1
          data-testid="book-detail-title"
          aria-label={`${book.title}（${getStatusLabel(currentPhase)} · ${totalWordCountText}）`}
          className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 break-words text-2xl font-semibold leading-tight tracking-tight"
        >
          <span className="min-w-0">{book.title}</span>
          <span className="text-xl font-medium text-muted-foreground">
            {`（${getStatusLabel(currentPhase)} · ${totalWordCountText}）`}
          </span>
        </h1>
      </div>
      <div className="flex flex-wrap gap-2 xl:max-w-[52rem] xl:justify-end">
        <Button type="button" size="sm" variant="secondary" onClick={onPause} disabled={!canPause}>
          <Pause aria-hidden="true" />
          暂停
        </Button>
        <Button type="button" size="sm" onClick={onResume} disabled={!canResume}>
          <Play aria-hidden="true" />
          恢复写作
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onRestart}>
          <RotateCcw aria-hidden="true" />
          重新开始
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => onExport?.('txt')}
          disabled={!hasGeneratedContent}
        >
          <Download aria-hidden="true" />
          导出 TXT
        </Button>
        <Button type="button" size="sm" variant="destructive" onClick={onDelete}>
          <Trash2 aria-hidden="true" />
          删除作品
        </Button>
      </div>
    </header>
  );
}
