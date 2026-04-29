type GenerateText = (input: { prompt: string }) => Promise<{
  text: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}>;

type StreamText = (input: { prompt: string }) => AsyncIterable<string>;

export function createChapterWriter({
  generateText,
  streamText,
}: {
  generateText: GenerateText;
  streamText?: StreamText;
}) {
  return {
    async writeChapter(input: { prompt: string; onChunk?: (chunk: string) => void }) {
      if (input.onChunk && streamText) {
        let content = '';

        for await (const chunk of streamText({ prompt: input.prompt })) {
          content += chunk;
          input.onChunk(chunk);
        }

        return {
          content,
          usage: {
            inputTokens: 0,
            outputTokens: 0,
          },
        };
      }

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
