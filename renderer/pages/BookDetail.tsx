import { useState } from 'react';
import type { BookExportFormat } from '../../src/shared/contracts';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { getStatusLabel } from '../status-labels';
import ChapterList from '../components/ChapterList';

type DetailTab = 'outline' | 'characters' | 'chapters' | 'threads';

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="bg-muted/40">
      <CardHeader className="pb-3">
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function DetailEmpty({
  message,
}: {
  message: string;
}) {
  return (
    <Card className="border-dashed bg-muted/20 shadow-none">
      <CardContent className="p-4">
        <p>{message}</p>
      </CardContent>
    </Card>
  );
}

export default function BookDetail({
  book,
  context,
  latestScene,
  characterStates,
  plotThreads,
  chapters,
  progress,
  onPause,
  onResume,
  onRestart,
  onWriteNext,
  onWriteAll,
  onExport,
  onDelete,
}: {
  book: { title: string; status: string; wordCount: number };
  context?: {
    worldSetting?: string | null;
    outline?: string | null;
  } | null;
  latestScene?: {
    location: string;
    timeInStory: string;
    charactersPresent: string[];
    events: string | null;
  } | null;
  characterStates?: Array<{
    characterId: string;
    characterName: string;
    volumeIndex: number;
    chapterIndex: number;
    location: string | null;
    status: string | null;
    knowledge: string | null;
    emotion: string | null;
    powerLevel: string | null;
  }>;
  plotThreads?: Array<{
    id: string;
    description: string;
    plantedAt: number;
    expectedPayoff: number | null;
    resolvedAt: number | null;
    importance: string;
  }>;
  chapters?: Array<{
    id?: string;
    volumeIndex?: number;
    chapterIndex?: number;
    title: string;
    wordCount: number;
    status: 'done' | 'writing' | 'queued';
    content?: string | null;
    summary?: string | null;
  }>;
  progress?: {
    phase?: string | null;
  } | null;
  onPause?: () => void;
  onResume?: () => void;
  onRestart?: () => void;
  onWriteNext?: () => void;
  onWriteAll?: () => void;
  onExport?: (format: BookExportFormat) => void;
  onDelete?: () => void;
}) {
  const renderedChapters =
    chapters?.map((chapter) => ({
      id:
        chapter.id ??
        `${chapter.volumeIndex ?? 0}-${chapter.chapterIndex ?? 0}`,
      title: chapter.title,
      wordCount: chapter.wordCount,
      status: chapter.status,
  })) ?? [];
  const latestContent = chapters?.find((chapter) => chapter.content)?.content;
  const latestSummary = chapters?.find((chapter) => chapter.summary)?.summary;
  const [activeTab, setActiveTab] = useState<DetailTab>('outline');
  const hasOutlineContent = Boolean(
    context?.worldSetting || context?.outline || latestScene
  );
  const currentPhase = progress?.phase ?? book.status;
  const hasRemainingChapters = Boolean(
    chapters?.some((chapter) => chapter.status !== 'done')
  );
  const hasGeneratedContent = Boolean(
    chapters?.some((chapter) => chapter.content && chapter.content.trim().length > 0)
  );
  const canPause = currentPhase !== 'paused' && currentPhase !== 'completed';
  const canResume = currentPhase === 'paused';
  const canWrite = hasRemainingChapters && currentPhase !== 'paused' && currentPhase !== 'completed';

  return (
    <Card className="rounded-2xl p-7 shadow-none">
      <CardHeader className="flex flex-col gap-4 p-0 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{book.title}</h2>
          <p>{`${getStatusLabel(progress?.phase ?? book.status)} · ${book.wordCount} 字`}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="secondary" onClick={onPause} disabled={!canPause}>
            暂停
          </Button>
          <Button type="button" onClick={onResume} disabled={!canResume}>
            恢复写作
          </Button>
          <Button type="button" variant="outline" onClick={onRestart}>
            重新开始
          </Button>
          <Button type="button" variant="outline" onClick={onWriteNext} disabled={!canWrite}>
            写下一章
          </Button>
          <Button type="button" variant="outline" onClick={onWriteAll} disabled={!canWrite}>
            连续写作
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onExport?.('txt')}
            disabled={!hasGeneratedContent}
          >
            导出 TXT
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onExport?.('md')}
            disabled={!hasGeneratedContent}
          >
            导出 MD
          </Button>
          <Button type="button" variant="destructive" onClick={onDelete}>
            删除作品
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 p-0">
        <Separator />
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DetailTab)}>
          <TabsList className="flex flex-wrap gap-3">
            <TabsTrigger value="outline" onClick={() => setActiveTab('outline')}>
              大纲
            </TabsTrigger>
            <TabsTrigger
              value="characters"
              onClick={() => setActiveTab('characters')}
            >
              人物
            </TabsTrigger>
            <TabsTrigger value="chapters" onClick={() => setActiveTab('chapters')}>
              章节
            </TabsTrigger>
            <TabsTrigger value="threads" onClick={() => setActiveTab('threads')}>
              伏笔
            </TabsTrigger>
          </TabsList>
          <TabsContent value="outline" className="grid gap-6">
            {context?.worldSetting ? (
              <DetailSection title="世界观">
                <p>{context.worldSetting}</p>
              </DetailSection>
            ) : null}
            {context?.outline ? (
              <DetailSection title="总纲">
                <p>{context.outline}</p>
              </DetailSection>
            ) : null}
            {latestScene ? (
              <DetailSection title="最近场景">
                <p>{`${latestScene.location} · ${latestScene.timeInStory}`}</p>
                {latestScene.events ? <p>{latestScene.events}</p> : null}
              </DetailSection>
            ) : null}
            {!hasOutlineContent ? (
              <DetailEmpty message="暂无大纲信息" />
            ) : null}
          </TabsContent>
          <TabsContent value="characters" className="grid gap-6">
            {characterStates?.length ? (
              <DetailSection title="人物状态">
                <ul className="m-0 pl-5">
                  {characterStates.map((state) => (
                    <li key={state.characterId}>
                      {state.characterName}
                      {state.location ? ` · ${state.location}` : ''}
                      {state.status ? ` · ${state.status}` : ''}
                    </li>
                  ))}
                </ul>
              </DetailSection>
            ) : null}
            {!characterStates?.length ? <DetailEmpty message="暂无人物状态" /> : null}
          </TabsContent>
          <TabsContent value="threads" className="grid gap-6">
            {plotThreads?.length ? (
              <DetailSection title="伏笔追踪">
                <ul className="m-0 pl-5">
                  {plotThreads.map((thread) => (
                    <li key={thread.id}>
                      {thread.description}
                      {thread.resolvedAt
                        ? ` · 已回收（第 ${thread.resolvedAt} 章）`
                        : ` · 待回收（预计第 ${thread.expectedPayoff ?? '?'} 章）`}
                    </li>
                  ))}
                </ul>
              </DetailSection>
            ) : null}
            {!plotThreads?.length ? <DetailEmpty message="暂无伏笔追踪" /> : null}
          </TabsContent>
          <TabsContent value="chapters" className="grid gap-6">
            <ScrollArea aria-label="章节滚动区">
              <div className="grid gap-6">
                {renderedChapters.length ? (
                  <ChapterList chapters={renderedChapters} />
                ) : null}
                {!renderedChapters.length ? <DetailEmpty message="暂无章节内容" /> : null}
                {latestContent ? (
                  <DetailSection title="正文预览">
                    <p className="whitespace-pre-wrap">{latestContent}</p>
                  </DetailSection>
                ) : null}
                {latestSummary ? (
                  <DetailSection title="章节摘要">
                    <p>{latestSummary}</p>
                  </DetailSection>
                ) : null}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
