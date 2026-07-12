/**
 * The one balance harness. Every section plays full games (events, gov ladder,
 * jailbreaks and all — the same world a human plays) and reports the outcome
 * distribution split by ending category. Fixed seed schedule, so every run and
 * every bot faces identical worlds.
 *
 *   npm run sim                    # all sections, default sizes
 *   npm run sim -- --fast          # quick smoke pass (smaller N, leaner arbiter)
 *   npm run sim -- containment     # one section
 *   npm run sim -- optimal realgame
 *
 * Sections
 *   containment  each cheese + 3 reasonable (symmetric). GATE: cheese win ≤ 5%.
 *   fairness     the 4 reasonable (symmetric). Reports each one's share — we
 *                watch for one strategy running away with it.
 *   optimal      the adaptive bot + 3 reasonable (symmetric). Reports how much
 *                the strategy-switcher beats fixed play.
 *   realgame     the adaptive bot in the PLAYER seat of the real asymmetric
 *                game, vs the actual in-game rivals. Closest to what a human faces.
 *
 * Exit code 1 if the containment gate fails.
 */
import { weekToDate } from '../engine/balance';
import { ARBITER, optimalAct } from '../engine/arbiter';
import { newGame, newTournamentGame } from '../engine/init';
import { CHEESES, OPTIMAL, REASONABLE, runStrategy, STRATEGY_BY_NAME } from '../engine/strategy';
import { aiEventChoice, resolveEvent } from '../engine/events';
import { advanceWeek } from '../engine/tick';
import type { GameState, LabId } from '../engine/types';

// ---------------------------------------------------------------- config

const MAX_WEEKS = 620; // room for symmetric games (no reckless pace-setter) to decide
const CHEESE_GATE = 0.05; // a cheese may win at most 1 in 20 vs reasonable play

interface Sizes {
  containment: number; // games per cheese
  fairness: number;
  optimal: number;
  realgame: number;
}
const FULL: Sizes = { containment: 24, fairness: 120, optimal: 24, realgame: 24 };
const FAST: Sizes = { containment: 12, fairness: 48, optimal: 12, realgame: 12 };

const WIN_REASONS = new Set(['aligned-asi', 'rival-asi', 'pause-treaty']);
const DOOM_REASONS = new Set(['misaligned-asi', 'rival-misaligned-asi', 'terminal-jailbreak', 'world-war-3']);

// ---------------------------------------------------------------- outcomes

interface Outcome {
  reason: string; // gameOver.reason, or 'timeout'
  week: number;
  /** strategy name of the winning seat (null if doom/timeout) */
  winner: string | null;
  /** strategy name of the seat that caused a doom ending */
  doomBy: string | null;
}

function readOutcome(state: GameState): Outcome {
  const g = state.gameOver;
  if (!g) return { reason: 'timeout', week: state.week, winner: null, doomBy: null };
  const by = g.byLab ? state.labs[g.byLab as LabId].strategy ?? null : null;
  return {
    reason: g.reason,
    week: g.week,
    winner: WIN_REASONS.has(g.reason) ? by : null,
    doomBy: DOOM_REASONS.has(g.reason) ? by : null,
  };
}

// ---------------------------------------------------------------- game runners

/** Symmetric game: four identical labs, one strategy per seat. */
function playSymmetric(seed: number, seats: string[]): Outcome {
  const state = newTournamentGame(seed, seats);
  while (!state.gameOver && state.week < MAX_WEEKS) advanceWeek(state);
  return readOutcome(state);
}

/** Real asymmetric game with the player seat driven by `playerStrat`. */
function playReal(seed: number, playerStrat: string): Outcome {
  const state = newGame('helios', seed);
  const player = state.labs[state.playerLab];
  const strat = STRATEGY_BY_NAME[playerStrat];
  player.strategy = playerStrat;
  player.profile = strat.profile;
  while (!state.gameOver && state.week < MAX_WEEKS) {
    // answer any blocking player events the way this strategy would
    while (state.pendingEvents.length > 0 && !state.gameOver) {
      const ev = state.pendingEvents[0];
      const choiceId = aiEventChoice(state, player, ev, strat.events?.[ev.eventId]);
      resolveEvent(state, state.pendingEvents.shift()!, choiceId);
    }
    if (state.gameOver) break;
    // drive the player seat (rivals are driven inside advanceWeek)
    if (strat.meta) optimalAct(state, player);
    else runStrategy(state, player, strat);
    advanceWeek(state);
  }
  return readOutcome(state);
}

// ---------------------------------------------------------------- reporting

const pct = (n: number, total: number): string => (total === 0 ? '—' : `${((100 * n) / total).toFixed(0)}%`);

function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Print the ending distribution (wins / losses / timeout) for a set of games. */
function endingTable(outcomes: Outcome[], indent = '    '): void {
  const counts = new Map<string, number>();
  for (const o of outcomes) counts.set(o.reason, (counts.get(o.reason) ?? 0) + 1);
  const n = outcomes.length;
  const cat = (r: string) => (WIN_REASONS.has(r) ? 'WIN ' : r === 'timeout' ? 'TIME' : 'LOSS');
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [reason, c] of rows) console.log(`${indent}${cat(reason)}  ${pct(c, n).padStart(4)}  ${reason}`);
  const ended = outcomes.filter((o) => o.reason !== 'timeout').map((o) => o.week);
  console.log(`${indent}median end wk ${median(ended)} (${weekToDate(median(ended) || 1).label})`);
}

// ---------------------------------------------------------------- sections

