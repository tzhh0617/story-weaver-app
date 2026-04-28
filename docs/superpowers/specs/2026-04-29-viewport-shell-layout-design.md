# Viewport Shell Layout Design

Date: 2026-04-29
Status: Approved for implementation

## Summary

Unify the application shell so Story Weaver behaves like a desktop app: the left sidebar occupies the full viewport height and stays visually fixed, while the right workspace owns its own vertical scrolling.

## Scope

Included:

- Root shell sizing and overflow behavior.
- Left sidebar full-height behavior.
- Right workspace internal scroll behavior.
- Layout tests that protect the shell contract.

Excluded:

- Page-specific redesigns.
- Navigation changes.
- Sidebar visual style changes beyond height/scroll constraints.
- Business logic changes.

## Design

The shell should use a single viewport-height layout:

- `SidebarProvider` is the root shell and should be constrained to the viewport with hidden outer overflow.
- `AppSidebar` should fill the viewport height and should not shrink when the workspace becomes wide or long.
- The right side should use the remaining width, hide outer overflow, and place vertical scrolling inside the workspace content container.
- Existing page padding and paper background should remain visually unchanged.

This means the browser/body should not be the primary scroll surface. Long pages such as settings, book detail, or library lists should scroll inside the right workspace.

## Testing

Update the renderer layout constraint tests to assert:

- the app shell uses `h-svh` and `overflow-hidden`
- the main workspace uses `overflow-y-auto`
- the old `min-h-screen` page scroll pattern is absent from `App.tsx`
- the paper background is still applied to both root shell and right workspace

## Acceptance Criteria

- The left sidebar fills the viewport height.
- The left sidebar does not scroll with right-side content.
- The right workspace scrolls internally when content exceeds the viewport.
- Existing navigation and page rendering continue to work.
- The current visual spacing and paper texture remain intact.
