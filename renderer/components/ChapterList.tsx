const chapterStatusLabels: Record<'done' | 'writing' | 'queued', string> = {
  done: '已完成',
  writing: '写作中',
  queued: '待写作',
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
          className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/40 px-4 py-3"
        >
          <span>{chapter.title}</span>
          <span>{`${chapter.wordCount} 字 · ${chapterStatusLabels[chapter.status]}`}</span>
        </li>
      ))}
    </ul>
  );
}
