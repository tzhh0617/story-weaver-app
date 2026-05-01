import type {
  ChapterCard,
  NarrativeBible,
  VolumePlan,
} from '../narrative/types.js';
import type { ChapterOutline, OutlineGenerationInput } from '../types.js';

export function parseChapterOutlineLines(
  text: string,
  volumeIndex: number
): ChapterOutline[] {
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [chapterIndex, title, ...outlineParts] = line.split('|');

      return {
        volumeIndex,
        chapterIndex: Number(chapterIndex),
        title: title ?? '',
        outline: outlineParts.join('|'),
      };
    });
}

export function normalizeGeneratedTitle(text: string) {
  return text
    .trim()
    .split('\n')[0]
    .replace(/^["'""''《]+|["'""''》]+$/g, '')
    .trim();
}

export function normalizePlainContextText(text: string) {
  return text
    .trim()
    .split('\n')
    .map((line) =>
      line
        .trim()
        .replace(/^#{1,6}\s+/, '')
        .replace(/^[-*]\s+/, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
    )
    .filter(Boolean)
    .join('\n');
}

export function renderWorldSettingFromBible(
  bible: NarrativeBible,
  input: Pick<OutlineGenerationInput, 'targetChapters' | 'wordsPerChapter'>
) {
  return [
    `目标总章数：${input.targetChapters}`,
    `每章字数：${input.wordsPerChapter}`,
    `故事前提：${bible.premise}`,
    `题材契约：${bible.genreContract}`,
    `读者体验：${bible.targetReaderExperience}`,
    `主题问题：${bible.themeQuestion}`,
    `主题答案方向：${bible.themeAnswerDirection}`,
    `核心戏剧问题：${bible.centralDramaticQuestion}`,
    `语气指南：${bible.voiceGuide}`,
    '世界规则：',
    ...bible.worldRules.map(
      (rule) => `${rule.id}：${rule.ruleText}；代价=${rule.cost}`
    ),
  ].join('\n');
}

export function renderMasterOutlineFromPlans(
  bible: NarrativeBible,
  volumePlans: VolumePlan[]
) {
  return [
    `Central dramatic question: ${bible.centralDramaticQuestion}`,
    ...volumePlans.map(
      (volume) =>
        `Volume ${volume.volumeIndex} ${volume.title}: chapters ${volume.chapterStart}-${volume.chapterEnd}; payoff=${volume.promisedPayoff}; ending=${volume.endingTurn}`
    ),
  ].join('\n');
}

export function chapterOutlinesFromCards(cards: ChapterCard[]): ChapterOutline[] {
  return cards.map((card) => ({
    volumeIndex: card.volumeIndex,
    chapterIndex: card.chapterIndex,
    title: card.title,
    outline: [
      card.plotFunction,
      `必须变化：${card.mustChange}`,
      `外部冲突：${card.externalConflict}`,
      `内部冲突：${card.internalConflict}`,
      `关系变化：${card.relationshipChange}`,
      `章末钩子：${card.endingHook}`,
    ].join('\n'),
  }));
}

export function bibleSummary(bible: NarrativeBible) {
  return [
    `premise: ${bible.premise}`,
    `themeQuestion: ${bible.themeQuestion}`,
    `themeAnswerDirection: ${bible.themeAnswerDirection}`,
    `characters: ${bible.characterArcs.map((character) => `${character.id}/${character.name}`).join(', ')}`,
    `worldRules: ${bible.worldRules.map((rule) => `${rule.id}: ${rule.ruleText}; cost=${rule.cost}`).join('; ')}`,
    `threads: ${bible.narrativeThreads.map((thread) => `${thread.id}: ${thread.promise}`).join('; ')}`,
  ].join('\n');
}

export function volumePlansText(volumePlans: VolumePlan[]) {
  return volumePlans
    .map(
      (volume) =>
        `Volume ${volume.volumeIndex}: ${volume.title}, chapters ${volume.chapterStart}-${volume.chapterEnd}, payoff=${volume.promisedPayoff}`
    )
    .join('\n');
}

export function chapterCardsText(cards: ChapterCard[]) {
  return cards
    .map(
      (card) =>
        `Chapter ${card.chapterIndex}: ${card.title}; function=${card.plotFunction}; mustChange=${card.mustChange}; readerReward=${card.readerReward}; endingHook=${card.endingHook}`
    )
    .join('\n');
}
