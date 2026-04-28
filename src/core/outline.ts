import {
  buildTitlePrompt,
  buildChapterOutlinePrompt,
  buildMasterOutlinePrompt,
  buildVolumeOutlinePrompt,
  buildWorldPrompt,
} from './prompt-builder';
import type {
  ChapterOutline,
  OutlineBundle,
  OutlineGenerationInput,
} from './types';

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

      const chapterOutlines = (
        await Promise.all(
          volumeOutlines.map(async (volumeOutline, index) => {
            const chapterText = (await generateText({
              prompt: buildChapterOutlinePrompt(volumeOutline, index + 1, input),
            })).text;

            const chapterOutlines = parseChapterOutlineLines(chapterText, index + 1);
            input.onChapterOutlines?.(chapterOutlines);

            return chapterOutlines;
          })
        )
      ).flat();

      return {
        worldSetting,
        masterOutline,
        volumeOutlines,
        chapterOutlines,
      };
    },
  };
}
