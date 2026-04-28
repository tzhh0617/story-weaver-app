import { Badge } from './ui/badge';

const chapterStatusLabels: Record<'done' | 'writing' | 'queued', string> = {
  done: '已完成',
  writing: '写作中',
  queued: '待写作',
};

const chapterStatusClasses: Record<'done' | 'writing' | 'queued', string> = {
  done: 'bg-secondary text-secondary-foreground',
  writing: 'bg-primary/10 text-primary border-primary/20',
  queued: 'bg-muted text-muted-foreground',
};

export default function ChapterList({
  chapters,
}: {
  chapters: Array<{
    id: string;
    title: string;
    wordCount: number;
    status: 'done' | 'writing' | 'queued';
  }>;
}) {
  return (
    <ul className="m-0 grid list-none gap-3 p-0">
      {chapters.map((chapter) => (
        <li
          key={chapter.id}
          className="flex items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3"
        >
          <span className="font-medium">{chapter.title}</span>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{`${chapter.wordCount} 字`}</span>
            <Badge className={chapterStatusClasses[chapter.status]}>
              {chapterStatusLabels[chapter.status]}
            </Badge>
          </div>
        </li>
      ))}
    </ul>
  );
}
