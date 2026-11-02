# Scenery and Finale Implementation Plan

> Execute inline with superpowers:executing-plans. Use one independent review at the end.

**Goal:** Add distinct six-map atmosphere and an accessible, skippable camp arrival sequence.

**Architecture:** Keep core.js and combat.js unchanged. Add scenery.js for deterministic environmental rendering and finale.js for a pure presentation timeline. game.js coordinates rendering and results; HTML/CSS supplies accessible skip/caption controls.

**Tech Stack:** Existing offline Canvas 2D, JavaScript, Node test, Python Playwright.

**Spec:** ../specs/2026-11-02-scenery-finale-design.md (approved by user).

## Constraints and review focus

- Preserve three characters, six maps, combat, scoring, saves, and original assets.
- Ordinary/final sequences last 4/7 seconds; reduced motion lasts 1 second, with no positional animation.
- Never animate core player/cat physics; terminal core state already freezes the simulation.
- Skip through button or Enter/Space/Escape; controls, replay, help, tab visibility and focus must not trap the player.
- Static scenery cached with a bounded cache; no dependencies, external assets, network calls, per-frame full-screen blur.
- Test packaged source fingerprints including both new modules; keep old ZIP and deliver v4 locally.

## Tasks

- [x] 1. Write failing Node timeline/scenery tests. Implement deterministic profiles and a pure finale timeline. Verify with existing core/combat suites.
- [x] 2. Implement themed depth/lighting and integrate completion gating, actor presentation, route, captions, skip and reduced motion. Run focused browser QA at desktop and mobile sizes, fix visual/interaction defects.
- [x] 3. Update browser/package source contracts and docs. Run six-stage keyboard campaign, traps, offline checks, focused finale checks and performance sampling; review, build v4 ZIP and mirror the local standalone game.

## Execution ledger

- Baseline: commit 43eac74, 31 mechanism tests passed, browser contract passed.
- Ruling: work in the current clean local checkout without commits, merges or publishing. The only initial untracked files are this task's spec and baseline QA files; no parallel source edits were found. Existing Git history and v3 ZIP preserve the prior version.
- User selected the existing-world refinement and approved the design above. No further design approvals are required.
- Task 1: presentation tests failed on missing modules, then all 36 Node tests passed after implementation.
- Task 2: focused browser checks passed for natural ending, score freeze, help, all skip inputs, blur/focus, mobile touch and reduced-motion offline use. Visual review led to softer cached rays, removal of circular forest placeholders, and shadows restricted to actual ground receivers.
- Independent review found one keyboard-focus defect: the inherited global focus rule changed the absolute skip button to relative positioning. A keyboard-only browser regression reproduced the button outside the clipped stage; the local focus selector now preserves absolute positioning. No other material issues were reported. Final source QA is rerun after this fix.
- Final rerun observation: one keyboard driver fell into the last lagoon gap while three headless browser suites were running concurrently. The prior full six-stage run passed with identical physics and JavaScript; only the skip-button focus CSS changed afterward. Keep the failure log, measure performance and rerun the full campaign alone before accepting the package.

| Ranked hypothesis | Evidence / discriminating check |
| --- | --- |
| 1. External keyboard polling missed the 32-unit edge trigger under concurrent browser load | At 320 units/s the trigger gives 100 ms; failure was at the last gap, not a cinematic transition. Rerun alone with the same source. |
| 2. Added rendering causes a material frame-rate regression | Compare HEAD/v4 draw frequency under the same origin and viewport without other tests. |
| 3. Core gameplay changed | Low likelihood: core.js and combat.js are unchanged, 31 original mechanism tests pass, previous full campaign passed. Verify unchanged diffs. |

- Final isolated campaign passed all six stages, offline resources, mobile orientation/touch and save/pause checks with zero console/resource errors. The concurrent failure was not reproduced; no gameplay code was changed to bypass it.
- Focused presentation suite passed 10 checks, including the keyboard focus regression. Trap suite passed swamp/quicksand real-keyboard entry and escape. Final Node suite: 36 passed, 0 failed.
- Same-machine 1280x800 headless samples: v3 60.16/60.18/60.20 draws/s, v4 59.98/59.99/59.98 for grassland/forest/cavern. These short desktop samples do not establish performance on all devices.
- Mechanical design scan reported only inherited small reload-hint text; the new caption and skip controls were visually checked at desktop, portrait and landscape sizes. No broader UI restyling was added.
- First package passed: v4 ZIP, 98 files, 17.88 MiB, CRC and byte-for-byte contents verified. Updated ledger is included in the final archive refresh. Local source sync follows the verified runtime/asset preflight; existing Blender files and the v3 ZIP remain untouched.
