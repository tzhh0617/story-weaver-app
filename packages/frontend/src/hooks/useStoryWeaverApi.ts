import { useMemo } from 'react';
import {
  createHttpStoryWeaverClient,
  type StoryWeaverApi,
} from '../lib/story-weaver-http-client';

export type { StoryWeaverApi };

export function useStoryWeaverApi(): StoryWeaverApi {
  return useMemo(() => createHttpStoryWeaverClient(), []);
}
