import { ipcMain } from 'electron';
import { getRuntimeServices } from '../runtime.js';
import {
  ipcChannels,
  type BookExportFormat,
} from '../../src/shared/contracts.js';

export function registerBookHandlers() {
  const {
    bookService,
    startBook,
    resumeBook,
    restartBook,
    deleteBook,
    exportBook,
  } = getRuntimeServices();

  ipcMain.handle(
    ipcChannels.bookCreate,
    async (
      _event,
      payload: { idea: string; targetChapters: number; wordsPerChapter: number }
    ) => bookService.createBook(payload)
  );
  ipcMain.handle(
    ipcChannels.bookDelete,
    async (_event, payload: { bookId: string }) => deleteBook(payload.bookId)
  );
  ipcMain.handle(ipcChannels.bookList, async () => bookService.listBooks());
  ipcMain.handle(
    ipcChannels.bookDetail,
    async (_event, payload: { bookId: string }) =>
      bookService.getBookDetail(payload.bookId)
  );
  ipcMain.handle(
    ipcChannels.bookStart,
    async (_event, payload: { bookId: string }) =>
      startBook(payload.bookId)
  );
  ipcMain.handle(
    ipcChannels.bookPause,
    async (_event, payload: { bookId: string }) =>
      bookService.pauseBook(payload.bookId)
  );
  ipcMain.handle(
    ipcChannels.bookWriteNext,
    async (_event, payload: { bookId: string }) =>
      bookService.writeNextChapter(payload.bookId)
  );
  ipcMain.handle(
    ipcChannels.bookWriteAll,
    async (_event, payload: { bookId: string }) =>
      bookService.writeRemainingChapters(payload.bookId)
  );
  ipcMain.handle(
    ipcChannels.bookResume,
    async (_event, payload: { bookId: string }) =>
      resumeBook(payload.bookId)
  );
  ipcMain.handle(
    ipcChannels.bookRestart,
    async (_event, payload: { bookId: string }) =>
      restartBook(payload.bookId)
  );
  ipcMain.handle(
    ipcChannels.bookExport,
    async (_event, payload: { bookId: string; format: BookExportFormat }) =>
      exportBook(payload.bookId, payload.format)
  );
}
