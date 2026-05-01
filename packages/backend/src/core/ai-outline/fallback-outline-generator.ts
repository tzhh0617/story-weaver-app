import {
  buildChapterOutlinePrompt,
  buildMasterOutlinePrompt,
  buildVolumeOutlinePrompt,
  buildWorldPrompt,
} from '../prompt-builder.js';
import type {
  ChapterOutline,
  OutlineBundle,
  OutlineGenerationInput,
} from '../types.js';
import {
  normalizeChapterOutlinesToTarget,
  renumberChapterOutlinesFrom,
  takeChapterOutlinesWithinTarget,
} from '../story-constraints.js';
import {
  normalizePlainContextText,
  parseChapterOutlineLines,
} from './rendering.js';

type GeneratorContext = {
  generateText: (input: {
    model: unknown;
    prompt: string;
  }) => Promise<{ text: string }>;
  model: unknown;
  input: OutlineGenerationInput & { modelId: string };
};

export async function generateFallbackBundle(
  ctx: GeneratorContext
): Promise<OutlineBundle> {
  const worldSetting = normalizePlainContextText(
    (
      await ctx.generateText({
        model: ctx.model,
        prompt: buildWorldPrompt(ctx.input),
      })
    ).text
  );
  ctx.input.onWorldSetting?.(worldSetting);

  const masterOutline = (
    await ctx.generateText({
      model: ctx.model,
      prompt: buildMasterOutlinePrompt(worldSetting, ctx.input),
    })
  ).text;
  ctx.input.onMasterOutline?.(masterOutline);

  const volumeOutlineText = (
    await ctx.generateText({
      model: ctx.model,
      prompt: buildVolumeOutlinePrompt(masterOutline, ctx.input),
    })
  ).text;

  const volumeOutlines = volumeOutlineText
    .split('\n---\n')
    .map((outline) => outline.trim())
    .filter(Boolean);

  const chapterOutlines: ChapterOutline[] = [];

  for (const [index, volumeOutline] of volumeOutlines.entries()) {
    if (chapterOutlines.length >= ctx.input.targetChapters) {
      break;
    }

    const chapterText = (
      await ctx.generateText({
        model: ctx.model,
        prompt: buildChapterOutlinePrompt(volumeOutline, index + 1, ctx.input),
      })
    ).text;

    const nextChapterOutlines = renumberChapterOutlinesFrom(
      takeChapterOutlinesWithinTarget({
        chapterOutlines: parseChapterOutlineLines(chapterText, index + 1),
        emittedCount: chapterOutlines.length,
        targetChapters: ctx.input.targetChapters,
      }),
      chapterOutlines.length + 1
    );

    if (nextChapterOutlines.length > 0) {
      chapterOutlines.push(...nextChapterOutlines);
      ctx.input.onChapterOutlines?.(nextChapterOutlines);
    }
  }

  const normalizedChapterOutlines = normalizeChapterOutlinesToTarget(
    chapterOutlines,
    ctx.input.targetChapters
  );
  const missingChapterOutlines = normalizedChapterOutlines.slice(
    chapterOutlines.length
  );
  if (missingChapterOutlines.length > 0) {
    ctx.input.onChapterOutlines?.(missingChapterOutlines);
  }

  return {
    worldSetting,
    masterOutline,
    volumeOutlines,
    chapterOutlines: normalizedChapterOutlines,
  };
}
