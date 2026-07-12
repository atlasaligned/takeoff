# TAKEOFF

Real-time management game: run one of four frontier AI labs from 2026 until someone builds a superintelligence — aligned or otherwise — or the world agrees to stop. Design doc: `game.md`. UI reference: `mock.html`.

## Commands

```bash
npm install
npm run dev        # play at http://localhost:5173
npm test           # vitest (engine + UI smoke tests)
npm run sim        # the balance harness — all sections (containment / fairness / optimal / realgame)
npm run sim -- --fast              # quick smoke pass (smaller N, leaner arbiter)
npm run sim -- containment optimal # run only named sections
npx tsx src/sim/trace.ts real optimal 3   # single-game trace (real asymmetric game)
npx tsx src/sim/trace.ts sym balanced-racer,diplomat,hybrid,commerce-safety 3  # symmetric trace
npm run lint && npm run typecheck
npm run build
```

## Architecture

The game logic is **fully decoupled from the UI** — keep it that way:

```
src/engine/    pure TypeScript, zero React/DOM imports
  types.ts       GameState and all entities (plain JSON — save/load is JSON.stringify)
  balance.ts     EVERY tunable number. Tune here, nowhere else.
  rng.ts         seeded mulberry32; RNG state lives inside GameState → determinism
  tick.ts        advanceWeek(state) — the weekly step, the heart of the game
  actions.ts     every player action (also used verbatim by the rival AI)
  rivalAI.ts     weekly decision pass for AI labs (same actions as the player)
  model.ts       capability curve, training runs, alignment band, win roll, RSI
  finance.ts     licenses/demand, P&L, valuation, fundraising
  enterprise.ts  enterprise sales: leads, conversion, fixed-term contracts
  research.ts    tech tree data + derived modifiers (labMods)
  diplomacy.ts   treaty tree + small actions
  jailbreak.ts   weekly jailbreak rolls, severity ladder, counters
  events.ts      blocking events (incl. the EU ones), weekly event roll
  world.ts       adoption, chip market, government fear dials
  advisor.ts     hint system for new players — one prioritized "do this next"
                 suggestion, built from the same planning primitives as the rival AI
  init.ts        newGame(labId, seed, hintsEnabled)
  save.ts        serialize/deserialize

src/sim/       balance harness (harness.ts) + single-game trace (trace.ts)
src/ui/        React shell. Reads GameState, renders, dispatches engine actions.
               No game rules live here — redesign freely.
```

Rules for changes:

- **UI work must not touch `src/engine/`.** If the UI needs a derived number, compute it from state with an existing engine helper (or add a pure helper + test).
- **Balance changes go through `balance.ts`** (plus research/treaty data tables) and get validated with `npm run sim`.
- Everything that mutates `GameState` must flow through engine functions so player and AI labs stay symmetric and saves stay deterministic.
- Randomness only via `state.rng` — never `Math.random()` in the engine.

## The balance harness (`npm run sim`)

One harness, four sections, all playing full games (events, gov ladder, jailbreaks) on a fixed seed schedule so every run faces identical worlds:

- **containment** — each cheese strategy + 3 reasonable bots (symmetric). Gate: a cheese wins ≤5%, else exit code 1. The anti-cheese invariant.
- **fairness** — the four reasonable strategies (`balanced-racer`, `commerce-safety`, `diplomat`, `hybrid`), all seat permutations. Watch that no single fixed line runs away with it.
- **optimal** — the adaptive `optimal` bot (rolls each reasonable playbook to the end and switches to the winner) + 3 reasonable. Measures how much strategy-switching beats fixed play; chance among 4 seats is 25%.
- **realgame** — `optimal` in the player seat of the real asymmetric game vs the actual in-game rivals. Closest to what a human faces.

Games end ~2033–2035; the effective clock is the fastest rival (OPENAGI races capability with no alignment program by design — the doom pace-setter). Terminal jailbreaks are rare but real if you run high capability with low robustness.

Known cheese failure mode the containment gate guards: unbounded money → mega chip fleet → `cbrt(chips)` alignment work grinding to the ceiling → one-shot alignment research stacking above the ceiling → near-free aligned-ASI roll. `ALIGN_CHIPS_CAP` in `balance.ts` (alignment compute saturates; the bottleneck is researchers, not GPUs) is the fix — don't remove it without re-running containment.
