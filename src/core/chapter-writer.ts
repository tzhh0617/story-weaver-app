type GenerateText = (input: { prompt: string }) => Promise<{
  text: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}>;

export function createChapterWriter({ generateText }: { generateText: GenerateText }) {
  return {
    async writeChapter(input: { prompt: string }) {
      const response = await generateText({ prompt: input.prompt });

      return {
        content: response.text,
        usage: {
          inputTokens: response.usage?.inputTokens ?? 0,
          outputTokens: response.usage?.outputTokens ?? 0,
        },
      };
    },
  };
}
