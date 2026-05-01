import type { BookExportFormat } from '@story-weaver/shared/contracts';
import { exportBookToFile } from '../storage/export.js';

export function createBookExportService(deps: {
  bookService: {
    getBookDetail: (bookId: string) => {
      book: { title: string };
      chapters: Array<{
        chapterIndex: number;
        title: string | null;
        content: string | null;
      }>;
    } | null;
  };
  exportDir: string;
}) {
  async function exportBook(bookId: string, format: BookExportFormat) {
    const detail = deps.bookService.getBookDetail(bookId);

    if (!detail) {
      throw new Error(`Book not found: ${bookId}`);
    }

    const result = await exportBookToFile({
      exportDir: deps.exportDir,
      format,
      title: detail.book.title,
      chapters: detail.chapters.map((chapter) => ({
        chapterIndex: chapter.chapterIndex,
        title: chapter.title,
        content: chapter.content,
      })),
    });

    return result.filePath;
  }

  return { exportBook };
}
