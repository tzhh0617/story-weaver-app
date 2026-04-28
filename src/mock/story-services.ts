import type { OutlineBundle, OutlineGenerationInput } from '../core/types.js';
import {
  chineseWebNovelPack,
  type ChineseWebNovelGenre,
} from './chinese-web-novel-pack.js';

function scoreGenre(text: string, genre: ChineseWebNovelGenre) {
  return genre.keywords.reduce(
    (total, keyword) => total + (text.includes(keyword) ? 1 : 0),
    0
  );
}

function pickGenre(text: string) {
  const normalized = text.trim();
  let bestGenre: ChineseWebNovelGenre = chineseWebNovelPack.genres[0];
  let bestScore = -1;

  for (const genre of chineseWebNovelPack.genres) {
    const score = scoreGenre(normalized, genre);
    if (score > bestScore) {
      bestGenre = genre;
      bestScore = score;
    }
  }

  return bestGenre;
}

function hashText(text: string) {
  let value = 0;
  for (const character of text) {
    value = (value * 31 + character.charCodeAt(0)) >>> 0;
  }
  return value;
}

function pickFromArray<T>(items: readonly T[], seedText: string) {
  return items[hashText(seedText) % items.length];
}

function pickProtagonistName(genre: ChineseWebNovelGenre, seedText: string) {
  return `${pickFromArray(genre.protagonistSurname, `${seedText}:surname`)}${pickFromArray(
    genre.protagonistGiven,
    `${seedText}:given`
  )}`;
}

function readPromptField(prompt: string, field: string) {
  const match = prompt.match(new RegExp(`${field}:\\s*(.+)`));
  return match?.[1]?.trim() ?? null;
}

function detectGenreFromText(text: string) {
  return pickGenre(text);
}

function detectLocation(content: string, genre: ChineseWebNovelGenre) {
  return (
    genre.locations.find((location) => content.includes(location)) ??
    genre.locations[0]
  );
}

function detectTime(content: string) {
  if (content.includes('夜') || content.includes('夜色')) {
    return '深夜';
  }
  if (content.includes('清晨') || content.includes('晨')) {
    return '清晨';
  }
  return '黄昏';
}

const mockSurnamePattern = Array.from(
  new Set(
    chineseWebNovelPack.genres.flatMap((genre) => [...genre.protagonistSurname])
  )
).join('');

function detectProtagonist(content: string) {
  const match = content.match(
    new RegExp(`([${mockSurnamePattern}][\\u4e00-\\u9fa5]{1,2})(?:被|在|听见|意识到|终于|抬头)`)
  );
  return match?.[1] ?? '主角';
}

function buildHookEnding(genre: ChineseWebNovelGenre, seedText: string) {
  return pickFromArray(genre.hookPhrases, `${seedText}:hook`);
}

function buildMockTitle(genre: ChineseWebNovelGenre, idea: string) {
  if (genre.id === 'urban-ability') {
    return pickFromArray(
      ['旧城封账人', '夜市债命档案', '债务审理局'],
      `${idea}:title`
    );
  }

  return pickFromArray(
    ['逐出山门后我执掌因果', '古镜吞因果', '山门旧案'],
    `${idea}:title`
  );
}

