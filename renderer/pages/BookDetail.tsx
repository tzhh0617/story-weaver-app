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
    <Card className="border-border/70 bg-card/95 p-7">
      <CardHeader className="flex flex-col gap-4 p-0 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <CardTitle>{book.title}</CardTitle>
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
        <Tabs>
          <TabsList className="flex flex-wrap gap-3">
            <TabsTrigger
              aria-selected={activeTab === 'outline'}
              data-state={activeTab === 'outline' ? 'active' : 'inactive'}
              onClick={() => setActiveTab('outline')}
            >
              大纲
            </TabsTrigger>
            <TabsTrigger
              aria-selected={activeTab === 'characters'}
              data-state={activeTab === 'characters' ? 'active' : 'inactive'}
              onClick={() => setActiveTab('characters')}
            >
              人物
            </TabsTrigger>
            <TabsTrigger
              aria-selected={activeTab === 'chapters'}
              data-state={activeTab === 'chapters' ? 'active' : 'inactive'}
              onClick={() => setActiveTab('chapters')}
            >
              章节
            </TabsTrigger>
            <TabsTrigger
              aria-selected={activeTab === 'threads'}
              data-state={activeTab === 'threads' ? 'active' : 'inactive'}
              onClick={() => setActiveTab('threads')}
            >
              伏笔
            </TabsTrigger>
          </TabsList>
          <TabsContent hidden={activeTab !== 'outline'}>
            {context?.worldSetting ? (
              <Card className="border-border/70 bg-muted/40">
                <CardContent className="p-4">
                  <h3>世界观</h3>
                  <p>{context.worldSetting}</p>
                </CardContent>
              </Card>
            ) : null}
            {context?.outline ? (
              <Card className="border-border/70 bg-muted/40">
                <CardContent className="p-4">
                  <h3>总纲</h3>
                  <p>{context.outline}</p>
                </CardContent>
              </Card>
            ) : null}
            {latestScene ? (
              <Card className="border-border/70 bg-muted/40">
                <CardContent className="p-4">
                  <h3>最近场景</h3>
                  <p>{`${latestScene.location} · ${latestScene.timeInStory}`}</p>
                  {latestScene.events ? <p>{latestScene.events}</p> : null}
                </CardContent>
              </Card>
            ) : null}
            {!hasOutlineContent ? (
              <Card className="border-dashed border-border bg-muted/20">
                <CardContent className="p-4">
                  <p>暂无大纲信息</p>
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>
          <TabsContent hidden={activeTab !== 'characters'}>
            {characterStates?.length ? (
              <Card className="border-border/70 bg-muted/40">
                <CardContent className="p-4">
                  <h3>人物状态</h3>
                  <ul className="m-0 pl-5">
                    {characterStates.map((state) => (
                      <li key={state.characterId}>
                        {state.characterName}
                        {state.location ? ` · ${state.location}` : ''}
                        {state.status ? ` · ${state.status}` : ''}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}
            {!characterStates?.length ? (
              <Card className="border-dashed border-border bg-muted/20">
                <CardContent className="p-4">
                  <p>暂无人物状态</p>
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>
          <TabsContent hidden={activeTab !== 'threads'}>
            {plotThreads?.length ? (
              <Card className="border-border/70 bg-muted/40">
                <CardContent className="p-4">
                  <h3>伏笔追踪</h3>
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
                </CardContent>
              </Card>
            ) : null}
            {!plotThreads?.length ? (
              <Card className="border-dashed border-border bg-muted/20">
                <CardContent className="p-4">
                  <p>暂无伏笔追踪</p>
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>
          <TabsContent hidden={activeTab !== 'chapters'}>
            <ScrollArea aria-label="章节滚动区">
              <div className="grid gap-6">
                {renderedChapters.length ? (
                  <ChapterList chapters={renderedChapters} />
                ) : null}
                {!renderedChapters.length ? (
                  <Card className="border-dashed border-border bg-muted/20">
                    <CardContent className="p-4">
                      <p>暂无章节内容</p>
                    </CardContent>
                  </Card>
                ) : null}
                {latestContent ? (
                  <Card className="border-border/70 bg-muted/40">
                <CardContent className="p-4">
                  <h3>正文预览</h3>
                  <p className="whitespace-pre-wrap">{latestContent}</p>
                </CardContent>
              </Card>
            ) : null}
                {latestSummary ? (
                  <Card className="border-border/70 bg-muted/40">
                    <CardContent className="p-4">
                      <h3>章节摘要</h3>
                      <p>{latestSummary}</p>
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
