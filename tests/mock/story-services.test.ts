import { describe, expect, it } from 'vitest';
import { DEFAULT_MOCK_MODEL_ID } from '../../src/models/runtime-mode';
import {
  createMockStoryServices,
  createMockChapterWriter,
  createMockCharacterStateExtractor,
  createMockOutlineService,
  createMockPlotThreadExtractor,
  createMockSceneRecordExtractor,
  createMockSummaryGenerator,
} from '../../src/mock/story-services';
import { countStoryCharacters } from '../../src/core/story-constraints';

describe('mock story services', () => {
  it('exposes a complete mock service bundle', async () => {
    const services = createMockStoryServices();

    const outline = await services.outlineService.generateFromIdea({
      bookId: 'book-1',
      idea: '债务审理局的一名底层调查员，发现自己欠下的不是钱，而是命。',
      targetChapters: 500,
      wordsPerChapter: 2500,
    });

    expect(services.chapterWriter).toBeTruthy();
    expect(services.summaryGenerator).toBeTruthy();
    expect(services.characterStateExtractor).toBeTruthy();
    expect(services.plotThreadExtractor).toBeTruthy();
    expect(services.sceneRecordExtractor).toBeTruthy();
    expect(outline.worldSetting).toMatch(/[一-龥]/);
  });

  it('builds a Chinese outline bundle with serialized web-novel structure', async () => {
    const service = createMockOutlineService();

    const result = await service.generateFromIdea({
      bookId: 'book-1',
      idea: '一个被宗门逐出的少年，意外继承了会吞噬因果的古镜。',
      targetChapters: 500,
      wordsPerChapter: 2500,
    });

    expect(result.worldSetting).toMatch(/[一-龥]/);
    expect(result.masterOutline).toContain('主线');
    expect(result.volumeOutlines[0]).toContain('卷');
    expect(result.chapterOutlines[0]).toEqual(
      expect.objectContaining({
        volumeIndex: 1,
        chapterIndex: 1,
      })
    );
    expect(result.chapterOutlines[0]?.title).toMatch(/[一-龥]/);
  });

  it('generates exactly the requested number of mock chapter outlines', async () => {
    const service = createMockOutlineService();

    const result = await service.generateFromIdea({
      bookId: 'book-1',
      idea: '一个被宗门逐出的少年，意外继承了会吞噬因果的古镜。',
      targetChapters: 5,
      wordsPerChapter: 120,
    });

    expect(result.chapterOutlines).toHaveLength(5);
    expect(result.chapterOutlines.map((chapter) => chapter.chapterIndex)).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it('emits mock outline pieces as soon as each piece is available', async () => {
    const service = createMockOutlineService();
    const events: string[] = [];

    const result = await service.generateFromIdea({
      bookId: 'book-1',
      idea: '一个被宗门逐出的少年，意外继承了会吞噬因果的古镜。',
      targetChapters: 500,
      wordsPerChapter: 2500,
      onWorldSetting: (worldSetting) => {
        events.push(`world:${worldSetting.includes('题材基调')}`);
      },
      onMasterOutline: (masterOutline) => {
        events.push(`outline:${masterOutline.includes('主线')}`);
      },
      onChapterOutlines: (chapterOutlines) => {
        events.push(`chapters:${chapterOutlines.length}`);
      },
    });

    expect(events).toEqual([
      'world:true',
      'outline:true',
      `chapters:${result.chapterOutlines.length}`,
    ]);
  });

  it('switches to an urban-power style pack when the idea matches that genre', async () => {
    const service = createMockOutlineService();

    const result = await service.generateFromIdea({
      bookId: 'book-2',
      idea: '债务审理局的一名底层调查员，发现自己欠下的不是钱，而是命。',
      targetChapters: 500,
      wordsPerChapter: 2500,
    });

    expect(result.worldSetting).toContain('都市压迫感与爽点并行');
    expect(result.worldSetting).toMatch(/债务审理局|雾港财团|夜巡队|黑市中介/);
    expect(result.masterOutline).toContain('主线');
    expect(result.chapterOutlines[0]?.outline).toMatch(/[一-龥]/);
  });

  it('writes a Chinese chapter with conflict, progression, and a hook ending', async () => {
    const writer = createMockChapterWriter();

    const result = await writer.writeChapter({
      modelId: DEFAULT_MOCK_MODEL_ID,
      prompt: [
        'Book idea: 一个被宗门逐出的少年，意外继承了会吞噬因果的古镜。',
        'Chapter title: 逐出山门',
        'Chapter outline: 主角在众目睽睽之下被废去外门名籍，却在祖祠废井中得到古镜回应。',
      ].join('\n'),
    });

    expect(result.content).toMatch(/[一-龥]/);
    expect(result.content.length).toBeGreaterThan(120);
    expect(result.content).toContain('逐出山门');
    expect(result.content).toMatch(/然而|就在这时|可偏偏/);
  });

  it('treats mock words-per-chapter as a soft target without truncating prose', async () => {
    const writer = createMockChapterWriter();

    const result = await writer.writeChapter({
      modelId: DEFAULT_MOCK_MODEL_ID,
      prompt: [
        'Words per chapter: 90',
        'Book idea: 一个被宗门逐出的少年，意外继承了会吞噬因果的古镜。',
        'Chapter title: 逐出山门',
        'Chapter outline: 主角在众目睽睽之下被废去外门名籍，却在祖祠废井中得到古镜回应。',
      ].join('\n'),
    });

    expect(countStoryCharacters(result.content)).toBeGreaterThan(90);
    expect(result.content).toContain('逐出山门');
    expect(result.content).toMatch(/然而|就在这时|可偏偏/);
  });

  it('writes urban mock chapters with urban-pressure imagery instead of generic xianxia flavor', async () => {
    const writer = createMockChapterWriter();

    const result = await writer.writeChapter({
      modelId: DEFAULT_MOCK_MODEL_ID,
      prompt: [
        'Book idea: 债务审理局的一名底层调查员，发现自己欠下的不是钱，而是命。',
        'Chapter title: 夜市旧账',
        'Chapter outline: 主角在旧城夜市追查一份失踪档案，却发现债务审理局早已把他列入清算名单。',
      ].join('\n'),
    });

    expect(result.content).toContain('夜市旧账');
    expect(result.content).toMatch(/旧城夜市|高架桥下|封账大厅|地下档案库/);
    expect(result.content).not.toContain('山门');
  });

  it('summarizes the chapter in Chinese without placeholder copy', async () => {
    const generator = createMockSummaryGenerator();
    const summary = await generator.summarizeChapter({
      modelId: DEFAULT_MOCK_MODEL_ID,
      content:
        '陆照被执法长老当众逐出山门，跌入祖祠废井后得到古镜回应，并发现当年师尊之死另有隐情。',
    });

    expect(summary).toMatch(/[一-龥]/);
    expect(summary).not.toContain('development-mode');
  });

  it('extracts scene, character, and thread data that matches the generated chapter', async () => {
    const chapterContent = [
      '陆照被逐出山门后，在祖祠废井中听见古镜低鸣。',
      '他意识到师尊留下的遗物并未毁去，反而指向了宗门长老共同掩埋的旧案。',
    ].join('');

  const states = await createMockCharacterStateExtractor().extractStates({
      modelId: DEFAULT_MOCK_MODEL_ID,
      chapterIndex: 1,
      content: chapterContent,
    });
  const scene = await createMockSceneRecordExtractor().extractScene({
      modelId: DEFAULT_MOCK_MODEL_ID,
      chapterIndex: 1,
      content: chapterContent,
    });
  const threads = await createMockPlotThreadExtractor().extractThreads({
      modelId: DEFAULT_MOCK_MODEL_ID,
      chapterIndex: 1,
      content: chapterContent,
    });

    expect(states[0]?.characterName).toBeTruthy();
    expect(scene?.location).toMatch(/[一-龥]/);
    expect(scene?.charactersPresent.length).toBeGreaterThan(0);
    expect(threads.openedThreads.length).toBeGreaterThan(0);
  });

  it('extracts urban scene and state details that stay aligned with urban chapter content', async () => {
    const chapterContent = [
      '霓虹被雨水拉成长线，旧城夜市的广播还在催缴名单。',
      '周澈在摊位尽头翻出失踪档案，意识到债务审理局早就把他列入了清算名单。',
    ].join('');

    const states = await createMockCharacterStateExtractor().extractStates({
      modelId: DEFAULT_MOCK_MODEL_ID,
      chapterIndex: 2,
      content: chapterContent,
    });
    const scene = await createMockSceneRecordExtractor().extractScene({
      modelId: DEFAULT_MOCK_MODEL_ID,
      chapterIndex: 2,
      content: chapterContent,
    });
    const threads = await createMockPlotThreadExtractor().extractThreads({
      modelId: DEFAULT_MOCK_MODEL_ID,
      chapterIndex: 2,
      content: chapterContent,
    });

    expect(states[0]?.characterName).toBe('周澈');
    expect(states[0]?.location).toBe('旧城夜市');
    expect(states[0]?.status).toMatch(/冲突|自保/);
    expect(scene?.location).toBe('旧城夜市');
    expect(scene?.events).toMatch(/新的冲突|旧案/);
    expect(threads.openedThreads.length).toBeGreaterThan(0);
    expect(threads.openedThreads[0]?.description).toMatch(/档案|清算|债务/);
  });
});
