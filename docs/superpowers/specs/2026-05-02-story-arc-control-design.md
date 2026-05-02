# Story Arc Control Design

## Goal

Strengthen the backend generation loop so a story keeps an attractive title promise, a gripping but purposeful opening, a stable mainline, and endings that create forward pressure while still converging. The desired balance is: the first five chapters prioritize retention, then the long-form structure keeps the story from drifting or ending loosely.

This design targets generation logic only. It does not add frontend controls, database migrations, or new user-facing workflows in the first implementation pass.

## Current Context

The backend already has most of the right surfaces:

- `packages/backend/src/core/narrative/prompts.ts` builds prompts for narrative bible, volume plans, chapter cards, tension budgets, drafts, audits, and revisions.
- `packages/backend/src/core/narrative/opening-retention.ts` defines the first-five-chapter opening retention protocol.
- `packages/backend/src/core/narrative/types.ts` contains audit issue types and narrative structures.
- `packages/backend/src/core/narrative/audit.ts` turns audit output into accept, revise, or rewrite decisions.
- `packages/backend/src/core/story-router/registry.ts` supplies route-plan skills and red flags for chapter writing.
- Tests already cover narrative prompts, opening retention, story routing, and audit decisions.

The existing system treats book titles as reader promises and already tracks narrative threads, volume ending turns, chapter ending hooks, tension budgets, and viral story protocol. The new work should reuse those concepts instead of adding a parallel story-planning model.

## Design Principles

1. Title is a promise, not metadata.
   Planning and drafting must treat the title as a compact reader contract. The generated story should repeatedly pay off the title through genre signal, conflict, world rules, and chapter hooks.

2. Opening retention must also serve the mainline.
   The first five chapters should remain sharper than normal chapters, but each opening beat must move the main thread instead of only adding suspense.

3. Mainline movement must be visible.
   A chapter can plant, complicate, misdirect, or pay off information, but it should not merely decorate the setting. The reader should be able to state what changed in the main story.

4. Endings should converge as well as hook.
   Chapter endings may create forward pressure, but the pressure must come from a cost, reveal, choice, or consequence. Volume and full-story endings should complete stage payoffs and narrow the story toward the central dramatic question.

5. Enforcement should be prompt-first and audit-backed.
   The first implementation should strengthen prompt protocol and audit decisions without changing persistence schemas. This gives the model clearer instructions and adds corrective pressure when it drifts.

## Proposed Architecture

Add a shared story arc control protocol builder in `packages/backend/src/core/narrative/prompts.ts`, for example `buildStoryArcControlProtocolLines()`.

The protocol should produce concise lines covering:

- Title Promise Control: title must imply conflict, genre signal, and long-term question when generated; existing titles must be paid off throughout planning and drafting.
- Opening Control: chapters 1-5 must combine retention beats with title-promise payoff and mainline entry.
- Mainline Control: every chapter must produce a visible movement in the main thread or a justified complication that changes the main question.
- Ending Control: chapter endings must create earned forward pressure; volume endings must pay off the stage promise and upgrade the long-term question; full-story endings must resolve the central dramatic question and ending state.

Inject this protocol into:

- Narrative bible prompt, so central dramatic question, ending state, and main thread are planned with the title promise in mind.
- Volume plan prompt, so every volume has a mainline pressure, promised payoff, and ending turn that narrows or upgrades the long-term question.
- Chapter card prompt, so cards encode mainline movement and earned ending pressure through existing fields such as `plotFunction`, `informationReveal`, `readerReward`, `endingHook`, `mustChange`, and `forbiddenMoves`.
- Tension budget prompt, so forced choices, costs, irreversible changes, reader questions, and hook pressure stay tied to the mainline.
- Draft prompt, so each chapter body must execute the current card without drifting from the title promise or main thread.
- Audit prompt, so generated prose is checked for weak title promise, mainline drift, unearned hooks, and loose endings.
- Revision prompt, so fixes preserve the chapter direction while repairing promise, mainline, and ending failures.

## Opening Retention Update

Enhance `packages/backend/src/core/narrative/opening-retention.ts` without replacing the current phases.

The first five chapters should become:

- Chapter 1: abnormal entry. Establish abnormality, desire, conflict, danger, or an unanswered question while making the title promise visible.
- Chapter 2: rising cost. Make the opening problem more expensive and show that it belongs to the mainline.
- Chapter 3: irreversible entry. Force a protagonist choice that prevents return to safety and locks the story onto the main thread.
- Chapter 4: first clear reward. Give a concrete reward, truth, upgrade, ally, or partial victory, with a side effect that keeps the title promise alive.
- Chapter 5: long-term hostility. Convert short-term suspense into a durable hostile force, mystery, or pressure that can sustain the mainline.

