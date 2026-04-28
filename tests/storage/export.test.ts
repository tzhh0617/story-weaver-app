import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  exportBookToFile,
  renderMarkdownExport,
  renderTextExport,
} from '../../src/storage/export';

describe('renderMarkdownExport', () => {
  it('renders the title followed by chapter headings and bodies', () => {
    const markdown = renderMarkdownExport({
      title: 'Book 1',
      chapters: [
        { title: 'Chapter 1', content: 'Body 1' },
        { title: 'Chapter 2', content: 'Body 2' },
      ],
    });

    expect(markdown).toContain('# Book 1');
    expect(markdown).toContain('## Chapter 1');
    expect(markdown).toContain('Body 2');
  });
});

describe('renderTextExport', () => {
  it('renders the title followed by plain chapter headings and bodies', () => {
    const text = renderTextExport({
      title: 'Book 1',
      chapters: [{ title: 'Chapter 1', content: 'Body 1' }],
    });

    expect(text).toContain('Book 1');
    expect(text).toContain('Chapter 1');
    expect(text).toContain('Body 1');
  });
});

describe('exportBookToFile', () => {
  it('writes a markdown file with only completed chapter content', async () => {
    const exportDir = mkdtempSync(path.join(tmpdir(), 'story-weaver-export-'));

    try {
      const result = await exportBookToFile({
        exportDir,
        format: 'md',
        title: 'Book 1',
        chapters: [
          { chapterIndex: 1, title: 'Outline Only', content: null },
          { chapterIndex: 2, title: 'Chapter 2', content: 'Body 2' },
        ],
      });

      const content = readFileSync(result.filePath, 'utf8');

      expect(result.filePath).toMatch(/\.md$/);
      expect(content).toContain('# Book 1');
      expect(content).toContain('## Chapter 2');
      expect(content).toContain('Body 2');
      expect(content).not.toContain('Outline Only');
    } finally {
      rmSync(exportDir, { recursive: true, force: true });
    }
  });

  it('writes a txt file with completed chapter headings and bodies', async () => {
    const exportDir = mkdtempSync(path.join(tmpdir(), 'story-weaver-export-'));

    try {
      const result = await exportBookToFile({
        exportDir,
        format: 'txt',
        title: 'Book 1',
        chapters: [{ chapterIndex: 3, title: null, content: 'Body 3' }],
      });

      const content = readFileSync(result.filePath, 'utf8');

      expect(result.filePath).toMatch(/\.txt$/);
      expect(content).toContain('Book 1');
      expect(content).toContain('Chapter 3');
      expect(content).toContain('Body 3');
    } finally {
      rmSync(exportDir, { recursive: true, force: true });
    }
  });
});
