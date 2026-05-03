# Debug Log Hardening Design

## Goal

Upgrade the runtime execution log module so logs are emitted in realtime to the renderer and also written immediately to disk with enough structured context to support production-style debugging.

## Scope

- Preserve the current in-memory realtime execution log stream used by the renderer.
- Add realtime file persistence under `~/.story-weaver/logs`.
- Rotate log files when a single daily file grows too large.
- Retain only a bounded window of recent log files.
- Expand execution log levels to include `debug`.
- Extend the execution log record with optional structured debug context that remains safe to surface in the UI and to store on disk.
- Instrument runtime scheduler and AI service boundaries with richer debug records, durations, task metadata, runtime mode, and error stacks.
- Keep API keys, full prompts, and generated chapter bodies out of the persisted logs.

## Non-Goals

- Do not persist logs to SQLite.
- Do not store full prompt payloads or full generated content.
- Do not add a history query API for past app sessions.

## Data Model

Execution logs remain append-only runtime events and gain optional metadata:

- `debug_context`: structured key/value context safe for disk and UI use
- `duration_ms`: elapsed time for timed operations
- `run_id`: per-runtime identifier for correlating a single app session
- `sequence`: stable sequence for disk and realtime ordering

The on-disk format is newline-delimited JSON so logs can be tailed live and parsed later.
Files are grouped by UTC day and may rotate to suffixed files such as `2026-05-03.1.log`.

## Runtime Flow

`createExecutionLogStream` becomes the single log sink:

- emits the typed record to live subscribers
- appends the same record to a daily log file immediately
- rotates to the next daily segment when the current file exceeds the size budget
- prunes files older than the retention window before writing new records
- mirrors a concise line to stdout/stderr for local debugging

## Operational Defaults

- Default max file size per segment: 5 MB
- Default retention window: 14 days
- Rotation is append-only within the same UTC day: `.log`, `.1.log`, `.2.log`, ...

`electron/runtime.ts` emits higher-signal debug records around:

- scheduler command entry
- planning/writing task registration and start
- scheduler state snapshots
- generation event mapping
- error handling with stack capture

`electron/runtime-ai-services.ts` emits debug records around:

- runtime mode resolution
- mock vs real model routing
- chapter write start/end
- post-chapter extractor and auditor start/end
- model test start/end

Each AI boundary log includes a compact safe summary such as model id, input sizes, issue counts, or chapter identifiers, but never raw prompts or chapter content.

## UI Compatibility

The renderer continues to show the same live log feed. New optional fields are backward compatible. The UI recognizes the new `debug` level and lets users filter it.

## Testing

- Storage tests verify realtime emission still works and that logs are appended to disk immediately as NDJSON.
- Runtime tests verify richer debug events are emitted and that persisted logs include structured context.
- Renderer tests verify debug logs render and can be filtered without regressing existing behavior.