The compressed short-book guidance should keep the same principle: even when fewer than five chapters exist, chapter 1 creates the promise and the final opening chapter creates irreversible mainline entry.

## Audit Enforcement

Extend `AuditIssueType` in `packages/backend/src/core/narrative/types.ts` with:

- `weak_title_promise`: the chapter does not make the title promise or reader contract visible.
- `mainline_drift`: the chapter spends its energy away from the central dramatic question or main thread without changing it.
- `loose_ending`: the chapter, volume, or final movement ends by summarizing, stopping, or opening vague suspense without earned convergence.
- `unearned_hook`: the ending hook is not caused by the chapter's choice, cost, reveal, or consequence.

Update `buildChapterAuditPrompt()` so the audit model explicitly scores and reports these problems. The audit should ask:

- Does this chapter pay or sharpen the title promise?
- Can the reader describe the mainline movement after the chapter?
- Is the ending pressure earned by this chapter's events?
- Does the ending both point forward and preserve convergence?

Update `decideAuditAction()` in `packages/backend/src/core/narrative/audit.ts`:

- Any `mainline_drift` blocker should trigger `rewrite`.
- Any major `mainline_drift`, `loose_ending`, or `unearned_hook` should trigger at least `revise`.
- In opening chapters 1-5, `weak_title_promise` or `mainline_drift` should trigger at least `revise`.
- Opening chapters 1-3 should remain stricter, preserving the existing high hook and flatness thresholds.

## Story Router Alignment

Update `packages/backend/src/core/story-router/registry.ts` so route-plan guidance matches the prompt protocol:

- `story-structure` should warn that mainline movement cannot stall or become background-only.
- `chapter-goal` should require the ending hook to be earned by `mustChange`, cost, reveal, or forced choice.
- `hook-technique` should reject empty suspense and require forward pressure from concrete consequences.
- `viral-promise` should say title promise and reader promise must enter scene action, not stay in setup.
- `red-flag-audit` should include mainline drift, loose endings, and unearned hooks.

This keeps the story route plan, draft prompt, and audit prompt speaking the same language.

## Validation Strategy

No persistence schema changes are planned. The protocol should use existing fields rather than requiring new stored fields in the first pass.

Validation will be through tests:

- Update `tests/core/narrative-prompts.test.ts` to assert that the story arc control protocol appears in bible, volume, chapter card, tension budget, draft, audit, and revision prompts.
- Update opening-retention tests or existing prompt tests to assert the first-five-chapter protocol mentions title promise and mainline entry.
- Add audit-decision coverage for `weak_title_promise`, `mainline_drift`, `loose_ending`, and `unearned_hook`.
- Update `tests/core/story-router.test.ts` to assert route plans include title promise, mainline movement, earned hooks, and ending convergence guidance.

Run targeted tests first:

```bash
pnpm exec vitest run tests/core/narrative-prompts.test.ts tests/core/story-router.test.ts tests/core/chapter-review.test.ts
```

Then run the full quality gate if targeted tests pass:

```bash
pnpm run typecheck
pnpm test
```

## Non-Goals

- Do not add frontend inputs for this pass.
- Do not add database migrations for new chapter-card fields.
- Do not rewrite the whole narrative bible or viral story protocol model.
- Do not force every chapter into a cliffhanger. Quiet chapters are allowed if they create real movement through character, relationship, information, cost, or thematic pressure.

## Risks

- Stronger prompt rules may make generated prompts longer. The implementation should keep protocol lines compact and avoid duplicating the same guidance excessively.
- Audit models may over-report new issue types at first. Decision rules should be firm for blockers and opening chapters, but avoid rewriting acceptable chapters for minor wording issues.
- Without schema changes, `mainlineMovement` and `endingConvergence` will live inside existing fields. This is intentional for the first pass, but a future migration could add explicit stored fields if the behavior proves useful.

## Success Criteria

- Planning prompts consistently frame the title as a reader promise.
- Opening guidance keeps the first five chapters gripping while tied to the mainline.
- Chapter cards and tension budgets require visible mainline movement and earned ending pressure.
- Draft and audit prompts check title promise, mainline drift, unearned hooks, and loose endings.
- Audit decisions revise or rewrite serious drift and ending failures.
- Targeted narrative and routing tests pass.
