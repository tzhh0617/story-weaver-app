# Library Stats Real Data Design

Date: 2026-05-03
Status: Approved

## Summary

Make the four summary metrics on the library home screen reflect live business data instead of mixed live-and-placeholder values.

## Scope

- Keep the existing four metric cards and layout unchanged.
- Keep `写作中` sourced from `SchedulerStatus.runningBookIds`.
- Keep `排队` sourced from `SchedulerStatus.queuedBookIds`.
- Keep `已暂停` sourced from `SchedulerStatus.pausedBookIds`.
- Change `完成` to display the real number of books whose status is `completed`.
- Remove the hardcoded `/50` suffix because it is not a real business cap.

## Non-Goals

- No metric redesign.
- No additional metric cards.
- No backend contract changes.
- No scheduler behavior changes.

## Data Contract

`Library` already receives:

- `books`, where each item includes the persisted business status.
- `scheduler`, where running, queued, and paused IDs come from the live runtime scheduler.

This is sufficient for the required metrics, so the change should stay renderer-only.

## Testing

- Add a renderer test that asserts the library metrics show:
  - `完成` as a plain real count
  - `写作中` as the running count
  - `排队` as the queued count
  - `已暂停` as the paused count
- Explicitly assert that the old placeholder value such as `1/50` is not rendered.