export function createMockOutlineService() {
  return {
    async generateTitleFromIdea(input: OutlineGenerationInput): Promise<string> {
      return buildMockTitle(pickGenre(input.idea), input.idea);
    },

    async generateFromIdea(
      input: OutlineGenerationInput
    ): Promise<OutlineBundle> {
      const genre = pickGenre(input.idea);
      const protagonist = pickProtagonistName(genre, input.idea);
      const firstFaction = pickFromArray(genre.factions, `${input.idea}:faction:1`);
      const secondFaction = pickFromArray(genre.factions, `${input.idea}:faction:2`);
      const firstLocation = pickFromArray(genre.locations, `${input.idea}:location:1`);
      const secondLocation = pickFromArray(genre.locations, `${input.idea}:location:2`);
      const isUrbanGenre = genre.id === 'urban-ability';
      const worldSetting = [
        `题材基调：${genre.tone}`,
        `故事核心：${input.idea}`,
        `主角锚点：${protagonist}被卷入${firstFaction}与${secondFaction}共同掩埋的旧案。`,
        `世界规则：力量越强，越要付出与自身因果相关的代价。`,
        `关键场域：${firstLocation}、${secondLocation}。`,
      ].join('\n');
      input.onWorldSetting?.(worldSetting);

      const masterOutline = [
        `目标章节数：${input.targetChapters}`,
        `每章字数：${input.wordsPerChapter}`,
        `主线：${protagonist}从最低谷起势，追查旧案真相并重塑自身命运。`,
        '分卷结构：开局受辱、追查真相、势力碰撞、代价揭露、规则改写。',
        `核心冲突：${genre.conflict}`,
      ].join('\n');
      input.onMasterOutline?.(masterOutline);

      const volumeOutlines = isUrbanGenre
        ? ['第一卷：旧城欠账', '第二卷：档案回潮']
        : ['第一卷：山门尽头', '第二卷：旧案浮灯'];
      const chapterOutlines = isUrbanGenre
        ? [
            {
              volumeIndex: 1,
              chapterIndex: 1,
              title: '夜市旧账',
              outline: `${protagonist}在${firstLocation}追查一份失踪档案，却发现自己已经被${firstFaction}列入清算名单。`,
            },
            {
              volumeIndex: 1,
              chapterIndex: 2,
              title: '封账名单',
              outline: `${protagonist}试图核对债务记录时，发现${secondFaction}正在掩埋一条会把整座旧城拖下水的清算链条。`,
            },
          ]
        : [
            {
              volumeIndex: 1,
              chapterIndex: 1,
              title: '逐出山门',
              outline: `${protagonist}在众目睽睽之下失去身份，却在${firstLocation}中触碰到改变命运的禁物。`,
            },
            {
              volumeIndex: 1,
              chapterIndex: 2,
              title: '古镜低鸣',
              outline: `${protagonist}第一次验证禁物力量，同时意识到${firstFaction}掩埋了与师门旧案有关的真相。`,
            },
          ];
      input.onChapterOutlines?.(chapterOutlines);

      return {
        worldSetting,
        masterOutline,
        volumeOutlines,
        chapterOutlines,
      };
    },
  };
}

export function createMockChapterWriter() {
  return {
    async writeChapter(input: { modelId: string; prompt: string }) {
      const idea = readPromptField(input.prompt, 'Book idea') ?? '一个被命运压到谷底的人，终于等来了反击的机会。';
      const chapterTitle = readPromptField(input.prompt, 'Chapter title') ?? '无名一章';
      const chapterOutline =
        readPromptField(input.prompt, 'Chapter outline') ?? '主角被迫踏入新的风暴。';
      const genre = detectGenreFromText(`${idea}\n${input.prompt}`);
      const protagonist = pickProtagonistName(genre, idea);
      const location = detectLocation(chapterOutline, genre);
      const openingImage = pickFromArray(genre.openingImages, `${idea}:opening`);
      const pressureSource = pickFromArray(genre.pressureSources, `${idea}:pressure`);

      const content = [
        `${chapterTitle}`,
        '',
        `${openingImage}，${location}的空气像被${pressureSource}一寸寸压紧。${protagonist}站在人群尽头，听着那些刻薄的宣判一字一句落下，连指节都攥得发白。`,
        `${chapterOutline}可真正让他心口发冷的，并不是羞辱本身，而是那股从旧物深处缓缓苏醒的回应。`,
        `他原以为自己已经被逼到绝路，可越是低头，越能听见黑暗里那些迟来的声音。旧案没有结束，仇怨也没有被时间吞掉，反而正借着今晚的风重新逼近。`,
        `当${protagonist}终于抬头时，他第一次明白，这场祸事从来不只是针对他个人，而是一张早已布好的网。${buildHookEnding(genre, input.prompt)}`,
      ].join('\n');

      return {
        content,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
        },
      };
    },
  };
}

export function createMockSummaryGenerator() {
  return {
    async summarizeChapter(input: { modelId: string; content: string }) {
      const normalized = input.content.replace(/\s+/g, ' ').trim();
      if (normalized.length <= 60) {
        return normalized;
      }

      return `${normalized.slice(0, 60)}，并由此牵出更深一层的冲突。`;
    },
  };
}

