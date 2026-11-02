# Random Blocks and Item HUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Ship head-hit random blocks, automatic beneficial rewards and a clearer mobile-friendly interface as v4.3.

**Architecture:** Keep the existing plain JavaScript/Canvas application. Isolate reward rules in `items.js`, integrate physics and saves in `core.js`, and render original blocks and reward feedback through `game.js` and `item-art.js`. HTML/CSS presents compact status information without new gameplay buttons.

**Tech Stack:** JavaScript, Canvas 2D, CSS, Node test runner, Python Playwright; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-02-random-blocks-ui-design.md`

## Global Constraints

- Three fixed safe blocks per map; content chosen randomly on first upward head collision only.
- Rewards: 35% five coins; 25% one heart (full health becomes five coins); 20% eight-second one-hit shield; 20% ten-second 150-unit coin magnet.
- Same-effect pickup refreshes duration; pause freezes effects; respawn clears effects but preserves used blocks; retry/next clears level rewards.
- Continue saves preserve remaining effect duration and used blocks; old v1 saves remain readable. Shield cannot prevent falling and grants 0.5 seconds protection after absorption.
- Keep six maps, three characters, original audio, scenery/finale, v4.2 viewport and 64/68/80px movement/fire/jump controls.
- Local, package and deployed verification required. Publishing original URL is included in the approved design.

## Review Focus

- Head/side/top contact must not cause repeated rewards or trap the player in solid geometry (Task 1 collision tests).
- A restored save must not reroll used blocks or lose bonus coins and effects (Task 1 round-trip and malformed saves).
- Multiple same-frame hazards must consume a shield only once without immediately taking health (Task 1 repeated damage test).
- Both effects plus boss HUD must fit 568×320 and rotated portrait layouts (Task 2 browser bounds/overlap checks).
- Adding blocks must not make mandatory routes dependent on a random reward (Task 3 full campaign and all character route tests).

## Task 1: Reward rules, solid blocks and persistence

**Files:** new `items.js`, `tests/items.test.cjs`; modify `core.js` and only necessary combat integration.
**Interface:** `game.blocks` contains `{id,x,y,w,h,kind:'reward',used,reward,bumpLeft}` with reward IDs `coins|heal|shield|magnet|null`; blocks also participate in `game.platforms`. `game.effects={shield:number,magnet:number}` contains remaining seconds. Reward event is `{type:'reward',reward,coins,healed,x,y,blockId}`; shield event is `{type:'shield',x,y}`. `TrailItems.rewards` provides names/colors/durations for UI, with `setup(game)`, `tick(game,dt)`, `bump(game,block)` and `absorb(game,force)` mechanics. Save storage details are owned by the mechanism implementer; validate new fields atomically.

- [x] Write and run failing tests for upward-only first activation, all four outcomes and full-heart conversion; assert actual hearts/score/effect changes.
- [x] Implement fixed safe locations, solid side/top/bottom collisions and bounded feedback timers. Account for the 94-unit visible sprite over the 70-unit body when aligning head contact.
- [x] Test and implement shield/magnet, pause/death/next/retry rules; shield cannot absorb `hurt(true)`.
- [x] Test and implement v1-compatible saves, reward bonus accounting, used block restoration and bounded effect values; invalid saves cannot mutate current game.
- [x] Run all Node tests, including original route coverage. Record red/green evidence.

## Task 2: Block artwork, reward feedback and UI

**Files:** new `item-art.js`, `tests/browser_items.py`; modify `game.js`, `index.html`, `style.css`, `tests/browser_qa.py` source manifest.
**Interface:** `TrailItemArt.block(ctx,block,camera,time,reduced)` draws each block; `icon(ctx,kind,x,y,size)` draws reward icons; `aura(ctx,player,effects,camera,time,reduced)` draws active effects. UI reads Task 1 state and events without modifying gameplay. `#itemHud`, `#shieldEffect`, `#magnetEffect` expose effect state/countdowns; `#rewardNotice` is an accessible announcement.

- [x] Write browser assertions for visible effect labels, hide-empty state, head-hit through actual keyboard/touch, used-state persistence and phone HUD clearance; demonstrate pre-implementation failure.
- [x] Draw wood frames, leaf motif, question mark, used blocks, short bump and reward icon pop. Pause/reduced-motion stop decorative movement; sounds obey mute.
- [x] Consolidate life/coins/ammo alignment, increase undersized labels, add quiet item guide and compact effect chips. Preserve existing test selectors and large touch controls.
- [x] Inspect actual desktop, portrait and landscape captures; run item, orientation, audio and finale browser tests against final files.

## Task 3: Integration, packaging and release

**Files:** `package_game.py`, README/DESIGN, QA reports; external local-sync and deployment helpers.

- [x] Add both new scripts to HTML, source-hash manifests, offline/ZIP required files and syntax checks. Add item tests/report to package gate.
- [x] Run complete Node suite, item browser QA, original six-stage keyboard campaign, trap, audio, orientation and finale checks sequentially; source hashes must match shipped runtime.
- [ ] Fresh independent whole-branch review; fix material findings with targeted regression evidence. Run final UI detector once.
- [ ] Build `windward_trails_game_v4_3.zip`, verify CRC/content, safely sync standalone copy against v4.2 baseline, commit and push non-force to original Pages main.
- [ ] Verify deployed commit, runtime bytes, phone controls and a real keyboard head-hit on the public URL. Update deployment receipt after success.

## Execution record

- User approved implementation; proceed without another process-choice approval. Existing dedicated `feat/random-blocks-ui` branch is used in place; no worktree is needed for this shared local application.
- Mechanism and UI files have separate owners under dispatching-parallel-agents; main agent integrates and performs browser/release QA.
- Task 1: 22 initial failing tests; after implementation and review regression, 60 total Node tests pass. Review caught effects surviving saves during death fade; accepted damage now clears effects immediately.
- Task 2: missing HUD reproduced before implementation. Real keyboard/touch hits, effect countdown/continue and four mobile layouts now pass. Both-effect fixtures include the touch controls and boss bar; portrait and 568px overlap defects were corrected.
- Ruling: existing touch jump smoke assertions now check actual upward displacement rather than requiring negative velocity at the sample time; hitting the new solid block legitimately stops ascent. No game physics was changed to satisfy the harness.

- Final local validation: 60 Node tests, item interactions on desktop and four phone layouts, six-stage campaign, traps, orientation, audio and finale checks passed against the same runtime. Final UI detector returned no findings. Release execution and live evidence are recorded outside the archive in the deployment receipt.
