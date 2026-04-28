import {
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
    async generateFromIdea(
      input: OutlineGenerationInput & { modelId: string }
    ): Promise<OutlineBundle> {
      const model = deps.registry.languageModel(input.modelId);

      const worldSetting = (
        await deps.generateText({
          model,
          prompt: buildWorldPrompt(input),
        })
      ).text;

      const masterOutline = (
        await deps.generateText({
          model,
          prompt: buildMasterOutlinePrompt(worldSetting, input),
        })
      ).text;

      const volumeOutlineText = (
        await deps.generateText({
          model,
          prompt: buildVolumeOutlinePrompt(masterOutline),
        })
      ).text;

      const volumeOutlines = volumeOutlineText
        .split('\n---\n')
        .map((outline) => outline.trim())
        .filter(Boolean);

      const chapterOutlines = (
        await Promise.all(
          volumeOutlines.map(async (volumeOutline, index) => {
            const chapterText = (
              await deps.generateText({
                model,
                prompt: buildChapterOutlinePrompt(volumeOutline, index + 1),
              })
            ).text;

            return parseChapterOutlineLines(chapterText, index + 1);
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
