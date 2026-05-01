import { createMockOutlineService } from '../mock/story-services.js';

export function createDevelopmentOutlineService() {
  // Keep the legacy entrypoint stable while routing all fallback output
  // through the new Chinese mock story services.
  return createMockOutlineService();
}
