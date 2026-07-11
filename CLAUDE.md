# TAKEOFF — repo conventions

Read `README.md` for architecture. The short version:

- `src/engine/` is pure TS game logic — no React, no DOM, no `Math.random()` (use `state.rng`). All mutations of `GameState` go through engine functions.
- `src/ui/` is a React skin over the engine. UI redesigns must not require engine changes; if you need a derived value, use/add a pure engine helper.
- All tunable numbers live in `src/engine/balance.ts`. After changing balance or systems, run `npm run sim` and sanity-check pacing (games end ~2033) and win rates. The bar: the two single-minded floors (`passive`, `racer`) must stay ~0%, and the reasonable multi-faceted bots (`balanced-racer`, `commerce-safety`, `diplomat`, `hybrid`) should land roughly 15–35% each — a hard game where even good scripted play wins ~1 in 4 (a human does better). Also run `npx tsx src/sim/exploit.ts` — every *single-minded* cheese strategy must stay 0%; multi-faceted combos may reach the reasonable-bot band. Use `npx tsx src/sim/debug.ts <strategy> <seed>` to trace a single game.
- Design note: RSI (self-growth) is mathematically the *only* route to capability 100 — training FLOP alone can't reach it (the log curve). RSI is deliberately slow and tapers near the ceiling (`RSI_DECEL_CAP`), so the skillful racer line is to grind alignment to the Provable ceiling first, then take RSI last to tip a well-aligned flagship over 100. Nerfing RSI's *reach* (vs its speed) removes racing as a win path entirely.
- Verify before finishing: `npm run lint && npm run typecheck && npm test`. The UI smoke tests (`src/ui/App.test.tsx`) SSR-render every tab against a real mid-game state — keep them passing when changing the UI.
- `GameState` is plain JSON (saves = `JSON.stringify`). Don't put functions, class instances, or `Date` objects in it. Bump `version` in `save.ts` on breaking shape changes.
