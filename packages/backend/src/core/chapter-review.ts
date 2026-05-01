import { countStoryCharacters } from './story-constraints.js';
export {
  parseBooleanSetting,
  serializeBooleanSetting,
  SHORT_CHAPTER_REVIEW_ENABLED_KEY,
} from '@story-weaver/shared/settings';

export function shouldRewriteShortChapter(input: {
  enabled: boolean;
  content: string;
  wordsPerChapter: number;
}) {
  if (!input.enabled) {
    return false;
  }

  return countStoryCharacters(input.content) < input.wordsPerChapter;
}
