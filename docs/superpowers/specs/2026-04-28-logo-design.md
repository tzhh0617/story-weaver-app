# Story Weaver Logo Integration Design

## Goal

Use the provided full logo image as the Story Weaver software logo in two places:

1. Inside the desktop app UI as the primary brand mark.
2. In packaged app assets for the desktop application icon.

The provided artwork must remain visually complete. It may be scaled down, but it must not be cropped or have any of its visible content removed.

## Source Asset

- Input image: `/Users/admin/Downloads/fd81b553-a423-4d39-8089-346fdfeb0f12.png`
- The image includes the symbol, glow treatment, and the `StoryWeaver` wordmark.

## Scope

### In Scope

- Add the provided image into the repo as a brand asset.
- Show the full logo in the app shell branding areas.
- Use the same full image to produce packaged app icon files with safe transparent padding.
- Wire Electron and electron-builder to use the generated icon assets.

### Out of Scope

- Redrawing or simplifying the logo.
- Cropping the image to isolate only the symbol.
- Rebranding text, colors, or visual effects.
- Building a new adaptive icon system beyond the minimum packaging assets needed now.

## Chosen Approach

Use the full image everywhere, while preserving aspect ratio and adding transparent safe margins for packaged icon outputs.

This keeps the artwork intact, matches the user's instruction, and reduces the chance of platform scaling clipping glow or edge details.

## UI Integration

### Sidebar

- Replace the current text-only brand block with a compact logo presentation that renders the full image.
- Keep the existing product naming context available, but avoid duplicating large text if the image already carries the wordmark clearly.

### Main Hero

- Update the top welcome card to prominently display the same full logo.
- The image should use `object-contain` behavior so the entire composition remains visible.
- The hero card may continue to include supporting product copy beneath or beside the logo, but the logo becomes the visual anchor.

## Packaged App Icon Integration

- Generate square icon canvases from the provided image without cropping the source artwork.
- Center the original image on a transparent square background.
- Apply enough padding to preserve the full glow and wordmark when scaled by macOS or Windows.
- Export the generated assets into the repo for packaging use.

Expected outputs:

- PNG source icon for Electron window and packaging references.
- `.icns` for macOS packaging.
- `.ico` for Windows packaging if the current toolchain supports it cleanly.

If one platform-specific icon format cannot be generated with the current local toolchain, keep the padded PNG source in place and document the remaining gap before packaging.

## Electron Wiring

- Set the BrowserWindow icon where the platform benefits from it.
- Update `electron-builder.yml` to point to the generated icon assets for packaging.
- Keep app metadata such as `productName` unchanged.

## Risks And Constraints

- Small system icon sizes will make the `StoryWeaver` wordmark less legible, because the user requested the full uncropped image.
- The glow-heavy original may appear softer than a simplified icon at Dock or taskbar sizes.
- This is an accepted tradeoff because preserving the full artwork is a hard requirement.

## Validation

- Run renderer tests that cover the app shell if affected by the branding change.
- Run a production build to confirm asset paths resolve.
- Verify the packaged configuration references the generated icon files without missing-file errors.

## Implementation Notes

- Prefer a repo-local asset location under the renderer or a shared assets directory.
- Keep the implementation minimal and reversible: asset import, layout update, icon generation outputs, and Electron config changes only.
