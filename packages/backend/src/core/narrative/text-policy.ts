export function buildAiFirstTextPolicyLines() {
  return [
    'AI-first text policy:',
    'The model is responsible for producing text that already satisfies the requested style and format.',
    'Local code will only perform structural guards such as trimming, JSON parsing, and storage-safe fallback handling.',
    'Use Chinese web novel prose: short readable paragraphs, visible conflict, action and dialogue over exposition, and a forward-driving ending hook.',
    'Do not rely on downstream regex cleanup to fix prose style, narrative logic, title format, or Markdown artifacts.',
  ];
}

export function buildPlainChineseOutputPolicyLines() {
  return [
    ...buildAiFirstTextPolicyLines(),
    'Return plain Chinese text only unless a JSON contract is explicitly requested.',
    'Do not use Markdown headings, bullets, bold markers, or code fences.',
  ];
}

export function buildJsonOutputPolicyLines() {
  return [
    'AI-first text policy:',
    'The model is responsible for producing JSON that already satisfies the requested schema and narrative semantics.',
    'Local code will only perform structural guards such as trimming, JSON parsing, and storage-safe fallback handling.',
    'Return valid JSON only. Do not wrap JSON in markdown fences.',
  ];
}
