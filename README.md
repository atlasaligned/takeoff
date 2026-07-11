# TAKEOFF

Real-time management game: run one of four frontier AI labs from 2026 until someone builds a superintelligence — aligned or otherwise — or the world agrees to stop. Design doc: `game.md`. UI reference: `mock.html`.

## Commands

```bash
npm install
npm run dev        # play at http://localhost:5173
npm test           # vitest (engine + UI smoke tests)
npm run sim        # balancing simulations (all strategies × 40 seeds)
npm run sim -- racer 100   # one strategy, 100 seeds
npx tsx src/sim/exploit.ts             # cheese/exploit sweep (19 degenerate + thoughtful bots)
npx tsx src/sim/exploit.ts rsi-saint 150   # one exploit bot, 150 seeds
npx tsx src/sim/debug.ts balanced 3   # single-game trace for debugging
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
  research.ts    tech tree data + derived modifiers (labMods)
  diplomacy.ts   treaty tree + small actions
  jailbreak.ts   weekly jailbreak rolls, severity ladder, counters
  events.ts      blocking events (incl. the EU ones), weekly event roll
  world.ts       adoption, chip market, government fear dials
  advisor.ts     hint system for new players — one prioritized "do this next"
                 suggestion, built from the same planning primitives as the rival AI
  init.ts        newGame(labId, seed, hintsEnabled)
  save.ts        serialize/deserialize

src/sim/       headless balancing harness (strategies.ts + run.ts + debug.ts)
src/ui/        React shell. Reads GameState, renders, dispatches engine actions.
               No game rules live here — redesign freely.
```

Rules for changes:

- **UI work must not touch `src/engine/`.** If the UI needs a derived number, compute it from state with an existing engine helper (or add a pure helper + test).
- **Balance changes go through `balance.ts`** (plus research/treaty data tables) and get validated with `npm run sim`.
- Everything that mutates `GameState` must flow through engine functions so player and AI labs stay symmetric and saves stay deterministic.
- Randomness only via `state.rng` — never `Math.random()` in the engine.

## Balance notes (current tuning)

From `npm run sim`, 40 seeds per strategy:

| scripted strategy | outcome |
|---|---|
| passive (do nothing) | 0% win — bankruptcy or a reckless rival ends the world |
| racer (capability only) | ~0% — reaches 100 first (~mid-2032) and fails the alignment roll |
| balanced (race + alignment research) | ~35% win via aligned ASI |
| safety (alignment first) | ~5% — too slow, loses to the rival clock |
| diplomat (treaty track) | ~60% win via Global AI Pause (~2033) |

Games end 2032–2033; the effective clock is the fastest rival (usually AXIOM). Terminal jailbreaks are rare but real if you run high capability with low robustness.

## Exploit sweep (anti-cheese)

`src/sim/exploit.ts` plays ~16 degenerate single-minded strategies (bio money printer, warfare contract farm, treaty speedrun, alarm spam, chip-hoard + Compute Cap freeze, fundraise mashing, poach sabotage, RSI-saint alignment min-maxing, weak-to-strong ladders, price dumping, …) against 3 thoughtful bots. The invariant to keep: **no cheese bot should match or beat the intended playstyles** (balanced ~30%, diplomat ~50–60%). Re-run it after any economy, alignment or diplomacy change.

Known failure mode this guards: unbounded money → mega chip fleet → `cbrt(chips)` alignment work grinding to the ceiling → one-shot alignment research stacking above the ceiling → near-free aligned-ASI roll. `ALIGN_CHIPS_CAP` in `balance.ts` (alignment compute saturates; the bottleneck is researchers, not GPUs) is the fix — don't remove it without re-running the sweep.
