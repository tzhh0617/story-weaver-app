import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BookDetail from '@story-weaver/frontend/pages/BookDetail';

describe('BookDetail', () => {
  let scrollIntoViewSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    scrollIntoViewSpy = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoViewSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the detail title and actions inside a compact topbar', () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 12000 }}
        progress={{ phase: 'writing' }}
      />
    );

    const topbar = screen.getByTestId('book-detail-topbar');

    expect(topbar.className).toContain('border-b');
    expect(topbar.className).not.toContain('rounded-[');
    expect(topbar.className).not.toContain('shadow');
    expect(screen.queryByTestId('book-detail-intro-panel')).toBeNull();
    expect(screen.queryByTestId('book-detail-header')).toBeNull();
    expect(screen.queryByText('Manuscript Workspace')).toBeNull();
    expect(
      screen.getByRole('heading', { name: 'Book 1（写作中 · 1.2 万字）' })
    ).toBeInTheDocument();
    expect(screen.getByTestId('book-detail-title').className).toContain(
      'flex-wrap'
    );
    expect(screen.getByTestId('book-detail-title').className).toContain(
      'break-words'
    );
    expect(screen.getByTestId('book-detail-title').className).not.toContain(
      'truncate'
    );
    expect(screen.queryByText('12000 字')).toBeNull();
    expect(screen.getByRole('button', { name: '暂停' })).toBeInTheDocument();
  });

  it('does not show a total progress bar below the detail title', () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 1200 }}
        progress={{ phase: 'writing' }}
        chapters={[
          {
            id: '1-1',
            volumeIndex: 1,
            chapterIndex: 1,
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
            content: '第一章正文',
          },
          {
            id: '1-2',
            volumeIndex: 1,
            chapterIndex: 2,
            title: 'Chapter 2',
            wordCount: 0,
            status: 'writing',
            content: null,
          },
        ]}
      />
    );

    const topbar = screen.getByTestId('book-detail-topbar');

    expect(within(topbar).getByTestId('book-detail-title')).toBeInTheDocument();
    expect(within(topbar).queryByLabelText('总进度条')).toBeNull();
    expect(within(topbar).queryByText('已完成 1 / 2 章 · 50%')).toBeNull();
    expect(screen.queryByLabelText('进度面板')).toBeNull();
  });

  it('allows a writing book to resume when no scheduler task is active', () => {
    const onResume = vi.fn();

    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 1200 }}
        progress={{ phase: 'writing' }}
        isActive={false}
        chapters={[
          {
            id: '1-1',
            volumeIndex: 1,
            chapterIndex: 1,
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
            content: '第一章正文',
          },
          {
            id: '1-2',
            volumeIndex: 1,
            chapterIndex: 2,
            title: 'Chapter 2',
            wordCount: 0,
            status: 'writing',
            content: null,
          },
        ]}
        onResume={onResume}
      />
    );

    const resumeButton = screen.getByRole('button', { name: '恢复写作' });

    expect(resumeButton).toBeEnabled();
    fireEvent.click(resumeButton);
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it('keeps resume disabled while the scheduler is already working on the book', () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 1200 }}
        progress={{ phase: 'writing' }}
        isActive
        chapters={[
          {
            id: '1-1',
            volumeIndex: 1,
            chapterIndex: 1,
            title: 'Chapter 1',
            wordCount: 0,
            status: 'writing',
            content: null,
          },
        ]}
      />
    );

    expect(screen.getByRole('button', { name: '恢复写作' })).toBeDisabled();
  });

  it('renders chapters, reading, and context as fixed workbench panels', async () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 12000 }}
        progress={{ phase: 'writing' }}
        chapters={[
          {
            id: '1-1',
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
            content: 'Generated chapter content',
            summary: 'Chapter summary',
          },
        ]}
      />
    );

    expect(
      screen.getByRole('heading', { name: 'Book 1（写作中 · 1.2 万字）' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('章节列表标题')).toHaveTextContent('章节');
    expect(screen.getByLabelText('正文面板')).toBeInTheDocument();
    expect(screen.queryByLabelText('进度面板')).toBeNull();
    expect(screen.getByLabelText('上下文面板')).toBeInTheDocument();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '章节' })).toBeNull();
    expect(screen.getByRole('tab', { name: '大纲' })).toHaveAttribute('aria-selected', 'true');
    const chapterScrollArea = await screen.findByLabelText('章节滚动区');
    expect(chapterScrollArea).toBeInTheDocument();
    expect(chapterScrollArea.parentElement?.className).toContain('p-2');
  });

  it('shows the selected chapter audit score in the reading header', () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 1200 }}
        progress={{ phase: 'writing' }}
        chapters={[
          {
            id: '1-1',
            volumeIndex: 1,
            chapterIndex: 1,
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
            content: 'Generated chapter content',
            auditScore: 88,
            auditFlatnessScore: 69,
            auditFlatnessIssues: [
              {
                type: 'weak_choice_pressure',
                severity: 'major',
                evidence: '角色只是被线索推着走。',
                fixInstruction: '让角色主动做一个会损失关系信任的选择。',
              },
            ],
          },
        ]}
      />
    );

    expect(screen.getByLabelText('正文面板')).toHaveTextContent('审校 88');
    expect(screen.getByLabelText('正文面板')).toHaveTextContent('防平 69');
    expect(screen.getByLabelText('上下文面板')).toHaveTextContent('防平审计');
    expect(screen.getByLabelText('上下文面板')).toHaveTextContent(
      '弱选择压力 · major'
    );
    expect(screen.getByLabelText('上下文面板')).toHaveTextContent(
      '让角色主动做一个会损失关系信任的选择。'
    );
  });

  it('shows viral story protocol and selected chapter viral audit', () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 1200 }}
        progress={{ phase: 'writing' }}
        narrative={{
          storyBible: {
            themeQuestion: '荣耀是否值得牺牲自由？',
            themeAnswerDirection: '真正的荣耀来自重新选择。',
            centralDramaticQuestion: '林牧能否改写命运契约？',
            viralStoryProtocol: {
              readerPromise: '每三章兑现一次反杀或身份抬升',
              targetEmotion: '爽感',
              coreDesire: '夺回被偷走的人生署名权',
              protagonistDrive: '证明自己不是命运脚注',
              hookEngine: '每次胜利都会暴露更高层级的债主',
              payoffCadence: {
                mode: 'fast',
                minorPayoffEveryChapters: 2,
                majorPayoffEveryChapters: 6,
                payoffTypes: ['反杀', '揭露', '身份抬升'],
              },
              tropeContract: ['废柴逆袭', '契约悬疑'],
              antiClicheRules: ['每次变强都暴露新债务'],
              longTermQuestion: '谁偷走了林牧的命运署名？',
            },
          },
        }}
        chapters={[
          {
            id: '1-1',
            volumeIndex: 1,
            chapterIndex: 1,
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
            content: 'Generated chapter content',
            auditViralScore: 72,
            auditViralIssues: [
              {
                type: 'payoff_without_cost',
                severity: 'major',
                evidence: '主角直接得到线索。',
                fixInstruction: '让线索交换掉一个关系筹码。',
              },
            ],
          },
        ]}
      />
    );

    const contextPanel = screen.getByLabelText('上下文面板');

    expect(within(contextPanel).getByText('爆款策略')).toBeInTheDocument();
    expect(
      within(contextPanel).getByText('每三章兑现一次反杀或身份抬升')
    ).toBeInTheDocument();
    expect(within(contextPanel).getByText('fast · 每 2 章小回报')).toBeInTheDocument();
    expect(within(contextPanel).getByText('爆款审计')).toBeInTheDocument();
    expect(within(contextPanel).getByText('爆款分 72')).toBeInTheDocument();
    expect(within(contextPanel).getByText('回报无代价 · major')).toBeInTheDocument();
    expect(within(contextPanel).getByText('让线索交换掉一个关系筹码。')).toBeInTheDocument();
  });

  it('shows the selected chapter tension budget in the context outline tab', async () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 1200 }}
        progress={{ phase: 'writing' }}
        context={{
          worldSetting: 'World rules',
          outline: 'Master outline',
        }}
        narrative={{
          chapterTensionBudgets: [
            {
              bookId: 'book-1',
              volumeIndex: 1,
              chapterIndex: 1,
              pressureLevel: 'high',
              dominantTension: 'moral_choice',
              requiredTurn: '胜利会伤害同伴。',
              forcedChoice: '保住证据，或救下同伴。',
              costToPay: '失去同伴信任。',
              irreversibleChange: '林牧无法继续旁观。',
              readerQuestion: '谁安排了这次选择？',
              hookPressure: '章末出现更坏记录。',
              flatnessRisks: ['不要用解释代替冲突。'],
            },
          ],
        }}
        chapters={[
          {
            id: '1-1',
            volumeIndex: 1,
            chapterIndex: 1,
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
            content: 'Generated chapter content',
          },
        ]}
      />
    );

    const contextPanel = screen.getByLabelText('上下文面板');

    expect(within(contextPanel).getByText('张力预算')).toBeInTheDocument();
    expect(within(contextPanel).getByText('high · moral_choice')).toBeInTheDocument();
    expect(within(contextPanel).getByText('强制选择')).toBeInTheDocument();
    expect(
      within(contextPanel).getByText('保住证据，或救下同伴。')
    ).toBeInTheDocument();
    expect(within(contextPanel).getAllByText('代价').length).toBeGreaterThan(0);
    expect(
      within(contextPanel).getAllByText('失去同伴信任。').length
    ).toBeGreaterThan(0);
  });

  it('shows opening retention guidance for selected opening chapters', () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 1200 }}
        progress={{ phase: 'writing' }}
        narrative={{
          chapterTensionBudgets: [
            {
              bookId: 'book-1',
              volumeIndex: 1,
              chapterIndex: 1,
              pressureLevel: 'medium',
              dominantTension: 'mystery',
              requiredTurn: '旧页主动回应林牧。',
              forcedChoice: '隐藏旧页或求助。',
              costToPay: '失去安全感。',
              irreversibleChange: '林牧开始追查。',
              readerQuestion: '为什么偏偏是林牧？',
              hookPressure: '有人知道旧页在他手里。',
              flatnessRisks: ['不要解释开局。'],
            },
          ],
        }}
        chapters={[
          {
            id: '1-1',
            volumeIndex: 1,
            chapterIndex: 1,
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
            content: '第一章正文',
          },
        ]}
      />
    );

    const contextPanel = screen.getByLabelText('上下文面板');

    expect(within(contextPanel).getByText('开篇留存')).toBeInTheDocument();
    expect(within(contextPanel).getByText('第 1 章 · 异常入场')).toBeInTheDocument();
    expect(within(contextPanel).getByText('读者问题')).toBeInTheDocument();
    expect(within(contextPanel).getByText('为什么偏偏是林牧？')).toBeInTheDocument();
    expect(within(contextPanel).getAllByText('章末压力').length).toBeGreaterThan(0);
    expect(
      within(contextPanel).getAllByText('有人知道旧页在他手里。').length
    ).toBeGreaterThan(0);
  });

  it('does not show opening retention guidance after chapter five', () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 1200 }}
        progress={{ phase: 'writing' }}
        chapters={[
          {
            id: '1-6',
            volumeIndex: 1,
            chapterIndex: 6,
            title: 'Chapter 6',
            wordCount: 1200,
            status: 'done',
            content: '第六章正文',
          },
        ]}
      />
    );

    expect(screen.getByLabelText('上下文面板')).not.toHaveTextContent('开篇留存');
  });

  it('shows the selected chapter story route summary in the context panel', () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 1200 }}
        progress={{ phase: 'writing' }}
        chapters={[
          {
            id: '1-1',
            volumeIndex: 1,
            chapterIndex: 1,
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
            content: 'Generated chapter content',
            storyRoutePlan: {
              taskType: 'write_chapter',
              requiredSkills: [
                {
                  id: 'chapter-goal',
                  name: '当前章目标',
                  type: 'process',
                  rigidity: 'hard',
                },
                {
                  id: 'hook-technique',
                  name: '钩子技法',
                  type: 'execution',
                  rigidity: 'soft',
                },
              ],
              optionalSkills: [],
              hardConstraints: ['用户本次明确要求优先。'],
              checklist: ['必须完成章节卡 mustChange。'],
              redFlags: ['章末没有追读压力。'],
              warnings: [],
            },
          },
        ]}
      />
    );

    const contextPanel = screen.getByLabelText('上下文面板');

    expect(within(contextPanel).getByText('写作路由')).toBeInTheDocument();
    expect(within(contextPanel).getByText('write_chapter')).toBeInTheDocument();
    expect(within(contextPanel).getByText('当前章目标')).toBeInTheDocument();
    expect(within(contextPanel).getByText('钩子技法')).toBeInTheDocument();
    expect(
      within(contextPanel).getByText('必须完成章节卡 mustChange。')
    ).toBeInTheDocument();
  });

  it('shows a compact tension curve for planned chapter budgets', async () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 1200 }}
        progress={{ phase: 'writing' }}
        narrative={{
          chapterTensionBudgets: [
            {
              bookId: 'book-1',
              volumeIndex: 1,
              chapterIndex: 1,
              pressureLevel: 'medium',
              dominantTension: 'mystery',
              requiredTurn: '线索转向。',
              forcedChoice: '保密或求助。',
              costToPay: '失去安全感。',
              irreversibleChange: '开始追查。',
              readerQuestion: '旧页从何而来？',
              hookPressure: '新线索出现。',
              flatnessRisks: ['不要只解释。'],
            },
            {
              bookId: 'book-1',
              volumeIndex: 1,
              chapterIndex: 2,
              pressureLevel: 'high',
              dominantTension: 'relationship',
              requiredTurn: '同盟破裂。',
              forcedChoice: '信任或隐瞒。',
              costToPay: '失去同伴信任。',
              irreversibleChange: '关系出现裂痕。',
              readerQuestion: '同伴是否还会帮他？',
              hookPressure: '误会升级。',
              flatnessRisks: ['不要让关系回到原点。'],
            },
            {
              bookId: 'book-1',
              volumeIndex: 1,
              chapterIndex: 3,
              pressureLevel: 'peak',
              dominantTension: 'moral_choice',
              requiredTurn: '胜利伤害无辜者。',
              forcedChoice: '救人或保住证据。',
              costToPay: '失去关键证据。',
              irreversibleChange: '公开禁忌身份。',
              readerQuestion: '幕后是否已经发现他？',
              hookPressure: '禁忌身份暴露。',
              flatnessRisks: ['不要无代价胜利。'],
            },
          ],
        }}
        chapters={[
          {
            id: '1-1',
            volumeIndex: 1,
            chapterIndex: 1,
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
            content: '第一章正文',
          },
        ]}
      />
    );

    const tensionCurve = screen.getByLabelText('张力曲线');

    expect(within(tensionCurve).getByText('第 1 章')).toBeInTheDocument();
    expect(within(tensionCurve).getByText('medium · mystery')).toBeInTheDocument();
    expect(within(tensionCurve).getByText('第 2 章')).toBeInTheDocument();
    expect(within(tensionCurve).getByText('high · relationship')).toBeInTheDocument();
    expect(within(tensionCurve).getByText('第 3 章')).toBeInTheDocument();
    expect(within(tensionCurve).getByText('peak · moral_choice')).toBeInTheDocument();
  });

  it('shows checkpoint tension rebalance advice in the context outline tab', () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 1200 }}
        progress={{ phase: 'writing' }}
        narrative={{
          chapterTensionBudgets: [],
          narrativeCheckpoints: [
            {
              bookId: 'book-1',
              chapterIndex: 10,
              checkpointType: 'arc',
              report: {
                tensionCheckpoint: {
                  nextBudgetInstruction:
                    'Switch dominant tension in the next 2 chapters to relationship and moral_choice.',
                },
              },
              futureCardRevisions: [
                {
                  type: 'tension_budget_rebalance',
                  instruction:
                    'Raise pressure in the next 2 chapters and force a visible cost.',
                },
              ],
              createdAt: '2026-04-30T07:00:00.000Z',
            },
          ],
        }}
        chapters={[
          {
            id: '1-1',
            volumeIndex: 1,
            chapterIndex: 1,
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
            content: '第一章正文',
          },
        ]}
      />
    );

    const contextPanel = screen.getByLabelText('上下文面板');

    expect(within(contextPanel).getByText('张力复盘')).toBeInTheDocument();
    expect(
      within(contextPanel).getByText(
        'Switch dominant tension in the next 2 chapters to relationship and moral_choice.'
      )
    ).toBeInTheDocument();
    expect(
      within(contextPanel).getByText(
        'Raise pressure in the next 2 chapters and force a visible cost.'
      )
    ).toBeInTheDocument();
  });

  it('keeps reading visible while switching context tabs', async () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 12000 }}
        context={{
          worldSetting: 'World rules',
          outline: 'Master outline',
        }}
        latestScene={{
          location: 'Rain Market',
          timeInStory: 'Night',
          charactersPresent: ['Lin Mo'],
          events: 'Lin Mo discovers the forged ledger',
        }}
        characterStates={[
          {
            characterId: 'protagonist',
            characterName: 'Lin Mo',
            volumeIndex: 1,
            chapterIndex: 1,
            location: 'Rain Market',
            status: 'Investigating the debt ledger',
            knowledge: null,
            emotion: null,
            powerLevel: null,
          },
        ]}
        plotThreads={[
          {
            id: 'thread-1',
            description: 'Debt clue',
            plantedAt: 1,
            expectedPayoff: 3,
            resolvedAt: null,
            importance: 'normal',
          },
        ]}
        chapters={[
          {
            id: '1-1',
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
            content: 'Generated chapter content',
            summary: 'Chapter summary',
          },
        ]}
      />
    );

    expect(screen.getByText('Generated chapter content')).toBeInTheDocument();
    expect(screen.getByText('总纲')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '大纲' }));

    expect(await screen.findByText('总纲')).toBeInTheDocument();
    expect(screen.getByText('Generated chapter content')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '人物' }));

    const contextPanel = screen.getByLabelText('上下文面板');

    expect(await screen.findByText('人物状态')).toBeInTheDocument();
    expect(within(contextPanel).getByRole('list').className).not.toContain(
      'pl-5'
    );
    expect(screen.queryByText('总纲')).toBeNull();
    expect(screen.getByText('Generated chapter content')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '人物' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('tab', { name: '大纲' })).toHaveAttribute(
      'aria-selected',
      'false'
    );

    fireEvent.click(screen.getByRole('tab', { name: '伏笔' }));

    expect(await screen.findByText('伏笔追踪')).toBeInTheDocument();
    expect(within(contextPanel).getByRole('list').className).not.toContain(
      'pl-5'
    );
    expect(screen.getByText('Generated chapter content')).toBeInTheDocument();
  });

  it('uses the context card header as tabs and keeps the tab body clean', async () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 12000 }}
        context={{
          worldSetting: 'World rules',
          outline: 'Master outline',
        }}
        latestScene={{
          location: 'Rain Market',
          timeInStory: 'Night',
          charactersPresent: ['Lin Mo'],
          events: 'Lin Mo discovers the forged ledger',
        }}
        chapters={[
          {
            id: '1-1',
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
            content: 'Generated chapter content',
          },
        ]}
      />
    );

    const contextPanel = screen.getByLabelText('上下文面板');
    const tabsHeader = within(contextPanel).getByTestId(
      'context-panel-tabs-header'
    );

    expect(within(tabsHeader).getByRole('tab', { name: '场景' })).toBeInTheDocument();
    expect(within(tabsHeader).getByRole('tab', { name: '大纲' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    const tabClassNames = within(tabsHeader)
      .getAllByRole('tab')
      .map((tab) => tab.className);

    expect(new Set(tabClassNames)).toHaveLength(1);
    expect(
      within(contextPanel).queryByRole('heading', { name: '上下文' })
    ).toBeNull();

    fireEvent.click(within(tabsHeader).getByRole('tab', { name: '场景' }));

    expect(await within(contextPanel).findByText('最近场景')).toBeInTheDocument();
    expect(within(contextPanel).getByText('Rain Market · Night')).toBeInTheDocument();
    expect(within(contextPanel).queryByText('总纲')).toBeNull();
  });

  it('shows an empty state when the selected tab has no content yet', async () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 12000 }}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: '人物' }));

    expect(await screen.findByText('暂无人物状态')).toBeInTheDocument();
  });

  it('uses phase-aware empty states while generated material is still arriving', async () => {
    const { rerender } = render(
      <BookDetail
        book={{ title: '新作品', status: 'creating', wordCount: 0 }}
        progress={{ phase: 'naming_title' }}
      />
    );

    expect(await screen.findByText('正在生成书名...')).toBeInTheDocument();

    rerender(
      <BookDetail
        book={{ title: '新作品', status: 'building_world', wordCount: 0 }}
        progress={{ phase: 'building_world' }}
      />
    );
    fireEvent.click(screen.getByRole('tab', { name: '大纲' }));

    expect(await screen.findByText('正在生成世界观...')).toBeInTheDocument();

    rerender(
      <BookDetail
        book={{ title: '月税奇谈', status: 'building_outline', wordCount: 0 }}
        progress={{ phase: 'planning_chapters' }}
        context={{
          worldSetting: 'World rules',
          outline: 'Master outline',
        }}
      />
    );
    expect(await screen.findByText('正在规划章节...')).toBeInTheDocument();
  });

  it('disables actions that are not valid for the current book state', () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'paused', wordCount: 12000 }}
        progress={{ phase: 'paused' }}
        chapters={[
          {
            id: '1-1',
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
            content: 'Generated chapter content',
            summary: 'Chapter summary',
          },
          {
            id: '1-2',
            title: 'Chapter 2',
            wordCount: 0,
            status: 'queued',
            content: null,
            summary: null,
          },
        ]}
      />
    );

    expect(screen.getByRole('button', { name: '暂停' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '恢复写作' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '导出 TXT' })).toBeEnabled();
  });

  it('allows an early paused book to resume before chapters are planned', () => {
    const onResume = vi.fn();

    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'paused', wordCount: 0 }}
        progress={{ phase: 'paused' }}
        chapters={[]}
        onResume={onResume}
      />
    );

    const resumeButton = screen.getByRole('button', { name: '恢复写作' });

    expect(resumeButton).toBeEnabled();
    fireEvent.click(resumeButton);
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it('omits duplicate writing and markdown export actions from the topbar', () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 12000 }}
        progress={{ phase: 'writing' }}
        chapters={[
          {
            id: '1-1',
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
            content: 'Generated chapter content',
          },
          {
            id: '1-2',
            title: 'Chapter 2',
            wordCount: 0,
            status: 'queued',
            content: null,
          },
        ]}
      />
    );

    const topbar = screen.getByTestId('book-detail-topbar');

    expect(within(topbar).queryByRole('button', { name: '写下一章' })).toBeNull();
    expect(within(topbar).queryByRole('button', { name: '连续写作' })).toBeNull();
    expect(within(topbar).queryByRole('button', { name: '导出 MD' })).toBeNull();
    expect(within(topbar).getByRole('button', { name: '导出 TXT' })).toBeInTheDocument();
  });

  it('keeps action labels while adding visual icons to toolbar commands', () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 12000 }}
        progress={{ phase: 'writing' }}
        chapters={[
          {
            id: '1-1',
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
            content: 'Generated chapter content',
          },
          {
            id: '1-2',
            title: 'Chapter 2',
            wordCount: 0,
            status: 'queued',
            content: null,
          },
        ]}
      />
    );

    for (const name of [
      '暂停',
      '恢复写作',
      '重新开始',
      '导出 TXT',
      '删除作品',
    ]) {
      expect(
        screen.getByRole('button', { name }).querySelector('svg')
      ).toBeInTheDocument();
    }
  });

  it('disables export when no chapter content has been generated yet', () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'building_outline', wordCount: 0 }}
        progress={{ phase: 'building_outline' }}
        chapters={[
          {
            id: '1-1',
            title: 'Chapter 1',
            wordCount: 0,
            status: 'queued',
            content: null,
            summary: null,
          },
        ]}
      />
    );

    expect(screen.getByRole('button', { name: '导出 TXT' })).toBeDisabled();
  });

  it('preserves chapter line breaks in the preview area', async () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'completed', wordCount: 1200 }}
        progress={{ phase: 'completed' }}
        chapters={[
          {
            id: '1-1',
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
            content: '第一段\n第二段',
            summary: 'Chapter summary',
          },
        ]}
      />
    );

    expect(
      await screen.findByText(
        (_content, element) =>
          element?.tagName === 'P' && element.textContent === '第一段\n第二段'
      )
    ).toHaveClass('whitespace-pre-wrap');
  });

  it('renders world setting and outline as plain multiline text', async () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 1200 }}
        progress={{ phase: 'writing' }}
        context={{
          worldSetting: '题材基调：废柴逆袭\n故事核心：重建命运',
          outline: '第一卷：开局受辱\n第二卷：反击升级',
        }}
        chapters={[
          {
            id: '1-1',
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
            content: 'Generated chapter content',
            summary: 'Chapter summary',
          },
        ]}
      />
    );

    expect(
      screen.getByText(
        (_content, element) =>
          element?.tagName === 'P' &&
          element.textContent === '题材基调：废柴逆袭\n故事核心：重建命运'
      )
    ).toHaveClass('whitespace-pre-wrap');
    expect(
      screen.getByText(
        (_content, element) =>
          element?.tagName === 'P' &&
          element.textContent === '第一卷：开局受辱\n第二卷：反击升级'
      )
    ).toHaveClass('whitespace-pre-wrap');
  });

  it('renders every planned chapter and highlights the current writing chapter', async () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 1200 }}
        progress={{
          phase: 'writing',
          stepLabel: '正在写第 2 章',
          currentVolume: 1,
          currentChapter: 2,
        }}
        chapters={[
          {
            id: '1-1',
            volumeIndex: 1,
            chapterIndex: 1,
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
            content: '第一章正文',
            outline: 'Opening conflict',
          },
          {
            id: '1-2',
            volumeIndex: 1,
            chapterIndex: 2,
            title: 'Chapter 2',
            wordCount: 0,
            status: 'writing',
            content: null,
            outline: 'Second conflict',
          },
          {
            id: '1-3',
            volumeIndex: 1,
            chapterIndex: 3,
            title: 'Chapter 3',
            wordCount: 0,
            status: 'queued',
            content: null,
            outline: 'Third conflict',
          },
        ]}
      />
    );

    const readingPanel = screen.getByLabelText('正文面板');

    expect(screen.queryByLabelText('进度面板')).toBeNull();
    expect(screen.queryByLabelText('总进度条')).toBeNull();
    expect(within(readingPanel).queryByText('正在写第 2 章')).toBeNull();
    expect(within(readingPanel).queryByText('已完成 1 / 3 章')).toBeNull();
    expect(screen.getByLabelText('章节列表标题')).toHaveTextContent('章节');
    expect(screen.getByLabelText('章节列表标题')).toHaveTextContent('1 / 3');
    expect(screen.getByLabelText('章节列表标题')).not.toHaveTextContent('33%');
    expect(screen.queryByText('章节进度')).toBeNull();
    expect(screen.queryByText('已完成 1')).toBeNull();
    expect(screen.queryByText('写作中 1')).toBeNull();
    expect(screen.queryByText('待写作 1')).toBeNull();
    expect(screen.queryByLabelText('章节筛选')).toBeNull();
    expect(screen.getByRole('button', { name: /第 1 章 · Chapter 1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /第 2 章 · Chapter 2/ })).toHaveAttribute(
      'aria-current',
      'step'
    );
    expect(screen.getByRole('button', { name: /第 3 章 · Chapter 3/ })).toBeInTheDocument();
  });

  it('labels the reading panel with the selected chapter number when available', async () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 1200 }}
        progress={{ phase: 'writing' }}
        chapters={[
          {
            id: '1-1',
            volumeIndex: 1,
            chapterIndex: 1,
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
            content: '第一章正文',
          },
          {
            id: '1-2',
            volumeIndex: 1,
            chapterIndex: 2,
            title: 'Chapter 2',
            wordCount: 1200,
            status: 'done',
            content: '第二章正文',
          },
        ]}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: /第 2 章 · Chapter 2/ }));

    expect(
      within(screen.getByLabelText('正文面板')).getByRole('heading', {
        name: '第 2 章 正文',
      })
    ).toBeInTheDocument();
  });

  it('selects an outline-only chapter and shows an empty manuscript state', async () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 1200 }}
        progress={{ phase: 'writing' }}
        chapters={[
          {
            id: '1-1',
            volumeIndex: 1,
            chapterIndex: 1,
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
            content: '第一章正文',
            outline: 'Opening conflict',
          },
          {
            id: '1-2',
            volumeIndex: 1,
            chapterIndex: 2,
            title: 'Chapter 2',
            wordCount: 0,
            status: 'queued',
            content: null,
            outline: 'Second conflict',
          },
        ]}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: /第 2 章 · Chapter 2/ }));

    const readingPanel = screen.getByLabelText('正文面板');

    expect(within(readingPanel).queryByText('当前章节暂无正文')).toBeNull();
    expect(screen.queryByText('当前查看：第 2 章 · Chapter 2')).toBeNull();
    expect(screen.queryByText('章节大纲')).toBeNull();
    expect(screen.queryByText('Second conflict')).toBeNull();
  });

  it('keeps the reading card focused on manuscript content only', async () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 1200 }}
        progress={{
          phase: 'writing',
          stepLabel: '正在写第 2 章',
          currentVolume: 1,
          currentChapter: 2,
        }}
        chapters={[
          {
            id: '1-1',
            volumeIndex: 1,
            chapterIndex: 1,
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
            content: '第一章正文',
            summary: 'Chapter summary',
          },
          {
            id: '1-2',
            volumeIndex: 1,
            chapterIndex: 2,
            title: 'Chapter 2',
            wordCount: 0,
            status: 'writing',
            content: null,
            outline: 'Second conflict',
          },
        ]}
      />
    );

    const readingPanel = screen.getByLabelText('正文面板');

    expect(readingPanel.className).toContain('grid-rows-[auto_minmax(0,1fr)]');
    expect(
      within(readingPanel).getByRole('heading', { name: '第 2 章 正文' })
    ).toBeInTheDocument();
    expect(within(readingPanel).queryByText('Chapter 2')).toBeNull();
    expect(within(readingPanel).queryByText('当前步骤')).toBeNull();
    expect(within(readingPanel).queryByText(/当前查看/)).toBeNull();
    expect(within(readingPanel).queryByText('章节大纲')).toBeNull();
    expect(within(readingPanel).queryByText('章节摘要')).toBeNull();
    expect(within(readingPanel).queryByText('当前章节暂无正文')).toBeNull();
    expect(within(readingPanel).queryByText('选择章节后查看正文')).toBeNull();
  });

  it('keeps the workbench fixed while chapters, reading, and context scroll internally', async () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 1200 }}
        progress={{ phase: 'writing' }}
        chapters={[
          {
            id: '1-1',
            volumeIndex: 1,
            chapterIndex: 1,
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
            content: '第一章正文',
          },
          {
            id: '1-2',
            volumeIndex: 1,
            chapterIndex: 2,
            title: 'Chapter 2',
            wordCount: 0,
            status: 'queued',
            content: null,
            outline: 'Second conflict',
          },
        ]}
      />
    );

    const chapterScrollArea = await screen.findByLabelText('章节滚动区');
    const readingScrollArea = await screen.findByLabelText('正文滚动区');
    const contextScrollArea = await screen.findByLabelText('上下文滚动区');

    expect(screen.getByTestId('book-detail-workbench').className).toContain(
      'overflow-hidden'
    );
    expect(chapterScrollArea.className).toContain('h-full');
    expect(readingScrollArea.className).toContain('h-full');
    expect(contextScrollArea.className).toContain('h-full');
    expect(chapterScrollArea).toHaveTextContent('Chapter 1');
    expect(chapterScrollArea).not.toHaveTextContent('正文预览');
    expect(chapterScrollArea).not.toHaveTextContent('第一章正文');
    expect(readingScrollArea).toHaveTextContent('第一章正文');
  });

  it('shows streaming chapter output separately from saved chapter content', async () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 1200 }}
        progress={{
          phase: 'writing',
          stepLabel: '正在写第 2 章',
          currentVolume: 1,
          currentChapter: 2,
        }}
        liveOutput={{
          volumeIndex: 1,
          chapterIndex: 2,
          title: 'Chapter 2',
          content: '流式第一段\n流式第二段',
        }}
        chapters={[
          {
            id: '1-1',
            volumeIndex: 1,
            chapterIndex: 1,
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
            content: '第一章正文',
            outline: 'Opening conflict',
          },
          {
            id: '1-2',
            volumeIndex: 1,
            chapterIndex: 2,
            title: 'Chapter 2',
            wordCount: 0,
            status: 'writing',
            content: null,
            outline: 'Second conflict',
          },
        ]}
      />
    );

    expect(
      screen.getByText(
        (_content, element) =>
          element?.tagName === 'P' &&
          element.textContent === '流式第一段\n流式第二段'
      )
    ).toHaveClass('whitespace-pre-wrap');
    expect(screen.queryByText('实时输出')).toBeNull();
    expect(screen.queryByText('正在输出 Chapter 2')).toBeNull();
    expect(screen.queryByText('第 2 章 · 已接收 10 字')).toBeNull();
  });

  it('keeps live stream in the center panel and follows new output', async () => {
    const chapters = [
      {
        id: '1-1',
        volumeIndex: 1,
        chapterIndex: 1,
        title: 'Chapter 1',
        wordCount: 0,
        status: 'writing' as const,
        content: null,
        outline: 'Opening conflict',
      },
    ];

    const { rerender } = render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 0 }}
        progress={{
          phase: 'writing',
          stepLabel: '正在写第 1 章',
          currentVolume: 1,
          currentChapter: 1,
        }}
        liveOutput={{
          volumeIndex: 1,
          chapterIndex: 1,
          title: 'Chapter 1',
          content: '流式第一段',
        }}
        chapters={chapters}
      />
    );

    const readingPanel = screen.getByLabelText('正文面板');
    const contextPanel = screen.getByLabelText('上下文面板');
    const streamPane = await screen.findByTestId('chapter-stream-pane');

    expect(streamPane).toBeInTheDocument();
    expect(screen.queryByLabelText('进度面板')).toBeNull();
    expect(within(readingPanel).queryByText('正在写第 1 章')).toBeNull();
    expect(within(contextPanel).queryByText('正在写第 1 章')).toBeNull();
    expect(within(readingPanel).getByText('流式第一段')).toBeInTheDocument();

    scrollIntoViewSpy.mockClear();

    rerender(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 0 }}
        progress={{
          phase: 'writing',
          stepLabel: '正在写第 1 章',
          currentVolume: 1,
          currentChapter: 1,
        }}
        liveOutput={{
          volumeIndex: 1,
          chapterIndex: 1,
          title: 'Chapter 1',
          content: '流式第一段\n流式第二段',
        }}
        chapters={chapters}
      />
    );

    expect(
      screen.getByText(
        (_content, element) =>
          element?.tagName === 'P' &&
          element.textContent === '流式第一段\n流式第二段'
      )
    ).toBeInTheDocument();
    expect(scrollIntoViewSpy).toHaveBeenCalledWith({
      block: 'end',
      inline: 'nearest',
      behavior: 'smooth',
    });
  });

  it('shows current book realtime logs in a right-side card', async () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 1200 }}
        progress={{ phase: 'writing' }}
        executionLogs={[
          {
            id: 1,
            bookId: 'book-1',
            bookTitle: 'Book 1',
            level: 'info',
            eventType: 'book_progress',
            phase: 'writing',
            message: '正在写第 2 章',
            volumeIndex: 1,
            chapterIndex: 2,
            errorMessage: null,
            createdAt: '2026-04-30T09:10:11.000Z',
          },
          {
            id: 2,
            bookId: 'book-1',
            bookTitle: 'Book 1',
            level: 'success',
            eventType: 'chapter_completed',
            phase: 'writing',
            message: '第 1 章已完成',
            volumeIndex: 1,
            chapterIndex: 1,
            errorMessage: null,
            createdAt: '2026-04-30T09:12:13.000Z',
          },
        ]}
      />
    );

    const logPanel = await screen.findByLabelText('写作动态面板');

    expect(
      within(logPanel).getByRole('heading', { name: '写作动态' })
    ).toBeInTheDocument();
    expect(within(logPanel).getByText('2 条')).toBeInTheDocument();
    expect(within(logPanel).getByText('正在写第 2 章')).toBeInTheDocument();
    expect(within(logPanel).getByText('第 1 章已完成')).toBeInTheDocument();
    expect(within(logPanel).getByText('第 2 章')).toBeInTheDocument();
  });

  it('keeps only the latest twenty writing activity items in the detail panel', async () => {
    const executionLogs = Array.from({ length: 25 }, (_, index) => {
      const logNumber = index + 1;

      return {
        id: logNumber,
        bookId: 'book-1',
        bookTitle: 'Book 1',
        level: 'info' as const,
        eventType: 'book_progress',
        phase: 'writing',
        message: `写作动态 ${logNumber}`,
        volumeIndex: 1,
        chapterIndex: logNumber,
        errorMessage: null,
        createdAt: `2026-04-30T09:${String(logNumber).padStart(2, '0')}:00.000Z`,
      };
    });

    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 1200 }}
        progress={{ phase: 'writing' }}
        executionLogs={executionLogs}
      />
    );

    const activityPanel = await screen.findByLabelText('写作动态面板');

    expect(within(activityPanel).getByText('20 条')).toBeInTheDocument();
    expect(within(activityPanel).queryByText('写作动态 1')).toBeNull();
    expect(within(activityPanel).queryByText('写作动态 5')).toBeNull();
    expect(within(activityPanel).getByText('写作动态 6')).toBeInTheDocument();
    expect(within(activityPanel).getByText('写作动态 25')).toBeInTheDocument();
  });

  it('shows an empty state when the current book has no realtime logs yet', async () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 1200 }}
        progress={{ phase: 'writing' }}
        executionLogs={[]}
      />
    );

    const logPanel = await screen.findByLabelText('写作动态面板');

    expect(
      within(logPanel).getByText('等待当前作品的写作动态...')
    ).toBeInTheDocument();
  });

  it('automatically follows the streaming chapter until the user selects another chapter', async () => {
    const { rerender } = render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 1200 }}
        progress={{ phase: 'writing' }}
        chapters={[
          {
            id: '1-1',
            volumeIndex: 1,
            chapterIndex: 1,
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
            content: '第一章正文',
            outline: 'Opening conflict',
          },
          {
            id: '1-2',
            volumeIndex: 1,
            chapterIndex: 2,
            title: 'Chapter 2',
            wordCount: 0,
            status: 'queued',
            content: null,
            outline: 'Second conflict',
          },
        ]}
      />
    );

    expect(await screen.findByRole('button', { name: /第 1 章 · Chapter 1/ })).toHaveAttribute(
      'data-selected',
      'true'
    );

    rerender(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 1200 }}
        progress={{
          phase: 'writing',
          stepLabel: '正在写第 2 章',
          currentVolume: 1,
          currentChapter: 2,
        }}
        liveOutput={{
          volumeIndex: 1,
          chapterIndex: 2,
          title: 'Chapter 2',
          content: '流式正文',
        }}
        chapters={[
          {
            id: '1-1',
            volumeIndex: 1,
            chapterIndex: 1,
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
            content: '第一章正文',
            outline: 'Opening conflict',
          },
          {
            id: '1-2',
            volumeIndex: 1,
            chapterIndex: 2,
            title: 'Chapter 2',
            wordCount: 0,
            status: 'writing',
            content: null,
            outline: 'Second conflict',
          },
        ]}
      />
    );

    expect(await screen.findByRole('button', { name: /第 2 章 · Chapter 2/ })).toHaveAttribute(
      'data-selected',
      'true'
    );

    fireEvent.click(screen.getByRole('button', { name: /第 1 章 · Chapter 1/ }));

    expect(screen.getByRole('button', { name: /第 1 章 · Chapter 1/ })).toHaveAttribute(
      'data-selected',
      'true'
    );
    expect(screen.getByRole('button', { name: /第 2 章 · Chapter 2/ })).toBeInTheDocument();
    expect(screen.queryByText('正在后台追踪当前写作章节。')).toBeNull();
    expect(screen.queryByRole('button', { name: '回到实时追踪' })).toBeNull();
  });

  it('scrolls the chapter list to the active chapter as soon as the next chapter starts', async () => {
    const chapters = Array.from({ length: 80 }, (_, index) => {
      const chapterIndex = index + 1;

      return {
        id: `1-${chapterIndex}`,
        volumeIndex: 1,
        chapterIndex,
        title: `Chapter ${chapterIndex}`,
        wordCount: index < 58 ? 1200 : 0,
        status: index < 58 ? ('done' as const) : ('queued' as const),
        content: index < 58 ? `第 ${chapterIndex} 章正文` : null,
        outline: `Chapter ${chapterIndex} outline`,
      };
    });

    const { rerender } = render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 69600 }}
        progress={{ phase: 'writing' }}
        chapters={chapters}
      />
    );

    scrollIntoViewSpy.mockClear();

    rerender(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 69600 }}
        progress={{
          phase: 'writing',
          stepLabel: '正在写第 60 章',
          currentVolume: 1,
          currentChapter: 60,
        }}
        chapters={chapters}
      />
    );

    expect(
      await screen.findByRole('button', { name: /第 60 章 · Chapter 60/ })
    ).toHaveAttribute('data-selected', 'true');
    expect(scrollIntoViewSpy).toHaveBeenCalledWith({
      block: 'center',
      inline: 'nearest',
      behavior: 'smooth',
    });
  });

  it('scrolls the manually selected chapter toward the middle of the chapter list', async () => {
    const chapters = Array.from({ length: 80 }, (_, index) => {
      const chapterIndex = index + 1;

      return {
        id: `1-${chapterIndex}`,
        volumeIndex: 1,
        chapterIndex,
        title: `Chapter ${chapterIndex}`,
        wordCount: index < 80 ? 1200 : 0,
        status: 'done' as const,
        content: `第 ${chapterIndex} 章正文`,
        outline: `Chapter ${chapterIndex} outline`,
      };
    });

    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'completed', wordCount: 96000 }}
        progress={{ phase: 'completed' }}
        chapters={chapters}
      />
    );

    scrollIntoViewSpy.mockClear();

    fireEvent.click(
      await screen.findByRole('button', { name: /第 60 章 · Chapter 60/ })
    );

    expect(
      screen.getByRole('button', { name: /第 60 章 · Chapter 60/ })
    ).toHaveAttribute('data-selected', 'true');
    expect(scrollIntoViewSpy).toHaveBeenCalledWith({
      block: 'center',
      inline: 'nearest',
      behavior: 'smooth',
    });
  });

  it('keeps internal detail sections flat inside the page panels', async () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 12000 }}
        progress={{
          phase: 'writing',
          stepLabel: '正在写第 1 章',
          currentVolume: 1,
          currentChapter: 1,
        }}
        chapters={[
          {
            id: '1-1',
            volumeIndex: 1,
            chapterIndex: 1,
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
            content: '第一章正文',
            summary: 'Chapter summary',
          },
        ]}
      />
    );

    expect(screen.getByTestId('book-detail-topbar').className).not.toContain(
      'rounded-['
    );
    expect(screen.getByTestId('book-detail-topbar').className).not.toContain('ring-1');

    const readingPanel = screen.getByLabelText('正文面板');

    expect(readingPanel.className).toContain('grid-rows-[auto_minmax(0,1fr)]');
    expect(screen.queryByLabelText('进度面板')).toBeNull();
    expect(within(readingPanel).queryByText('进度')).toBeNull();
    expect(within(readingPanel).queryByText('当前查看：第 1 章 · Chapter 1')).toBeNull();
    expect(within(readingPanel).queryByText('章节摘要')).toBeNull();
    expect(within(readingPanel).getByText('第一章正文')).toBeInTheDocument();
  });
});
