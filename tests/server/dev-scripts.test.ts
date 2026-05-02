import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(__dirname, '../..');

describe('development scripts', () => {
  it('does not let cleanup-dev kill the dev command shell itself', () => {
    const cleanupScript = fs.readFileSync(
      path.join(rootDir, 'scripts/cleanup-dev.sh'),
      'utf8'
    );

    expect(cleanupScript).not.toContain('pkill -9 -f "concurrently.*dev"');
    expect(cleanupScript).toContain('protected_pids');
    expect(cleanupScript).toContain('protected_pgids');
    expect(cleanupScript).toContain('kill_process_group');
    expect(cleanupScript).toContain('kill_matching_processes "node .*/pnpm dev$"');
    expect(cleanupScript).toContain(
      'kill_matching_processes "node .*/pnpm run dev$"'
    );
    expect(cleanupScript).toContain(
      'kill_matching_processes "sh -c bash scripts/cleanup-dev\\\\.sh && concurrently"'
    );
    expect(cleanupScript).toContain('concurrently/dist/bin/concurrently');
  });
});
