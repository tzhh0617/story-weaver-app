import {
  layoutCardSectionClassName,
} from '../../components/ui/card';
import { DetailEmpty } from './OutlineSection';

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={layoutCardSectionClassName}>
      <div className="mb-3">
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      </div>
      <div className="text-sm leading-7 text-muted-foreground">{children}</div>
    </section>
  );
}

export type NarrativePanelProps = {
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
};

export function CharactersTabContent({
  characterStates,
}: Pick<NarrativePanelProps, 'characterStates'>) {
  return (
    <div className="grid content-start gap-4">
      {characterStates?.length ? (
        <DetailSection title="人物状态">
          <ul className="m-0 grid list-none gap-1 p-0">
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
      {!characterStates?.length ? (
        <DetailEmpty message="暂无人物状态" />
      ) : null}
    </div>
  );
}

export function ThreadsTabContent({
  plotThreads,
}: Pick<NarrativePanelProps, 'plotThreads'>) {
  return (
    <div className="grid content-start gap-4">
      {plotThreads?.length ? (
        <DetailSection title="伏笔追踪">
          <ul className="m-0 grid list-none gap-1 p-0">
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
      {!plotThreads?.length ? (
        <DetailEmpty message="暂无伏笔追踪" />
      ) : null}
    </div>
  );
}
