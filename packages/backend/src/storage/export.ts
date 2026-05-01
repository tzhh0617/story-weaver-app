import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { BookExportFormat } from '@story-weaver/shared/contracts';

type ExportChapter = {
  title: string;
  content: string;
};

type ExportSourceChapter = {
  chapterIndex: number;
  title: string | null;
  content: string | null;
};

export function renderTextExport(input: {
  title: string;
  chapters: ExportChapter[];
}) {
  return [
    input.title,
    '',
    ...input.chapters.flatMap((chapter) => [chapter.title, chapter.content, '']),
  ].join('\n');
}

export function renderMarkdownExport(input: {
  title: string;
  chapters: ExportChapter[];
}) {
  return [
    `# ${input.title}`,
    '',
    ...input.chapters.flatMap((chapter) => [
      `## ${chapter.title}`,
      '',
      chapter.content,
      '',
    ]),
  ].join('\n');
}

function sanitizeFileSegment(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return 'untitled-story';
  }

  return trimmed.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-');
}

function buildExportChapters(chapters: ExportSourceChapter[]): ExportChapter[] {
  return chapters
    .filter(
      (chapter): chapter is ExportSourceChapter & { content: string } =>
        typeof chapter.content === 'string' && chapter.content.trim().length > 0
    )
    .map((chapter) => ({
      title: chapter.title?.trim() || `Chapter ${chapter.chapterIndex}`,
      content: chapter.content.trim(),
    }));
}

export async function exportBookToFile(input: {
  exportDir: string;
  format: BookExportFormat;
  title: string;
  chapters: ExportSourceChapter[];
  writtenAt?: Date;
}) {
  const chapters = buildExportChapters(input.chapters);
  const content =
    input.format === 'txt'
      ? renderTextExport({ title: input.title, chapters })
      : renderMarkdownExport({ title: input.title, chapters });
  const timestamp = (input.writtenAt ?? new Date())
    .toISOString()
    .replace(/[:.]/g, '-');
  const fileName = `${sanitizeFileSegment(input.title)}-${timestamp}.${input.format}`;
  const filePath = path.join(input.exportDir, fileName);

  await writeFile(filePath, content, 'utf8');

  return { filePath };
}
