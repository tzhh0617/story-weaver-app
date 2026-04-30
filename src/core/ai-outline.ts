import {
  buildTitlePrompt,
  buildChapterOutlinePrompt,
  buildMasterOutlinePrompt,
  buildVolumeOutlinePrompt,
  buildWorldPrompt,
} from './prompt-builder.js';
import {
  buildChapterCardPrompt,
  buildNarrativeBiblePrompt,
  buildTensionBudgetPrompt,
  buildVolumePlanPrompt,
} from './narrative/prompts.js';
import { parseJsonObject } from './narrative/json.js';
import { deriveViralStoryProtocol } from './narrative/viral-story-protocol.js';
import {
  validateChapterCards,
  validateNarrativeBible,
  validateTensionBudgets,
  validateVolumePlans,
} from './narrative/validation.js';
import type {
  ChapterCard,
  ChapterCharacterPressure,
  ChapterRelationshipAction,
  ChapterTensionBudget,
  ChapterThreadAction,
  NarrativeBible,
  VolumePlan,
} from './narrative/types.js';
import type {
  ChapterOutline,
  OutlineBundle,
  OutlineGenerationInput,
} from './types.js';
import {
  normalizeChapterOutlinesToTarget,
  renumberChapterOutlinesFrom,
  takeChapterOutlinesWithinTarget,
} from './story-constraints.js';

function parseChapterOutlineLines(
  text: string,
  volumeIndex: number
): ChapterOutline[] {
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [chapterIndex, title, outline] = line.split('|');

      return {
        volumeIndex,
        chapterIndex: Number(chapterIndex),
        title: title ?? '',
        outline: outline ?? '',
      };
    });
}

