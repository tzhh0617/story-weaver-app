import { ipcMain } from 'electron';
import { getRuntimeServices } from '../runtime.js';
import {
  assertIpcPayload,
  ipcChannels,
  type BookExportFormat,
} from '../../src/shared/contracts.js';

export function registerBookHandlers() {
  const {
    bookService,
    startBook,
    pauseBook,
    writeNextChapter,
    writeRemainingChapters,
    resumeBook,
    restartBook,
    deleteBook,
    exportBook,
  } = getRuntimeServices();

  ipcMain.handle(
    ipcChannels.bookCreate,
    async (
      _event,
      payload
    ) => {
      assertIpcPayload(ipcChannels.bookCreate, payload);
      return bookService.createBook(payload);
    }
  );
  ipcMain.handle(
    ipcChannels.bookDelete,
    async (_event, payload) => {
      assertIpcPayload(ipcChannels.bookDelete, payload);
      return deleteBook(payload.bookId);
    }
  );
  ipcMain.handle(ipcChannels.bookList, async () => bookService.listBooks());
  ipcMain.handle(
    ipcChannels.bookDetail,
    async (_event, payload) => {
      assertIpcPayload(ipcChannels.bookDetail, payload);
      return bookService.getBookDetail(payload.bookId);
    }
  );
  ipcMain.handle(
    ipcChannels.bookStart,
    async (_event, payload) => {
      assertIpcPayload(ipcChannels.bookStart, payload);
      return startBook(payload.bookId);
    }
  );
  ipcMain.handle(
    ipcChannels.bookPause,
    async (_event, payload) => {
      assertIpcPayload(ipcChannels.bookPause, payload);
      return pauseBook(payload.bookId);
    }
  );
  ipcMain.handle(
    ipcChannels.bookWriteNext,
    async (_event, payload) => {
      assertIpcPayload(ipcChannels.bookWriteNext, payload);
      return writeNextChapter(payload.bookId);
    }
  );
  ipcMain.handle(
    ipcChannels.bookWriteAll,
    async (_event, payload) => {
      assertIpcPayload(ipcChannels.bookWriteAll, payload);
      return writeRemainingChapters(payload.bookId);
    }
  );
  ipcMain.handle(
    ipcChannels.bookResume,
    async (_event, payload) => {
      assertIpcPayload(ipcChannels.bookResume, payload);
      return resumeBook(payload.bookId);
    }
  );
  ipcMain.handle(
    ipcChannels.bookRestart,
    async (_event, payload) => {
      assertIpcPayload(ipcChannels.bookRestart, payload);
      return restartBook(payload.bookId);
    }
  );
  ipcMain.handle(
    ipcChannels.bookExport,
    async (_event, payload) => {
      assertIpcPayload(ipcChannels.bookExport, payload);
      return exportBook(payload.bookId, payload.format as BookExportFormat);
    }
  );
}
