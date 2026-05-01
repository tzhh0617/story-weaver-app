import { useEffect, useState } from 'react';
import type React from 'react';
import {
  type BookGenerationEvent,
} from '@story-weaver/shared/contracts';
import type { BookDetailData } from '../types/book-detail';
import type { StoryWeaverApi } from './useStoryWeaverApi';

export function useBookGenerationEvents(input: {
  api: StoryWeaverApi;
  selectedBookId: string | null;
  selectedBookIdRef: React.MutableRefObject<string | null>;
  setSelectedBookDetail: React.Dispatch<React.SetStateAction<BookDetailData | null>>;
  loadBookDetail: (
    bookId: string,
    options?: { openView?: boolean; preserveExistingOnMissing?: boolean }
  ) => Promise<boolean>;
}) {
  const {
    api,
    selectedBookId,
    selectedBookIdRef,
    setSelectedBookDetail,
    loadBookDetail,
  } = input;
  const [liveOutput, setLiveOutput] = useState<{
    bookId: string;
    volumeIndex: number;
    chapterIndex: number;
    title: string;
    content: string;
  } | null>(null);

  useEffect(() => {
    setLiveOutput(null);
  }, [selectedBookId]);

  useEffect(() => {
    const unsubscribe = api.onBookGeneration((payload) => {
      const event = payload as BookGenerationEvent;

      setSelectedBookDetail((currentDetail) => {
        if (!currentDetail || event.bookId !== currentDetail.book.id) {
          return currentDetail;
        }

        if (event.type === 'progress' || event.type === 'error') {
          return {
            ...currentDetail,
            progress: {
              ...(currentDetail.progress ?? {}),
              phase: event.phase,
              stepLabel: event.stepLabel,
              currentVolume: event.currentVolume ?? null,
              currentChapter: event.currentChapter ?? null,
            },
          };
        }

        return currentDetail;
      });

      if (event.type === 'chapter-stream') {
        setLiveOutput((currentOutput) => {
          if (selectedBookIdRef.current !== event.bookId) {
            return currentOutput;
          }

          if (
            currentOutput &&
            currentOutput.bookId === event.bookId &&
            currentOutput.volumeIndex === event.volumeIndex &&
            currentOutput.chapterIndex === event.chapterIndex
          ) {
            return {
              ...currentOutput,
              content: event.replace
                ? event.delta
                : `${currentOutput.content}${event.delta}`,
            };
          }

          return {
            bookId: event.bookId,
            volumeIndex: event.volumeIndex,
            chapterIndex: event.chapterIndex,
            title: event.title,
            content: event.delta,
          };
        });
      }

      if (event.type === 'chapter-complete' || event.type === 'error') {
        if (selectedBookIdRef.current === event.bookId) {
          if (event.type === 'chapter-complete') {
            setLiveOutput(null);
          }
          void loadBookDetail(event.bookId, {
            openView: false,
            preserveExistingOnMissing: true,
          });
        }
      }
    });

    return unsubscribe;
  }, [api, loadBookDetail, selectedBookId, selectedBookIdRef, setSelectedBookDetail]);

  return liveOutput;
}