function normalizeGeneratedTitle(text: string) {
  return text
    .trim()
    .split('\n')[0]
    .replace(/^["'“”‘’《]+|["'“”‘’》]+$/g, '')
    .trim();
}

function normalizePlainContextText(text: string) {
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

function renderWorldSettingFromBible(
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

function renderMasterOutlineFromPlans(
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

function chapterOutlinesFromCards(cards: ChapterCard[]): ChapterOutline[] {
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

function bibleSummary(bible: NarrativeBible) {
  return [
    `premise: ${bible.premise}`,
    `themeQuestion: ${bible.themeQuestion}`,
    `themeAnswerDirection: ${bible.themeAnswerDirection}`,
    `characters: ${bible.characterArcs.map((character) => `${character.id}/${character.name}`).join(', ')}`,
    `worldRules: ${bible.worldRules.map((rule) => `${rule.id}: ${rule.ruleText}; cost=${rule.cost}`).join('; ')}`,
    `threads: ${bible.narrativeThreads.map((thread) => `${thread.id}: ${thread.promise}`).join('; ')}`,
  ].join('\n');
}

function volumePlansText(volumePlans: VolumePlan[]) {
  return volumePlans
    .map(
      (volume) =>
        `Volume ${volume.volumeIndex}: ${volume.title}, chapters ${volume.chapterStart}-${volume.chapterEnd}, payoff=${volume.promisedPayoff}`
    )
    .join('\n');
}

function chapterCardsText(cards: ChapterCard[]) {
  return cards
    .map(
      (card) =>
        `Chapter ${card.chapterIndex}: ${card.title}; function=${card.plotFunction}; mustChange=${card.mustChange}; readerReward=${card.readerReward}; endingHook=${card.endingHook}`
    )
    .join('\n');
}

export function createAiOutlineService(deps: {
  registry: {
    languageModel: (modelId: string) => unknown;
  };
  generateText: (input: {
    model: unknown;
    prompt: string;
  }) => Promise<{ text: string }>;
}) {
  return {
    async generateTitleFromIdea(
      input: OutlineGenerationInput & { modelId: string }
    ): Promise<string> {
      const model = deps.registry.languageModel(input.modelId);

      return normalizeGeneratedTitle(
        (
          await deps.generateText({
            model,
            prompt: buildTitlePrompt(input),
          })
        ).text
      );
    },

    async generateFromIdea(
      input: OutlineGenerationInput & { modelId: string }
    ): Promise<OutlineBundle> {
      const model = deps.registry.languageModel(input.modelId);

      const biblePrompt = buildNarrativeBiblePrompt(input);
      const bibleText = (
        await deps.generateText({
          model,
          prompt: biblePrompt,
        })
      ).text;

      let narrativeBible: NarrativeBible | null = null;
      try {
        narrativeBible = parseJsonObject<NarrativeBible>(bibleText);
      } catch {
        narrativeBible = null;
      }

      if (narrativeBible) {
        const bibleValidation = validateNarrativeBible(narrativeBible, {
          targetChapters: input.targetChapters,
        });
        if (!bibleValidation.valid) {
          throw new Error(`Invalid narrative bible: ${bibleValidation.issues.join('; ')}`);
        }
        const viralStoryProtocol = deriveViralStoryProtocol(narrativeBible, {
          targetChapters: input.targetChapters,
          viralStrategy: input.viralStrategy ?? null,
        });
        narrativeBible = {
          ...narrativeBible,
          viralStoryProtocol,
        };

        const worldSetting = renderWorldSettingFromBible(
          narrativeBible,
          input
        );
        input.onWorldSetting?.(worldSetting);

        const volumePlans = parseJsonObject<VolumePlan[]>(
          (
            await deps.generateText({
              model,
              prompt: buildVolumePlanPrompt({
                targetChapters: input.targetChapters,
                bibleSummary: bibleSummary(narrativeBible),
                viralStoryProtocol,
              }),
            })
          ).text
        );
        const volumeValidation = validateVolumePlans(volumePlans, {
          targetChapters: input.targetChapters,
        });
        if (!volumeValidation.valid) {
          throw new Error(`Invalid volume plans: ${volumeValidation.issues.join('; ')}`);
        }

        const masterOutline = renderMasterOutlineFromPlans(
          narrativeBible,
          volumePlans
        );
        input.onMasterOutline?.(masterOutline);

        const cardBundle = parseJsonObject<{
          cards: Array<Omit<ChapterCard, 'bookId'> & { bookId?: string }>;
          threadActions?: ChapterThreadAction[];
          characterPressures?: ChapterCharacterPressure[];
          relationshipActions?: ChapterRelationshipAction[];
        }>(
          (
            await deps.generateText({
              model,
              prompt: buildChapterCardPrompt({
                bookId: input.bookId,
                targetChapters: input.targetChapters,
                bibleSummary: bibleSummary(narrativeBible),
                volumePlansText: volumePlansText(volumePlans),
                viralStoryProtocol,
              }),
            })
          ).text
        );
        const chapterCards = (cardBundle.cards ?? []).map((card) => ({
          ...card,
          bookId: input.bookId,
        })) as ChapterCard[];
        const cardValidation = validateChapterCards(chapterCards, {
          targetChapters: input.targetChapters,
        });
        if (!cardValidation.valid) {
          throw new Error(`Invalid chapter cards: ${cardValidation.issues.join('; ')}`);
        }

        const generatedTensionBudgets = parseJsonObject<
          Array<Omit<ChapterTensionBudget, 'bookId'> & { bookId?: string }>
        >(
          (
            await deps.generateText({
              model,
              prompt: buildTensionBudgetPrompt({
                bookId: input.bookId,
                targetChapters: input.targetChapters,
                bibleSummary: bibleSummary(narrativeBible),
                volumePlansText: volumePlansText(volumePlans),
                chapterCardsText: chapterCardsText(chapterCards),
                viralStoryProtocol,
              }),
            })
          ).text
        );
        const chapterTensionBudgets = generatedTensionBudgets.map((budget) => ({
          ...budget,
          bookId: input.bookId,
        })) as ChapterTensionBudget[];
        const tensionBudgetValidation = validateTensionBudgets(
          chapterTensionBudgets,
          {
            targetChapters: input.targetChapters,
          }
        );
        if (!tensionBudgetValidation.valid) {
          throw new Error(
            `Invalid tension budgets: ${tensionBudgetValidation.issues.join('; ')}`
          );
        }

        const chapterOutlines = chapterOutlinesFromCards(chapterCards);
        input.onChapterOutlines?.(chapterOutlines);

        return {
          worldSetting,
          masterOutline,
          volumeOutlines: volumePlans.map(
            (volume) =>
              `第${volume.volumeIndex}卷：${volume.title}（第${volume.chapterStart}-${volume.chapterEnd}章）`
          ),
          chapterOutlines,
          narrativeBible,
          volumePlans,
          chapterCards,
          chapterTensionBudgets,
          chapterThreadActions: cardBundle.threadActions ?? [],
          chapterCharacterPressures: cardBundle.characterPressures ?? [],
          chapterRelationshipActions: cardBundle.relationshipActions ?? [],
        };
      }

      const worldSetting = normalizePlainContextText(
        (
          await deps.generateText({
            model,
            prompt: buildWorldPrompt(input),
          })
        ).text
      );
      input.onWorldSetting?.(worldSetting);

      const masterOutline = (
        await deps.generateText({
          model,
          prompt: buildMasterOutlinePrompt(worldSetting, input),
        })
      ).text;
      input.onMasterOutline?.(masterOutline);

      const volumeOutlineText = (
        await deps.generateText({
          model,
          prompt: buildVolumeOutlinePrompt(masterOutline, input),
        })
      ).text;

      const volumeOutlines = volumeOutlineText
        .split('\n---\n')
        .map((outline) => outline.trim())
        .filter(Boolean);

      const chapterOutlines: ChapterOutline[] = [];

      for (const [index, volumeOutline] of volumeOutlines.entries()) {
        if (chapterOutlines.length >= input.targetChapters) {
          break;
        }

        const chapterText = (
          await deps.generateText({
            model,
            prompt: buildChapterOutlinePrompt(volumeOutline, index + 1, input),
          })
        ).text;

        const nextChapterOutlines = renumberChapterOutlinesFrom(
          takeChapterOutlinesWithinTarget({
            chapterOutlines: parseChapterOutlineLines(chapterText, index + 1),
            emittedCount: chapterOutlines.length,
            targetChapters: input.targetChapters,
          }),
          chapterOutlines.length + 1
        );

        if (nextChapterOutlines.length > 0) {
          chapterOutlines.push(...nextChapterOutlines);
          input.onChapterOutlines?.(nextChapterOutlines);
        }
      }

      const normalizedChapterOutlines = normalizeChapterOutlinesToTarget(
        chapterOutlines,
        input.targetChapters
      );
      const missingChapterOutlines = normalizedChapterOutlines.slice(
        chapterOutlines.length
      );
      if (missingChapterOutlines.length > 0) {
        input.onChapterOutlines?.(missingChapterOutlines);
      }

      return {
        worldSetting,
        masterOutline,
        volumeOutlines,
        chapterOutlines: normalizedChapterOutlines,
      };
    },
  };
}
