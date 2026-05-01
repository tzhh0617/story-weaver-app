# Story Weaver Creative Console Theme Design

## Goal

Upgrade the current Story Weaver desktop UI into a unified "creative console" experience using Tailwind CSS and shadcn/ui, while preserving the current Electron, React, and IPC-driven product behavior.

## Product Direction

The interface should feel like a modern writing operations console:

- Calm, information-dense, and tool-like rather than promotional
- Optimized for long sessions with good text readability
- Visually structured through layered panels and strong spacing
- Consistent in empty states, disabled states, selected states, and action hierarchy

This redesign should unify both page-level layout and low-level component styling instead of applying isolated visual patches.

## Scope

### In Scope

- Introduce Tailwind CSS into the renderer stack
- Introduce shadcn/ui as the component foundation
- Define a reusable theme token system
- Replace current ad hoc CSS patterns for buttons, inputs, cards, badges, tabs, alerts, and supporting surfaces
- Redesign and restyle:
  - Dashboard
  - NewBook
  - Settings
  - BookDetail
- Normalize visual behavior for:
  - Empty states
  - Disabled states
  - Selection states
  - Primary vs secondary vs destructive actions

### Out of Scope

- No database changes
- No IPC contract changes
- No main-process business logic redesign
- No dark mode in this phase
- No large functional feature additions unrelated to UI unification

## Constraints

- Keep all current story-writing workflows functional
- Preserve existing renderer-level behavior unless a visual workflow improvement explicitly requires small UI-only interaction changes
- Do not reintroduce user-facing model selection in book creation
- Avoid partial migration patterns that leave multiple competing visual systems in place long term

## Design Principles

### 1. Theme-System First

Establish tokens and shared primitives before page migration so every page consumes the same visual language.

### 2. Control Panel, Not Marketing Site

Use layered cards, restrained color, and deliberate contrast rather than hero-heavy or ornamental landing-page patterns.

### 3. Long-Form Readability

Preserve comfortable reading rhythm for idea input, outlines, summaries, and chapter previews.

### 4. Explicit UI States

Users should always understand:

- what is selected
- what is disabled
- what is safe to click
- what is empty vs loading vs complete

### 5. Incremental Page Migration on Top of Stable Primitives

Migrate shared component patterns first, then page by page.

## Visual Theme

### Overall Tone

- Primary visual mood: modern writing console
- Surface style: layered panels with crisp borders and soft elevation
- Density: medium-dense, optimized for desktop productivity
- Typography: modern interface typography for controls, strong readability for long-form text blocks

### Color Direction

- Base surfaces: cool gray and slate
- Accent: cyan/blue for active and primary controls
- Secondary highlight: amber for progress or caution emphasis
- Success: green
- Destructive: red
- Avoid purple-led palettes

### Theme Token Categories

Define Tailwind-aware semantic tokens for:

- `background`
- `foreground`
- `muted`
- `card`
- `border`
- `primary`
- `secondary`
- `accent`
- `success`
- `warning`
- `destructive`
- `ring`
- `radius`
- `shadow`

These tokens should be the only source of truth for component coloring and state styling.

## Tailwind + shadcn/ui Plan

### Tailwind

Tailwind becomes the main styling language for renderer components.

Responsibilities:

- Layout primitives
- Spacing and sizing
- Responsive behavior
- Surface styling
- Typography scale
- State variants

### shadcn/ui

shadcn/ui becomes the base component layer for interactive UI.

Initial component targets:

- `Button`
- `Input`
- `Textarea`
- `Select`
- `Card`
- `Badge`
- `Tabs`
- `Alert`
- `Separator`
- `ScrollArea`
- `Tooltip`

If a current local component remains useful, it should either wrap a shadcn primitive or adopt the same token system and interaction language.

## Component Migration Strategy

### Replace or Rework First

- Current button styling
- Current form control styling
- Status badges
- Card-like panels
- Tab controls
- Banner/alert surfaces
- Progress display surfaces

### Keep but Restyle

- `BookCard`
- `ProgressBar`
- `ChapterList`
- `StatusBadge`

These may remain local components but should adopt Tailwind styling and semantic tokens, or wrap shadcn primitives where sensible.

## Page Design Plan

### Dashboard

Target: writing operations dashboard

Structure:

- Top summary band for overall shelf metrics
- Batch controls with clear enabled/disabled hierarchy
- Card grid for books
- Strong empty shelf state

Book cards should emphasize:

- title
- readable status
- chapter progress
- quick entry into details

### NewBook

Target: creation panel with strong IDEA emphasis

Structure:

- dominant idea input area
- supporting target word count input
- strong primary action area

The creation form should feel like task initialization, not generic admin CRUD.

### Settings

Target: model and system configuration console

Structure:

- model editor form
- saved model list with selected/editing feedback
- global settings card

Saved model list should support:

- selection feedback
- deletion
- clear return to new-model mode

### BookDetail

Target: single-book operations workspace

Structure:

- book header with state and primary actions
- clear tab navigation
- focused content area per tab
- explicit empty states for every section

The chapters tab should remain the highest-utility section.

## Interaction Rules

### Primary Actions

- strong contrast
- limited count
- reserved for key workflow steps

### Secondary Actions

- visually quieter than primary actions
- still clearly actionable

### Destructive Actions

- reserved for delete and dangerous operations
- never visually confused with primary actions

### Disabled States

- visibly disabled
- not merely lower emphasis
- should communicate why an action is unavailable when context already makes it obvious

### Empty States

Every empty section should say what is missing rather than appearing blank.

### Selected States

Apply consistent selected-state styling across:

- tabs
- saved model list entries
- any other future list-driven editing surfaces

## Responsive Behavior

Primary target is desktop Electron, but the renderer should still behave cleanly on smaller widths.

Rules:

- stack multi-column layouts on narrow widths
- preserve usable spacing
- avoid overflowing action bars
- keep primary controls reachable without layout breakage

## Migration Sequence

1. Install and configure Tailwind CSS
2. Install and configure shadcn/ui
3. Define semantic theme tokens
4. Build or restyle shared UI primitives
5. Migrate Settings
6. Migrate NewBook
7. Migrate Dashboard
8. Migrate BookDetail
9. Normalize empty/disabled/selected/error/success states
10. Remove obsolete renderer CSS patterns that overlap with the new system

## Acceptance Criteria

The redesign is successful when:

- all four main pages share a coherent visual system
- there is no visible split between old and new component styles
- batch actions, detail actions, and settings actions follow a clear interaction hierarchy
- tabs, saved model entries, empty states, and disabled states are all visually explicit
- long text remains readable in outlines, scene summaries, and chapter previews
- the UI feels like a writing console rather than a generic CRUD app

## Risks

### Mixed Styling Drift

If migration is done page-by-page without a primitive pass first, old CSS and new Tailwind classes can produce inconsistent UI.

Mitigation:

- establish shared primitives before page migration

### Over-Abstracted Theme Layer

Too many custom wrappers can slow down migration and obscure shadcn/ui benefits.

Mitigation:

- only wrap primitives when the local abstraction is already valuable

### Regressed Readability

A highly “productized” theme can accidentally reduce long-form reading comfort.

Mitigation:

- preserve strong typography spacing and contrast for content blocks

## Final Recommendation

Proceed with a theme-system-first migration using Tailwind CSS and shadcn/ui, with Settings as the first migrated page and BookDetail as the final page-level convergence point.
