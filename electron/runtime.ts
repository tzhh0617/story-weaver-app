import os from 'node:os';
import path from 'node:path';
import {
  createRuntimeServices,
  type RuntimeServices,
} from '../src/runtime/create-runtime-services.js';

let runtimeServices: RuntimeServices | null = null;

export function getRuntimeServices() {
  if (runtimeServices) {
    return runtimeServices;
  }

  runtimeServices = createRuntimeServices({
    rootDir: path.join(os.homedir(), '.story-weaver'),
  });

  return runtimeServices;
}
