# Story Weaver Story Library Redesign

Date: 2026-04-28
Status: Approved for planning

## Summary

Redesign Story Weaver from a generic utility-like interface into a desktop-first fiction library application. The new experience should feel intentionally designed for managing long-form works, with a strong sense of editorial order and literary archive character, while preserving professional efficiency.

The product should no longer read as:

- a mobile-style card feed
- a generic admin dashboard
- a command center with equal emphasis on every tool

The product should instead read as:

- a work library for books and writing projects
- a calm, professional desktop app
- a designed system where the visual language reflects books, archives, and editorial craft

## Goals

- Make the home screen feel like a curated story library, not a backend list.
- Use large desktop-oriented cards as the primary unit for browsing works.
- Give each book card enough presence to feel like a managed creative object.
- Separate the jobs of the home screen and detail screen.
- Improve hierarchy, rhythm, and visual identity without adding new product scope.

## Non-Goals

- No new feature systems beyond what already exists.
- No cover upload workflow.
- No complex new filtering logic beyond styling and layout for the existing controls.
- No major renderer/business logic refactor outside what is required to support the new UI structure.

## Design Direction

### Core Direction

The selected direction combines:

- the card size and spatial weight of the earlier `A` concept
- the style language and archive/bookcase character of the earlier `C` concept

This means:

- cards should be large, steady, and clearly desktop-scaled
- cards should evoke bookshelves, archival drawers, and literary records
- visual polish should come from proportion, materials, typography, and hierarchy rather than decorative effects

### Tone

The interface should feel:

- professional
- editorial
- calm
- literary
- structured

The interface should not feel:

- playful
- overly glossy
- commerce-like
- template-driven
- mobile-first

## Information Architecture

### Home Screen

The home screen is a library view for browsing many books.

Primary job:

- scan
- compare
- select

Secondary job:

- search, filter, and sort the collection

The home screen should not behave like a deep work page for a single book.

### Detail Screen

The detail screen is a dedicated work view for one selected book.

Primary job:

- continue work on a single title
- inspect progress, outline, chapters, and supporting data

The detail screen should feel like entering a book dossier or archive folder, not like staying inside the library grid.

## Home Screen Layout

### Shell

Use a desktop application shell with:

- a left sidebar for high-level navigation
- a top tool strip for search and collection controls
- a central content area for the book card grid

Avoid a large hero banner. The interface should start working immediately.

### Top Tool Strip

The header should be low-height and tool-oriented.

Left:

- product name
- current view label

Center:

- search input

Right:

- status filter
- sorting control
- new book action

The tool strip must support efficiency without becoming a control dashboard.

### Book Grid

The main library view should use a two-column or three-column card grid depending on viewport width.

Cards should be:

- noticeably larger than mobile cards
- consistent in outer dimensions
- aligned on a strong grid
- spaced with calm, even gutters

The grid should feel like a collection wall for works, not a stack of miscellaneous widgets.

## Book Card Design

### Overall Structure

Each card should feel like a book object plus a structured record.

Recommended structure:

1. Left visual anchor
2. Main textual identity block
3. Status and production metadata

### Left Visual Anchor

This is not a literal uploaded cover.

It should act like an abstracted spine/cover marker using:

- muted color fields
- subtle texture or pattern
- optional volume stripe or typographic accent

Purpose:

- make the card read as a book
- create fast visual differentiation between works
- establish the archive/bookcase tone

### Main Identity Block

This is the most important area of the card.

Include:

- title as the strongest type element
- genre/tone/setup line beneath it
- current writing-stage sentence beneath that

Example types of stage sentence:

- “Continuing chapter 88 revision”
- “Waiting to write the next chapter”
- “Paused during worldbuilding cleanup”

This section should communicate that the card represents a living work, not just a database row.

### Status and Metadata Block

Metadata should be organized into a restrained information band or corner cluster.

Include:

- writing status
- progress
- total words
- chapter count if available
- last updated timing

Use color sparingly. Status should receive the strongest accent. Other metadata should remain calm and legible.

## Visual System

### Typography

Typography should do a large share of the design work.

Requirements:

- title typography with more character than a default app stack
- strong size contrast between title, support text, and metadata
- compact but breathable desktop rhythm

Avoid a generic “everything looks the same weight” treatment.

### Color

Use a restrained palette rooted in paper, cloth, ink, and archival cues.

Suggested direction:

- warm neutrals for surfaces
- muted greens, brass, slate, or blue-gray accents
- slightly material-feeling card anchors for each book

Avoid loud saturation and avoid relying on bright color to fake hierarchy.

### Surfaces

Cards should feel intentional and tactile through:

- crisp borders
- subtle depth
- layered neutrals
- controlled radius

Do not rely on large floating shadows or glassmorphism.

### Motion

Use minimal, meaningful motion only:

- gentle hover emphasis
- crisp state transitions
- no bouncing, lifting, or playful transforms

## Detail Screen Layout

### Role

Once a book is selected, the UI should transition into a focused single-book page.

The detail page should feel like opening a structured dossier for that book.

### Structure

Use three conceptual layers:

1. Book header
2. Primary work area
3. Secondary support information

### Book Header

Include:

- title
- genre or positioning line
- current phase
- short phase summary
- primary actions

Primary actions:

- resume/start writing
- write next chapter
- continuous writing
- export

Destructive actions should be visually separated from primary actions.

### Primary Work Area

The default emphasis should be chapter progress and writing flow.

Recommended default:

- chapters as the main tab/section
- content preview and summaries tied to chapter context

Other areas such as outline, characters, and threads remain accessible but should not compete equally on first load.

### Secondary Support Information

Supporting data such as:

- latest scene
- character states
- plot threads
- contextual notes

should be presented as structured support panels, likely in a right-side or lower supporting region depending on layout.

These are important, but they should support the main writing view rather than flattening the whole page into equal cards.

## Interaction Principles

### Home Screen

The home screen should optimize for:

- quick scanning
- quick comparison
- quick entry into a title

Interaction guidance:

- hover states should be subtle
- selected/focused states should rely on border, tint, and emphasis rather than large movement
- search and filters should be always available but visually quiet

### Detail Screen

The detail screen should optimize for:

- focus
- continuity
- safe action hierarchy

Interaction guidance:

- primary writing actions stay prominent
- secondary navigation stays clear but not noisy
- destructive actions remain available but visually demoted and separated

## Responsive Behavior

Primary target is desktop.

Desktop expectations:

- wide card layout on the home screen
- stable multi-column library grid
- spacious detail layout with clear hierarchy

Smaller widths should degrade gracefully, but the design should not be driven by mobile patterns.

## Implementation Scope

### In Scope

- renderer shell restyling
- home screen library redesign
- book card redesign
- header/tool strip redesign
- detail page hierarchy redesign
- global visual tokens for color, border, radius, spacing, and typography

### Likely Files

- `renderer/index.css`
- `renderer/App.tsx`
- `renderer/pages/Library.tsx`
- `renderer/pages/BookDetail.tsx`
- `renderer/components/BookCard.tsx`
- `renderer/components/app-sidebar.tsx`
- supporting UI components as needed

### Out of Scope

- backend changes not required for UI support
- new persistence models
- advanced filtering feature work
- new content authoring workflows

## Success Criteria

The redesign succeeds if:

1. The first impression is “story library” rather than “admin app”.
2. The home screen clearly centers books as designed objects.
3. The card system feels desktop-scaled and intentionally composed.
4. The detail screen feels like a focused single-book workspace.
5. The interface has design character without sacrificing clarity or efficiency.