function runContainment(games: number): boolean {
  console.log(`\n══════ CONTAINMENT — each cheese + 3 reasonable, ${games} games each · GATE win ≤ ${CHEESE_GATE * 100}% ══════`);
  const rows: { name: string; winRate: number; doomRate: number; pass: boolean }[] = [];
  let allPass = true;
  for (const cheese of CHEESES) {
    const outcomes: Outcome[] = [];
    let wins = 0;
    let dooms = 0;
    for (let g = 0; g < games; g++) {
      // rotate which reasonable sits out and the cheese's seat so no lineup or
      // tick slot decides the result
      const others = REASONABLE.filter((_, i) => i !== g % REASONABLE.length);
      const seats = [...others];
      seats.splice(g % 4, 0, cheese);
      const o = playSymmetric(g + 1, seats);
      outcomes.push(o);
      if (o.winner === cheese) wins++;
      if (o.doomBy === cheese) dooms++;
    }
    const winRate = wins / games;
    const pass = winRate <= CHEESE_GATE;
    if (!pass) allPass = false;
    rows.push({ name: cheese, winRate, doomRate: dooms / games, pass });
    console.log(`\n  ${cheese} — wins ${pct(wins, games)}${pass ? '' : '  ✗ ABOVE GATE'} · dooms caused ${pct(dooms, games)}`);
    endingTable(outcomes);
  }
  console.log('\n  ── cheese leaderboard (win rate vs reasonable table) ──');
  for (const r of [...rows].sort((a, b) => b.winRate - a.winRate)) {
    console.log(`  ${(r.winRate * 100).toFixed(0).padStart(3)}%  ${r.name}${r.pass ? '' : '  ✗'}`);
  }
  console.log(`\n  CONTAINMENT: ${allPass ? 'PASS' : 'FAIL'}`);
  return allPass;
}

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
}

function runFairness(games: number): void {
  console.log(`\n══════ FAIRNESS — ${REASONABLE.join(' / ')}, ${games} games ══════`);
  const perms = permutations(REASONABLE);
  const outcomes: Outcome[] = [];
  const wins = new Map<string, number>(REASONABLE.map((r) => [r, 0]));
  const dooms = new Map<string, number>(REASONABLE.map((r) => [r, 0]));
  for (let g = 0; g < games; g++) {
    const o = playSymmetric(g + 1, perms[g % perms.length]);
    outcomes.push(o);
    if (o.winner) wins.set(o.winner, (wins.get(o.winner) ?? 0) + 1);
    if (o.doomBy) dooms.set(o.doomBy, (dooms.get(o.doomBy) ?? 0) + 1);
  }
  const decided = outcomes.filter((o) => o.winner !== null);
  console.log(`\n  decided ${pct(decided.length, games)} · doomed ${pct(outcomes.filter((o) => o.doomBy).length, games)} · timeout ${pct(outcomes.filter((o) => o.reason === 'timeout').length, games)}`);
  endingTable(outcomes, '  ');
  console.log('');
  for (const r of REASONABLE) {
    const w = wins.get(r) ?? 0;
    console.log(`  ${r.padEnd(16)} wins ${pct(w, games).padStart(4)} of games · ${pct(w, decided.length).padStart(4)} of decided · dooms ${pct(dooms.get(r) ?? 0, games)}`);
  }
}

function runOptimal(games: number): void {
  console.log(`\n══════ OPTIMAL — the adaptive bot + 3 reasonable, ${games} games ══════`);
  const outcomes: Outcome[] = [];
  let optWins = 0;
  for (let g = 0; g < games; g++) {
    // optimal + a rotating trio of reasonable bots; rotate optimal's seat too
    const trio = [REASONABLE[g % 4], REASONABLE[(g + 1) % 4], REASONABLE[(g + 2) % 4]];
    const seats = [...trio];
    seats.splice(g % 4, 0, OPTIMAL);
    const o = playSymmetric(g + 1, seats);
    outcomes.push(o);
    if (o.winner === OPTIMAL) optWins++;
  }
  const decided = outcomes.filter((o) => o.winner !== null).length;
  console.log(`\n  optimal wins ${pct(optWins, games)} of games · ${pct(optWins, decided)} of decided (chance among 4 seats = 25%)`);
  endingTable(outcomes, '  ');
}

function runRealGame(games: number): void {
  console.log(`\n══════ REALGAME — the adaptive bot in the player seat of the real game ══════`);
  const rivals = Object.values(newGame('helios', 1).labs)
    .filter((l) => l.id !== 'helios')
    .map((l) => `${l.shortName}:${l.strategy}`)
    .join(' · ');
  console.log(`  player = optimal (ENTROPIC seat) · rivals = ${rivals}`);
  const outcomes: Outcome[] = [];
  let wins = 0;
  for (let g = 0; g < games; g++) {
    const o = playReal(g + 1, OPTIMAL);
    outcomes.push(o);
    if (WIN_REASONS.has(o.reason)) wins++;
  }
  console.log(`\n  player win rate (any good ending) ${pct(wins, games)}`);
  endingTable(outcomes, '  ');
}

// ---------------------------------------------------------------- main

const argv = process.argv.slice(2);
const fast = argv.includes('--fast');
const sizes = fast ? FAST : FULL;
if (fast) {
  ARBITER.evalInterval = 34;
  ARBITER.seedsPerCandidate = 2;
}
const sections = argv.filter((a) => !a.startsWith('--'));
const run = (name: string) => sections.length === 0 || sections.includes(name);

let pass = true;
if (run('containment')) pass = runContainment(sizes.containment) && pass;
if (run('fairness')) runFairness(sizes.fairness);
if (run('optimal')) runOptimal(sizes.optimal);
if (run('realgame')) runRealGame(sizes.realgame);

console.log(`\n${'═'.repeat(60)}\nHARNESS ${pass ? 'PASS' : 'FAIL'} (containment gate ${CHEESE_GATE * 100}%)`);
process.exitCode = pass ? 0 : 1;
