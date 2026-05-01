import {
  buildChapterCardPrompt,
  buildNarrativeBiblePrompt,
  buildTensionBudgetPrompt,
  buildVolumePlanPrompt,
} from '../narrative/prompts.js';
import { parseJsonObject } from '../narrative/json.js';
import { deriveViralStoryProtocol } from '../narrative/viral-story-protocol.js';
import {
  validateChapterCards,
  validateNarrativeBible,
  validateTensionBudgets,
  validateVolumePlans,
} from '../narrative/validation/index.js';
import type {
  ChapterCard,
  ChapterCharacterPressure,
  ChapterRelationshipAction,
  ChapterTensionBudget,
  ChapterThreadAction,
  NarrativeBible,
  VolumePlan,
} from '../narrative/types.js';
import type { OutlineBundle, OutlineGenerationInput } from '../types.js';
import {
  normalizeChapterThreadActions,
  normalizeChapterCharacterPressures,
  normalizeChapterRelationshipActions,
} from './normalization.js';
import {
  bibleSummary,
  chapterCardsText,
  chapterOutlinesFromCards,
  renderWorldSettingFromBible,
  renderMasterOutlineFromPlans,
  volumePlansText,
} from './rendering.js';

type GeneratorContext = {
  generateText: (input: {
    model: unknown;
    prompt: string;
  }) => Promise<{ text: string }>;
  model: unknown;
  input: OutlineGenerationInput & { modelId: string };
};

export async function generateBibleBasedBundle(
  ctx: GeneratorContext
): Promise<OutlineBundle | null> {
  const biblePrompt = buildNarrativeBiblePrompt(ctx.input);
  const bibleText = (
    await ctx.generateText({
      model: ctx.model,
      prompt: biblePrompt,
    })
  ).text;

  let narrativeBible: NarrativeBible | null = null;
  try {
    narrativeBible = parseJsonObject<NarrativeBible>(bibleText);
  } catch {
    narrativeBible = null;
  }

  if (!narrativeBible) {
    return null;
  }

  const bibleValidation = validateNarrativeBible(narrativeBible, {
    targetChapters: ctx.input.targetChapters,
  });
  if (!bibleValidation.valid) {
    throw new Error(
      `Invalid narrative bible: ${bibleValidation.issues.join('; ')}`
    );
  }
  const viralStoryProtocol = deriveViralStoryProtocol(narrativeBible, {
    targetChapters: ctx.input.targetChapters,
    viralStrategy: ctx.input.viralStrategy ?? null,
  });
  narrativeBible = {
    ...narrativeBible,
    viralStoryProtocol,
  };

  const worldSetting = renderWorldSettingFromBible(narrativeBible, ctx.input);
  ctx.input.onWorldSetting?.(worldSetting);

  const volumePlans = parseJsonObject<VolumePlan[]>(
    (
      await ctx.generateText({
        model: ctx.model,
        prompt: buildVolumePlanPrompt({
          targetChapters: ctx.input.targetChapters,
          bibleSummary: bibleSummary(narrativeBible),
          viralStoryProtocol,
        }),
      })
    ).text
  );
  const volumeValidation = validateVolumePlans(volumePlans, {
    targetChapters: ctx.input.targetChapters,
  });
  if (!volumeValidation.valid) {
    throw new Error(
      `Invalid volume plans: ${volumeValidation.issues.join('; ')}`
    );
  }

  const masterOutline = renderMasterOutlineFromPlans(
    narrativeBible,
    volumePlans
  );
  ctx.input.onMasterOutline?.(masterOutline);

  const cardBundle = parseJsonObject<{
    cards: Array<Omit<ChapterCard, 'bookId'> & { bookId?: string }>;
    threadActions?: ChapterThreadAction[];
    characterPressures?: ChapterCharacterPressure[];
    relationshipActions?: ChapterRelationshipAction[];
  }>(
    (
      await ctx.generateText({
        model: ctx.model,
        prompt: buildChapterCardPrompt({
          bookId: ctx.input.bookId,
          targetChapters: ctx.input.targetChapters,
          bibleSummary: bibleSummary(narrativeBible),
          volumePlansText: volumePlansText(volumePlans),
          viralStoryProtocol,
        }),
      })
    ).text
  );
  const chapterCards = (cardBundle.cards ?? []).map((card) => ({
    ...card,
    bookId: ctx.input.bookId,
  })) as ChapterCard[];
  const cardValidation = validateChapterCards(chapterCards, {
    targetChapters: ctx.input.targetChapters,
  });
  if (!cardValidation.valid) {
    throw new Error(
      `Invalid chapter cards: ${cardValidation.issues.join('; ')}`
    );
  }

  const generatedTensionBudgets = parseJsonObject<
    Array<Omit<ChapterTensionBudget, 'bookId'> & { bookId?: string }>
  >(
    (
      await ctx.generateText({
        model: ctx.model,
        prompt: buildTensionBudgetPrompt({
          bookId: ctx.input.bookId,
          targetChapters: ctx.input.targetChapters,
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
    bookId: ctx.input.bookId,
  })) as ChapterTensionBudget[];
  const tensionBudgetValidation = validateTensionBudgets(
    chapterTensionBudgets,
    {
      targetChapters: ctx.input.targetChapters,
    }
  );
  if (!tensionBudgetValidation.valid) {
    throw new Error(
      `Invalid tension budgets: ${tensionBudgetValidation.issues.join('; ')}`
    );
  }

  const chapterOutlines = chapterOutlinesFromCards(chapterCards);
  ctx.input.onChapterOutlines?.(chapterOutlines);

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
    chapterThreadActions: normalizeChapterThreadActions(
      ctx.input.bookId,
      cardBundle.threadActions
    ),
    chapterCharacterPressures: normalizeChapterCharacterPressures(
      ctx.input.bookId,
      cardBundle.characterPressures
    ),
    chapterRelationshipActions: normalizeChapterRelationshipActions(
      ctx.input.bookId,
      cardBundle.relationshipActions
    ),
  };
}
