# Book Detail Live Progress Design

## Goal

The book detail page should make long-running generation observable. A user should be able to open a book and immediately understand the full chapter plan, which generation step is active, which chapter is currently being written, and what text is streaming from the model.

## User Experience

The detail page keeps the existing tab structure, with the chapters tab becoming the primary monitoring surface.

- The chapter list displays every planned chapter, including chapters that only have outlines.
- Each chapter row shows its volume/chapter number, title, word count, and status.
- The active chapter is visually emphasized and can be selected to inspect its saved content, outline, or live draft.
- A compact progress panel shows the current phase and step label, such as generating title, building world, planning chapters, writing chapter 3, summarizing chapter 3, updating continuity, paused, or completed.
- A live output panel appears when text is streaming. It shows the current chapter title and incrementally appended text. When the chapter finishes, the saved chapter content becomes the source of truth.

Completed chapters remain readable after generation. In-progress text is clearly separated from saved content so the user can distinguish temporary streaming output from persisted chapter text.

## Data Model And Contracts

Extend the renderer-facing detail data with optional progress metadata:

- `currentVolume`: current volume number when known.
- `currentChapter`: current chapter number when known.
- `stepLabel`: human-readable generation step.
- `streamingChapter`: current streaming chapter coordinates, title, and accumulated text.

Add a renderer subscription for book generation events. The event payload should include:

- `bookId`
- `type`: `progress`, `chapter-stream`, `chapter-complete`, or `error`
- chapter coordinates when relevant
- `phase` and `stepLabel` when relevant
- `delta` for stream chunks
- `content` for a full stream snapshot when needed

Scheduler status remains responsible for library-level running, queued, and paused states. Book generation events are responsible for detail-page observability.

## Backend Flow

`bookService` updates progress at finer checkpoints:

- title generation starts and completes
- world setting starts and completes
- master outline starts and completes
- chapter outlines start and complete
- chapter drafting starts
- chapter text chunks arrive
- chapter draft completes
- post-chapter summary and continuity extraction starts and completes
- book completes, pauses, or errors

For real model runs, the chapter writer should support streaming text and call an optional `onChunk` callback. For mock runs, it should emit deterministic chunks from the generated mock chapter so tests and local demos still show live output.

Persisted chapter content is saved only after the draft and post-chapter updates finish successfully. The live stream is kept in memory in the renderer.

## Frontend Components

Update `BookDetail` around three small units:

- `ChapterList`: renders the complete chapter list, accepts the active chapter id, and exposes chapter selection.
- `GenerationProgressPanel`: renders phase, step, current chapter, and counts.
- `LiveOutputPanel`: renders streaming content with preserved line breaks and an empty state when no stream is active.

`BookDetail` owns selected chapter state. If a stream starts for a chapter, that chapter becomes selected unless the user has manually selected another chapter during the same session. The selected chapter display prefers live streaming text for the active streaming chapter, otherwise saved content, otherwise the chapter outline.

## Error Handling

If streaming fails, the progress panel shows the error state and the live output panel preserves the last received chunks for inspection. A completed chapter event replaces temporary stream content with saved chapter content after the next detail refresh.

If the renderer receives stream events for a non-selected book, it ignores them. If a detail refresh arrives without streaming metadata, existing live text is preserved until a complete, error, pause, or book switch event clears it.

## Testing

Add renderer tests for:

- rendering all planned chapters, including outline-only queued chapters
- highlighting the current chapter
- selecting a chapter and showing saved content or outline
- showing progress step labels
- appending streaming chunks in the live output panel

Add core/runtime tests for:

- chapter writer chunk callbacks
- book service emitting progress and stream events in order
- mock runtime producing deterministic stream chunks

Existing scheduler and detail refresh tests should continue to pass.
