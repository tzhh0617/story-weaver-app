export const SHORT_CHAPTER_REVIEW_ENABLED_KEY =
  'generation.shortChapterReview.enabled';

export function parseBooleanSetting(value: string | null) {
  return value === null ? true : value === 'true';
}

export function serializeBooleanSetting(value: boolean) {
  return value ? 'true' : 'false';
}
