import { describe, expect, it } from 'vitest';
import type { StoryWeaverApi } from '@story-weaver/frontend/hooks/useStoryWeaverApi';

function acceptsApi(api: StoryWeaverApi) {
  void api.listBooks().then((books) => books.at(0)?.id);
  void api.getBookDetail('book-1').then((detail) => detail?.book.id);
  void api.exportBook('book-1', 'txt').then((message) => message.length);
  void api.startScheduler();
  void api.setSetting('scheduler.concurrencyLimit', '2');
}

describe('StoryWeaverApi type surface', () => {
  it('exposes concrete methods instead of generic invoke', () => {
    expect(typeof acceptsApi).toBe('function');
  });
});