export function createMockCharacterStateExtractor() {
  return {
    async extractStates(input: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) {
      const genre = detectGenreFromText(input.content);
      const protagonist = detectProtagonist(input.content);
      const location = detectLocation(input.content, genre);

      return [
        {
          characterId: protagonist,
          characterName: protagonist,
          location,
          status: input.content.includes('逐出') ? '失去旧有身份，被迫自保' : '被卷入新的冲突',
          knowledge: input.content.includes('旧案')
            ? '意识到旧案并未结束，幕后仍有人操控局势'
            : '察觉到局势开始失控',
          emotion: input.content.includes('低鸣') ? '惊疑与压抑并存' : '警惕',
          powerLevel: input.content.includes('古镜') ? '初触禁物' : '未明',
        },
      ];
    },
  };
}

export function createMockSceneRecordExtractor() {
  return {
    async extractScene(input: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) {
      const genre = detectGenreFromText(input.content);
      const protagonist = detectProtagonist(input.content);

      return {
        location: detectLocation(input.content, genre),
        timeInStory: detectTime(input.content),
        charactersPresent: [protagonist],
        events: input.content.includes('旧案')
          ? `${protagonist}察觉旧案重新浮出水面`
          : `${protagonist}被迫面对新的冲突`,
      };
    },
  };
}

export function createMockPlotThreadExtractor() {
  return {
    async extractThreads(input: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) {
      const openedThreads = [];

      if (input.content.includes('旧案')) {
        openedThreads.push({
          id: `thread-${input.chapterIndex}-old-case`,
          description: '被掩埋的旧案正在重新浮出水面',
          plantedAt: input.chapterIndex,
          expectedPayoff: input.chapterIndex + 4,
          importance: 'critical',
        });
      }

      if (input.content.includes('古镜')) {
        openedThreads.push({
          id: `thread-${input.chapterIndex}-artifact`,
          description: '神秘禁物的来历与代价尚未揭晓',
          plantedAt: input.chapterIndex,
          expectedPayoff: input.chapterIndex + 3,
          importance: 'critical',
        });
      }

      if (
        input.content.includes('档案') ||
        input.content.includes('清算名单') ||
        input.content.includes('债务审理局')
      ) {
        openedThreads.push({
          id: `thread-${input.chapterIndex}-debt-ledger`,
          description: '失踪档案与清算名单背后的债务清算链条尚未查清',
          plantedAt: input.chapterIndex,
          expectedPayoff: input.chapterIndex + 2,
          importance: 'critical',
        });
      }

      return {
        openedThreads,
        resolvedThreadIds: input.content.includes('真相大白')
          ? [`thread-${Math.max(1, input.chapterIndex - 1)}-old-case`]
          : [],
      };
    },
  };
}

export function createMockChapterUpdateExtractor() {
  const summaryGenerator = createMockSummaryGenerator();
  const plotThreadExtractor = createMockPlotThreadExtractor();
  const characterStateExtractor = createMockCharacterStateExtractor();
  const sceneRecordExtractor = createMockSceneRecordExtractor();

  return {
    async extractChapterUpdate(input: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) {
      const [summary, threadUpdates, characterStates, scene] =
        await Promise.all([
          summaryGenerator.summarizeChapter(input),
          plotThreadExtractor.extractThreads(input),
          characterStateExtractor.extractStates(input),
          sceneRecordExtractor.extractScene(input),
        ]);

      return {
        summary,
        openedThreads: threadUpdates.openedThreads,
        resolvedThreadIds: threadUpdates.resolvedThreadIds,
        characterStates,
        scene,
      };
    },
  };
}

export type MockStoryServices = {
  outlineService: ReturnType<typeof createMockOutlineService>;
  chapterWriter: ReturnType<typeof createMockChapterWriter>;
  chapterUpdateExtractor: ReturnType<typeof createMockChapterUpdateExtractor>;
  summaryGenerator: ReturnType<typeof createMockSummaryGenerator>;
  characterStateExtractor: ReturnType<typeof createMockCharacterStateExtractor>;
  plotThreadExtractor: ReturnType<typeof createMockPlotThreadExtractor>;
  sceneRecordExtractor: ReturnType<typeof createMockSceneRecordExtractor>;
};

export function createMockStoryServices(): MockStoryServices {
  return {
    outlineService: createMockOutlineService(),
    chapterWriter: createMockChapterWriter(),
    chapterUpdateExtractor: createMockChapterUpdateExtractor(),
    summaryGenerator: createMockSummaryGenerator(),
    characterStateExtractor: createMockCharacterStateExtractor(),
    plotThreadExtractor: createMockPlotThreadExtractor(),
    sceneRecordExtractor: createMockSceneRecordExtractor(),
  };
}
