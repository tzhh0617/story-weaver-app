import type { OutlineBundle, OutlineGenerationInput } from '../core/types.js';
import type {
  ChapterCard,
  NarrativeAudit,
  NarrativeBible,
  NarrativeStateDelta,
  VolumePlan,
} from '../core/narrative/types.js';
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

function stableId(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^\dA-Za-z\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'protagonist'
  );
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
const MOCK_CHAPTER_MIN_CHARACTERS = 3000;

function detectProtagonist(content: string) {
  const match = content.match(
    new RegExp(`([${mockSurnamePattern}][\\u4e00-\\u9fa5]{1,2})(?:被|在|听见|意识到|终于|抬头)`)
  );
  return match?.[1] ?? '主角';
}

function buildHookEnding(genre: ChineseWebNovelGenre, seedText: string) {
  return pickFromArray(genre.hookPhrases, `${seedText}:hook`);
}

function countVisibleCharacters(text: string) {
  let count = 0;

  for (const character of text) {
    if (!/\s/u.test(character)) {
      count += 1;
    }
  }

  return count;
}

function buildExpandedMockChapter(input: {
  genre: ChineseWebNovelGenre;
  chapterTitle: string;
  chapterOutline: string;
  protagonist: string;
  location: string;
  openingImage: string;
  pressureSource: string;
  seedText: string;
}) {
  const faction = pickFromArray(
    input.genre.factions,
    `${input.seedText}:main-faction`
  );
  const secondLocation = pickFromArray(
    input.genre.locations,
    `${input.seedText}:second-location`
  );
  const hookEnding = buildHookEnding(input.genre, input.seedText);
  const paragraphs = [
    input.chapterTitle,
    '',
    `${input.openingImage}，${input.location}的空气像被${input.pressureSource}一寸寸压紧。${input.protagonist}站在人群尽头，听着那些刻薄的宣判一字一句落下，连指节都攥得发白。`,
    `${input.chapterOutline}可真正让他心口发冷的，并不是羞辱本身，而是那股从旧物深处缓缓苏醒的回应。`,
  ];
  const beats = [
    `四周的目光像钝刀一样刮过来，有人等着看他跪下，有人已经开始替${faction}计算下一步的好处。${input.protagonist}却把那些声音一层层按进心底，只记住了每个开口者的站位、语气和迟疑。他知道自己现在还不能反击，越是被逼到角落，越要把每一次退让都变成日后翻盘的证据。`,
    `旧物的回应起初极轻，像水面下的钟声。${input.protagonist}低下眼，看见掌心边缘浮出一道几乎不可察觉的纹路，那纹路顺着血脉游走，把他过去忽略的细节一件件推回眼前。原来这场针对他的逼迫并非临时起意，早在${secondLocation}那次异常之后，就有人把他的名字写进了更深的账册。`,
    `他想起师长或同伴曾经说过的话，也想起自己为何一路忍到今天。那些话并没有让他变得软弱，反而像暗处埋下的火星，在此刻一点点亮起来。${input.pressureSource}越重，他越清楚自己不能只求脱身；若今日只是逃走，明日同样的网就会落到更多无辜的人身上。`,
    `人群终于出现裂缝。一个旁观者下意识后退，另一个人仓促按住袖中的传讯符，连负责宣判的人都停顿了半息。${input.protagonist}抓住这半息，抬头望向${faction}所在的方向，声音不高，却足以让周围安静下来。他没有辩解，也没有求饶，只把刚刚看见的破绽逐条说出，每一句都像钉子钉进木板。`,
    `局势随之失控。有人想冲上来堵住他的嘴，有人急着销毁证物，还有人试图把整件事重新包装成误会。可越混乱，隐藏在背后的手越容易露出来。${input.protagonist}在逼近的脚步声中后退半步，故意让自己看起来仍然狼狈，却把真正的退路留给了那道刚刚苏醒的力量。`,
    `那力量没有替他解决一切，只给了他一个选择：付出代价，换取一次看清真相的机会。${input.protagonist}没有立刻答应，因为他明白天下没有白来的转机。可当${input.location}深处传来第二声异响，他终于意识到，对方已经不打算给他活路。既然如此，所谓代价也不再只是损失，而是撕开旧局的刀锋。`,
    `他迈出第一步时，脚下的阴影像被风吹散。那些曾经压得他喘不过气的规矩、账目与罪名，在这一刻露出彼此勾连的缝隙。${faction}并不是唯一的操盘者，${secondLocation}也不是偶然出现的地点，甚至连他被推到众人面前的时间，都像是有人精心算好的节点。`,
    `然而真正的反击并不在此刻爆发。${input.protagonist}强迫自己收住怒意，只拿回最关键的一点主动权。他要让敌人以为他仍然孤立无援，让他们继续把藏在暗处的人叫出来。只要今晚的风再乱一些，只要那份旧账再多翻开一页，他就能顺着裂缝找到最初落笔的人。`,
    `于是他把证物攥进掌心，任由锋利边缘割破皮肤。疼痛让他的意识异常清醒，也让那道苏醒的回应变得更加真切。四周的喧哗被拉得很远，他听见自己的心跳，也听见命运在暗处改写轨迹。退路已经断了，可前方第一次出现了可被他亲手撬开的门。`,
    `等到最后一盏灯影晃动时，${input.protagonist}已经做出了决定。他不会在今晚把所有真相说尽，也不会让敌人看见自己真正握住了什么。他只留下一个足够锋利的疑问，让${faction}不得不追，让旁观者不得不想，让藏在幕后的人不得不提前出手。${hookEnding}`,
  ];

  let beatIndex = 0;
  while (countVisibleCharacters(paragraphs.join('\n')) < MOCK_CHAPTER_MIN_CHARACTERS) {
    paragraphs.push(beats[beatIndex % beats.length]);
    beatIndex += 1;
  }

  return paragraphs.join('\n');
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

function buildMockVolumeOutlines(input: {
  targetChapters: number;
  isUrbanGenre: boolean;
}) {
  const targetChapters = Math.max(0, Math.floor(input.targetChapters));
  const volumeCount = Math.max(1, Math.ceil(targetChapters / 50));
  const themePrefix = input.isUrbanGenre ? '旧城清算' : '因果逆命';

  return Array.from({ length: volumeCount }, (_, index) => {
    const startChapter = index * 50 + 1;
    const endChapter = Math.min((index + 1) * 50, targetChapters);

    return `第${index + 1}卷：${themePrefix}（第${startChapter}-${endChapter}章）`;
  });
}

function buildMockChapterOutlines(input: {
  genre: ChineseWebNovelGenre;
  idea: string;
  protagonist: string;
  firstFaction: string;
  secondFaction: string;
  firstLocation: string;
  secondLocation: string;
  targetChapters: number;
}) {
  const targetChapters = Math.max(0, Math.floor(input.targetChapters));
  const isUrbanGenre = input.genre.id === 'urban-ability';
  const titlePool = isUrbanGenre
    ? ['夜市旧账', '封账名单', '雨巷催缴', '档案回潮', '终局清算']
    : ['逐出山门', '古镜低鸣', '因果初验', '旧案浮灯', '山门回潮'];

  return Array.from({ length: targetChapters }, (_, index) => {
    const globalChapter = index + 1;
    const volumeIndex = Math.floor(index / 50) + 1;
    const title =
      titlePool[index] ?? `${isUrbanGenre ? '旧账' : '因果'}第${globalChapter}转`;
    const location =
      index % 2 === 0 ? input.firstLocation : input.secondLocation;
    const faction =
      index % 2 === 0 ? input.firstFaction : input.secondFaction;
    const pressure = isUrbanGenre
      ? '清算链条'
      : '师门旧案与禁物代价';

    return {
      volumeIndex,
      chapterIndex: globalChapter,
      title,
      outline: `${input.protagonist}在${location}推进第${globalChapter}章目标，直面${faction}制造的${pressure}，并留下下一章必须承接的伏笔。`,
    };
  });
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

      const volumeOutlines = buildMockVolumeOutlines({
        targetChapters: input.targetChapters,
        isUrbanGenre,
      });
      const chapterOutlines = buildMockChapterOutlines({
        genre,
        idea: input.idea,
        protagonist,
        firstFaction,
        secondFaction,
        firstLocation,
        secondLocation,
        targetChapters: input.targetChapters,
      });
      input.onChapterOutlines?.(chapterOutlines);

      const protagonistId = stableId(protagonist);
      const narrativeBible: NarrativeBible = {
        premise: `${protagonist}从最低谷起势，追查旧案真相并重塑命运。`,
        genreContract: `${genre.tone}长篇，主打升级、反转、关系拉扯和规则代价。`,
        targetReaderExperience: '每几章获得一次真相、突破、失败或关系反转。',
        themeQuestion: '人能不能摆脱命运？',
        themeAnswerDirection: '人可以改写命运，但必须承担公开、记忆和关系代价。',
        centralDramaticQuestion: `${protagonist}能否查清旧案并避免成为新的压迫者？`,
        endingState: {
          protagonistWins: '夺回选择权。',
          protagonistLoses: '失去躲在旧身份里的安全。',
          worldChange: '旧秩序被迫公开规则。',
          relationshipOutcome: '关键关系从依附变成并肩。',
          themeAnswer: '自由不是没有代价，而是愿意承担代价。',
        },
        voiceGuide: '中文网文节奏，章末有钩子，冲突推进清楚。',
        characterArcs: [
          {
            id: protagonistId,
            name: protagonist,
            roleType: 'protagonist',
            desire: '查清旧案真相并夺回选择权。',
            fear: '再次被宗门和命运彻底抹除。',
            flaw: '遇到危险时习惯独自承担并隐瞒代价。',
            misbelief: '只要自己掌握规则，就能保护所有重要的人。',
            wound: '幼年亲眼见到家族记录被删去。',
            externalGoal: '找到改写命运的核心证据。',
            internalNeed: '学会公开风险并信任同伴。',
            arcDirection: 'growth',
            decisionLogic: '优先保护弱者，但会把真正代价藏在自己身上。',
            lineWillNotCross: '不主动牺牲无辜者的记忆。',
            lineMayEventuallyCross: '公开自己的禁忌身份。',
            currentArcPhase: 'denial',
          },
        ],
        relationshipEdges: [
          {
            id: `${protagonistId}-ally`,
            fromCharacterId: protagonistId,
            toCharacterId: 'ally-witness',
            visibleLabel: '临时同盟',
            hiddenTruth: '同伴家族也被旧案牵连。',
            dependency: `${protagonist}需要同伴辨认旧案证词。`,
            debt: `${protagonist}欠同伴一次救命人情。`,
            misunderstanding: '同伴以为主角追查只是为了复仇。',
            affection: '信任会在共同承担代价后增长。',
            harmPattern: '主角隐瞒代价会反复伤害同伴。',
            sharedGoal: '查清旧案。',
            valueConflict: '主角倾向隐忍，同伴要求公开。',
            trustLevel: 0,
            tensionLevel: 2,
            currentState: '互相试探',
            plannedTurns: [
              { chapterRange: '1-6', change: '从交易关系变成共同承担风险。' },
            ],
          },
        ],
        worldRules: [
          {
            id: 'record-cost',
            category: 'power',
            ruleText: '改写命运记录会交换等量真实记忆。',
            cost: '失去一段无法恢复的亲身经历。',
            whoBenefits: firstFaction,
            whoSuffers: '被记录系统压迫的普通人',
            taboo: '不可改写死人命格。',
            violationConsequence: '改写者被命簿反噬。',
            allowedException: '以自愿记忆为祭。',
            currentStatus: 'active',
          },
        ],
        narrativeThreads: [
          {
            id: 'main-ledger-truth',
            type: 'main',
            promise: `${protagonist}追查家族旧案为何被命运记录抹除。`,
            plantedAt: 1,
            expectedPayoff: Math.max(3, Math.min(input.targetChapters, 20)),
            resolvedAt: null,
            currentState: 'open',
            importance: 'critical',
            payoffMustChange: 'world',
            ownerCharacterId: protagonistId,
            relatedRelationshipId: null,
            notes: null,
          },
        ],
      };
      const volumePlans: VolumePlan[] = volumeOutlines.map((outline, index) => ({
        volumeIndex: index + 1,
        title: outline.replace(/^第\d+卷：/, '').replace(/（.+$/, ''),
        chapterStart: index * 50 + 1,
        chapterEnd: Math.min((index + 1) * 50, input.targetChapters),
        roleInStory: '推进旧案并扩大规则代价。',
        mainPressure: `${firstFaction}与${secondFaction}持续施压。`,
        promisedPayoff: '每卷兑现一次真相或关系反转。',
        characterArcMovement: `${protagonist}从独自承担走向共享风险。`,
        relationshipMovement: '临时同盟逐步变成共同承担。',
        worldExpansion: '命运记录影响从个人扩展到秩序。',
        endingTurn: '旧秩序露出更深裂口。',
      }));
      const chapterCards: ChapterCard[] = chapterOutlines.map((chapter) => ({
        bookId: input.bookId,
        volumeIndex: chapter.volumeIndex,
        chapterIndex: chapter.chapterIndex,
        title: chapter.title,
        plotFunction: chapter.outline,
        povCharacterId: protagonistId,
        externalConflict: `${firstFaction}逼迫${protagonist}交出线索。`,
        internalConflict: `${protagonist}想独自承担，却需要相信他人。`,
        relationshipChange: `${protagonist}与同伴的信任出现一次可见变化。`,
        worldRuleUsedOrTested: 'record-cost',
        informationReveal: `旧案真相推进到第${chapter.chapterIndex}层。`,
        readerReward: chapter.chapterIndex % 4 === 0 ? 'reversal' : 'truth',
        endingHook: `新的代价在第${chapter.chapterIndex}章末浮出水面。`,
        mustChange: `${protagonist}在第${chapter.chapterIndex}章后不能回到原来的安全状态。`,
        forbiddenMoves: ['不能提前揭示最终幕后主使。'],
      }));

      return {
        worldSetting,
        masterOutline,
        volumeOutlines,
        chapterOutlines,
        narrativeBible,
        volumePlans,
        chapterCards,
        chapterThreadActions: chapterCards.map((card) => ({
          bookId: input.bookId,
          volumeIndex: card.volumeIndex,
          chapterIndex: card.chapterIndex,
          threadId: 'main-ledger-truth',
          action: 'advance',
          requiredEffect: card.informationReveal,
        })),
        chapterCharacterPressures: chapterCards.map((card) => ({
          bookId: input.bookId,
          volumeIndex: card.volumeIndex,
          chapterIndex: card.chapterIndex,
          characterId: protagonistId,
          desirePressure: '旧案线索刺激主角追查欲望。',
          fearPressure: '代价威胁主角被抹除的恐惧。',
          flawTrigger: '主角想隐瞒真正代价。',
          expectedChoice: card.mustChange,
        })),
        chapterRelationshipActions: chapterCards.map((card) => ({
          bookId: input.bookId,
          volumeIndex: card.volumeIndex,
          chapterIndex: card.chapterIndex,
          relationshipId: `${protagonistId}-ally`,
          action: 'deepen',
          requiredChange: card.relationshipChange,
        })),
      };
    },
  };
}

