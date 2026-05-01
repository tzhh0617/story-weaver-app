export function stripCodeFences(text: string) {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return trimmed;

  return trimmed
    .replace(/^```[a-zA-Z]*\n?/, '')
    .replace(/\n?```$/, '')
    .trim();
}

export function parseJsonObject<T>(text: string): T {
  return JSON.parse(stripCodeFences(text)) as T;
}

export function buildJsonRepairPrompt(input: {
  originalPrompt: string;
  invalidText: string;
  parseError: string;
}) {
  return [
    'Repair the model output so it becomes valid JSON only.',
    `Parse error: ${input.parseError}`,
    'Original task:',
    input.originalPrompt,
    'Invalid output:',
    input.invalidText,
    'Return valid JSON only. Do not wrap JSON in markdown fences.',
  ].join('\n');
}
