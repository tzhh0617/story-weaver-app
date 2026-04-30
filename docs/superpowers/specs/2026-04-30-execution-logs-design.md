# Execution Logs Design

## Goal

Add a global Logs section that shows realtime background execution events from the current app run.

## Scope

- Add a sidebar menu item named `日志`.
- Add a renderer page that lists background execution records as they arrive.
- Stream background execution records from the main process to the renderer.
- Record scheduler and book-generation lifecycle events, including queued work, starts, progress, chapter completion, pause, restart, completion, and errors.
- Keep prompt text, generated chapter content, API keys, and other large or sensitive payloads out of the log records.
- Do not persist logs to SQLite or load logs from past app sessions.
- Support filtering the realtime event list by book.

## Data Model

Use an in-memory realtime event shape with these fields:

- `id`: runtime sequence number
- `book_id`: optional related book id
- `book_title`: optional title snapshot for readable history after later title changes
- `level`: `info`, `success`, or `error`
- `event_type`: stable machine-readable event type
- `phase`: optional current phase
- `message`: short human-readable summary
- `volume_index`: optional volume index
- `chapter_index`: optional chapter index
- `error_message`: optional error detail
- `created_at`: ISO timestamp

The runtime stream exposes `emit` and `subscribe`. It has no history query API.

## Runtime Flow

Runtime services receive an execution log stream. Scheduler entry points emit command-level events for start, start all, pause all, resume, restart, direct write-next, direct write-all, and delete-adjacent lifecycle work. Existing `BookGenerationEvent` emissions also emit realtime log records for progress, chapter completion, and errors.

Because logs are not persisted, deleting a book does not need log cleanup.

## Renderer Flow

Add `logs:event` to shared IPC contracts and expose it through the preload bridge as `onExecutionLog`. `App.tsx` subscribes once during the current renderer session and appends incoming events to in-memory state. The Logs page renders:

- Header with total count
- Book filter sourced from the current book list
- Level filter
- Event type filter
- Keyword search
- Scrollable realtime log list with newest events appended at the bottom
- Empty state when no realtime records exist
- Automatic scrolling to the newest event

## Testing

- Stream tests cover realtime emission to current subscribers and the absence of a history API.
- Contract tests cover the new IPC channel.
- Renderer shell tests cover the sidebar entry, realtime append, autoscroll, filtering, book filtering, search, and empty state.
- Runtime-level logging is covered by focused unit tests where practical; existing integration tests continue to exercise book-generation events.
