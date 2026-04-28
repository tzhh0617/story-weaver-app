import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rendererRoot = path.resolve(__dirname, '../../renderer');
const arbitraryPixelMaxWidthPattern = /max-w-\[\d+px\]/;

function listRendererSourceFiles(directory: string): string[] {
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const resolvedPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return listRendererSourceFiles(resolvedPath);
    }

    if (!/\.(ts|tsx|css)$/.test(entry.name)) {
      return [];
    }

    return [resolvedPath];
  });
}

describe('renderer layout constraints', () => {
  it('does not cap renderer layouts with arbitrary pixel max widths', () => {
    const offenders = listRendererSourceFiles(rendererRoot).flatMap((filePath) => {
      const source = fs.readFileSync(filePath, 'utf8');

      return arbitraryPixelMaxWidthPattern.test(source)
        ? [path.relative(rendererRoot, filePath)]
        : [];
    });

    expect(offenders).toEqual([]);
  });
});
