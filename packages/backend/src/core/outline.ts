import {
  buildTitlePrompt,
  buildChapterOutlinePrompt,
  buildMasterOutlinePrompt,
  buildVolumeOutlinePrompt,
  buildWorldPrompt,
} from './prompt-builder.js';
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

type GenerateText = (input: { prompt: string }) => Promise<{ text: string }>;

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

export function createOutlineService({ generateText }: { generateText: GenerateText }) {
  return {
    async generateTitleFromIdea(input: OutlineGenerationInput): Promise<string> {
      return normalizeGeneratedTitle(
        (
          await generateText({
            prompt: buildTitlePrompt(input),
          })
        ).text
      );
    },

    async generateFromIdea(
      input: OutlineGenerationInput
    ): Promise<OutlineBundle> {
      const worldSetting = (await generateText({
        prompt: buildWorldPrompt(input),
      })).text;
      input.onWorldSetting?.(worldSetting);

      const masterOutline = (await generateText({
        prompt: buildMasterOutlinePrompt(worldSetting, input),
      })).text;
      input.onMasterOutline?.(masterOutline);

      const volumeOutlineText = (await generateText({
        prompt: buildVolumeOutlinePrompt(masterOutline, input),
      })).text;

      const volumeOutlines = volumeOutlineText
        .split('\n---\n')
        .map((outline) => outline.trim())
        .filter(Boolean);

      const chapterOutlines: ChapterOutline[] = [];

      for (const [index, volumeOutline] of volumeOutlines.entries()) {
        if (chapterOutlines.length >= input.targetChapters) {
          break;
        }

        const chapterText = (await generateText({
          prompt: buildChapterOutlinePrompt(volumeOutline, index + 1, input),
        })).text;

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