export function createMockChapterWriter() {
  return {
    async writeChapter(input: { modelId: string; prompt: string }) {
      const idea = readPromptField(input.prompt, 'Book idea') ?? '一个被命运压到谷底的人，终于等来了反击的机会。';
      const chapterTitle =
        readPromptField(input.prompt, 'Chapter title') ??
        readPromptField(input.prompt, 'title') ??
        '无名一章';
      const chapterOutline =
        readPromptField(input.prompt, 'Chapter outline') ??
        readPromptField(input.prompt, 'plotFunction') ??
        '主角被迫踏入新的风暴。';
      const genre = detectGenreFromText(`${idea}\n${input.prompt}`);
      const protagonist = pickProtagonistName(genre, idea);
      const location = detectLocation(chapterOutline, genre);
      const openingImage = pickFromArray(genre.openingImages, `${idea}:opening`);
      const pressureSource = pickFromArray(genre.pressureSources, `${idea}:pressure`);

      const content = buildExpandedMockChapter({
        genre,
        chapterTitle,
        chapterOutline,
        protagonist,
        location,
        openingImage,
        pressureSource,
        seedText: input.prompt,
      });

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
  chapterAuditor: {
    auditChapter(input: {
      modelId: string;
      draft: string;
      auditContext: string;
    }): Promise<NarrativeAudit>;
  };
  chapterRevision: {
    reviseChapter(input: { draft: string }): Promise<string>;
  };
  narrativeStateExtractor: {
    extractState(input: {
      modelId: string;
      content: string;
    }): Promise<NarrativeStateDelta>;
  };
  narrativeCheckpoint: {
    reviewCheckpoint(input: {
      bookId: string;
      chapterIndex: number;
    }): Promise<{
      checkpointType: string;
      arcReport: unknown;
      threadDebt: unknown;
      pacingReport: unknown;
      replanningNotes: string | null;
    }>;
  };
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
    chapterAuditor: {
      async auditChapter() {
        return {
          passed: true,
          score: 88,
          decision: 'accept',
          issues: [],
          scoring: {
            characterLogic: 18,
            mainlineProgress: 13,
            relationshipChange: 13,
            conflictDepth: 14,
            worldRuleCost: 9,
            threadManagement: 8,
            pacingReward: 9,
            themeAlignment: 4,
          },
          stateUpdates: {
            characterArcUpdates: ['主角更主动承担代价。'],
            relationshipUpdates: ['信任因共同承担风险而上升。'],
            threadUpdates: ['主线旧案获得新证据。'],
            worldKnowledgeUpdates: ['命运规则的代价更加明确。'],
            themeUpdate: '自由需要承担代价。',
          },
        };
      },
    },
    chapterRevision: {
      async reviseChapter(input: { draft: string }) {
        return `${input.draft}\n\n这一代价没有消失，而是在他心里留下新的缺口。`;
      },
    },
    narrativeStateExtractor: {
      async extractState() {
        return {
          characterStates: [],
          relationshipStates: [],
          threadUpdates: [],
          scene: null,
          themeProgression: '自由需要承担代价。',
        };
      },
    },
    narrativeCheckpoint: {
      async reviewCheckpoint(input: { chapterIndex: number }) {
        return {
          checkpointType: 'arc',
          arcReport: {
            protagonist: `第 ${input.chapterIndex} 章后主角欲望仍清晰。`,
          },
          threadDebt: { critical: [] },
          pacingReport: { readerRewards: '稳定。' },
          replanningNotes: '后续章节无需调整。',
        };
      },
    },
    chapterUpdateExtractor: createMockChapterUpdateExtractor(),
    summaryGenerator: createMockSummaryGenerator(),
    characterStateExtractor: createMockCharacterStateExtractor(),
    plotThreadExtractor: createMockPlotThreadExtractor(),
    sceneRecordExtractor: createMockSceneRecordExtractor(),
  };
}
