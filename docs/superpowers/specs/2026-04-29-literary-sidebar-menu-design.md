# Literary Sidebar Menu Design

Date: 2026-04-29
Status: Approved for spec review

## Summary

Refresh the entire left sidebar menu so it reads as a quiet literary workspace instead of a generic dark app rail. The design should carry a bookish, editorial tone while preserving the current navigation behavior and compact desktop shell.

## Scope

Included:

- The sidebar container visual treatment.
- The top brand/logo area.
- The `作品` and `设置` navigation rows.
- Sidebar color and texture refinements if needed.

Excluded:

- New navigation destinations.
- Changes to routing or selected-view state.
- Page-level layout changes outside the sidebar.
- New image assets.

## Design Direction

Use a restrained "bookplate / study" direction.

The sidebar should feel like:

- a bookplate or library label in the brand area
- a compact shelf/menu for moving between sections
- calm, paper-and-ink editorial UI
- polished enough to belong in the existing Story Weaver desktop app

It should not become:

- ornate traditional decoration
- a heavy antique UI
- a marketing-style hero strip
- visually louder than the content area

## Visual Treatment

### Sidebar Shell

Keep the existing warm dark sidebar foundation, but make it more tactile and literary.

- Use layered dark brown and ink tones rather than a flat block.
- Add subtle paper or cloth-like texture through gradients and thin inner lines.
- Keep the right edge crisp so the menu still behaves like a desktop navigation surface.

### Brand Area

Convert the current logo panel into a bookplate-like block.

- Use a lighter parchment surface inside the dark sidebar.
- Keep the logo centered and prominent, but reduce the current glow-heavy treatment.
- Add a thin border, small corner detail, or ruled line treatment to suggest a printed label.
- Include a compact text lockup such as `Story Weaver` and a short literary support line if it fits without crowding.

### Navigation Items

Make the navigation rows feel like refined bookmarks.

- Use stable row heights and compact spacing.
- Give inactive rows soft ink-on-dark contrast.
- Use a warm parchment active background.
- Add a narrow left accent line for the active row, like a book spine or bookmark edge.
- Keep icons from `lucide-react`, but place them in a small seal-like mark rather than a generic square button.

## Implementation Notes

Primary file:

- `renderer/components/app-sidebar.tsx`

Possible supporting file:

- `renderer/index.css`

The implementation should preserve the current `AppView` API and `isLibraryView` behavior. The visual change should be CSS/class-focused, with no new state and no new runtime dependency.

## Testing

At minimum:

- Run the focused renderer/app-shell tests if available.
- Verify the sidebar still exposes accessible buttons named `作品` and `设置`.
- If a dev server can run cleanly, inspect the sidebar visually in the browser.

## Acceptance Criteria

- The whole left menu has a coherent bookish/editorial visual language.
- The logo area reads more like a literary brand plate than a generic glowing card.
- Active and inactive navigation states remain obvious.
- Existing navigation behavior is unchanged.
- The design remains compact and does not make the content area feel squeezed.
