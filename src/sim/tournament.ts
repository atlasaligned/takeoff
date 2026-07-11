/**
 * Symmetric strategy tournament: 4 IDENTICAL labs, one strategy per seat, no
 * events, no player special-casing. This is where strategy quality is measured
 * free of the real game's deliberate starting imbalance.
 *
 *   npx tsx src/sim/tournament.ts               # both modes
 *   npx tsx src/sim/tournament.ts cheese 48     # cheese containment, 48 games per cheese
 *   npx tsx src/sim/tournament.ts fair 240      # reasonable-vs-reasonable, 240 games
 *   npx tsx src/sim/tournament.ts fair 240 --duels  # add pairwise 2v2 duels
 *
 * Invariants (exit code 1 on failure):
 *   - every cheese strategy wins ≤ CHEESE_MAX of its games vs 3 reasonable bots
 *   - among the reasonable four, every strategy's share of decided games stays
 *     inside [FAIR_MIN, FAIR_MAX] — nobody dominates, nobody is dead weight
 */
import { weekToDate } from '../engine/balance';
import { newTournamentGame } from '../engine/init';
import { CHEESES, REASONABLE } from '../engine/strategy';
import { advanceWeek } from '../engine/tick';
import type { LabId } from '../engine/types';

const MAX_WEEKS = 800; // symmetric games lack the event economy and a reckless pace-setter; give them room to decide
const CHEESE_MAX = 0.05; // "reliably lose": at most 1 in 20
const FAIR_MIN = 0.1; // of decided games (even split = 0.25)
const FAIR_MAX = 0.45;

const WIN_REASONS = new Set(['rival-asi', 'aligned-asi', 'pause-treaty']);
const DOOM_REASONS = new Set(['rival-misaligned-asi', 'misaligned-asi', 'terminal-jailbreak', 'world-war-3']);

interface Outcome {
  /** strategy name of the winning seat, null if doom/timeout */
  winner: string | null;
  /** strategy name of the seat that caused a doom ending */
  doomBy: string | null;
  reason: string;
  week: number;
}

function playOne(seed: number, seats: string[]): Outcome {
  const state = newTournamentGame(seed, seats);
  while (!state.gameOver && state.week < MAX_WEEKS) advanceWeek(state);
  const g = state.gameOver;
  if (!g) return { winner: null, doomBy: null, reason: 'timeout', week: state.week };
  const by = g.byLab ? (state.labs[g.byLab as LabId].strategy ?? null) : null;
  return {
    winner: WIN_REASONS.has(g.reason) ? by : null,
    doomBy: DOOM_REASONS.has(g.reason) ? by : null,
    reason: g.reason,
    week: g.week,
  };
}

function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

const pct = (n: number, total: number): string => (total === 0 ? '—' : `${((100 * n) / total).toFixed(0)}%`);

function reasonTable(outcomes: Outcome[]): string {
  const counts = new Map<string, number>();
  for (const o of outcomes) counts.set(o.reason, (counts.get(o.reason) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([r, c]) => `${pct(c, outcomes.length)} ${r}`)
    .join(' · ');
}

// ---------------------------------------------------------------- cheese containment

function runCheese(gamesPer: number): boolean {
  console.log(`\n══════ CHEESE CONTAINMENT — each cheese vs 3 reasonable bots, ${gamesPer} games each ══════`);
  let allPass = true;
  const rows: { name: string; winRate: number; doomRate: number; pass: boolean }[] = [];
  for (const cheese of CHEESES) {
    const outcomes: Outcome[] = [];
    let wins = 0;
    let dooms = 0;
    for (let g = 0; g < gamesPer; g++) {
      // rotate which reasonable bot sits out and which seat the cheese takes,
      // so results don't hinge on one lineup or on tick order
      const others = REASONABLE.filter((_, i) => i !== g % REASONABLE.length);
      const seats = [...others];
      seats.splice(g % 4, 0, cheese);
      const o = playOne(g + 1, seats);
      outcomes.push(o);
      if (o.winner === cheese) wins++;
      if (o.doomBy === cheese) dooms++;
    }
    const winRate = wins / gamesPer;
    const pass = winRate <= CHEESE_MAX;
    if (!pass) allPass = false;
    rows.push({ name: cheese, winRate, doomRate: dooms / gamesPer, pass });
    console.log(`\n  ${cheese} — wins ${pct(wins, gamesPer)}${pass ? '' : '  ✗ ABOVE CEILING'} · dooms caused ${pct(dooms, gamesPer)}`);
    console.log(`    endings: ${reasonTable(outcomes)}`);
  }
  console.log('\n  ── cheese leaderboard (win rate vs reasonable table) ──');
  for (const r of [...rows].sort((a, b) => b.winRate - a.winRate)) {
    console.log(`  ${(r.winRate * 100).toFixed(0).padStart(3)}%  ${r.name}${r.pass ? '' : '  ✗'}`);
  }
  console.log(`\n  CHEESE CONTAINMENT: ${allPass ? 'PASS' : 'FAIL'} (ceiling ${CHEESE_MAX * 100}%)`);
  return allPass;
}

// ---------------------------------------------------------------- reasonable fairness

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
}

function runFair(games: number, duels: boolean): boolean {
  console.log(`\n══════ REASONABLE FAIRNESS — ${REASONABLE.join(' / ')}, ${games} games ══════`);
  const perms = permutations(REASONABLE);
  const outcomes: Outcome[] = [];
  const wins = new Map<string, number>(REASONABLE.map((r) => [r, 0]));
  const dooms = new Map<string, number>(REASONABLE.map((r) => [r, 0]));
  for (let g = 0; g < games; g++) {
    const o = playOne(g + 1, perms[g % perms.length]);
    outcomes.push(o);
    if (o.winner) wins.set(o.winner, (wins.get(o.winner) ?? 0) + 1);
    if (o.doomBy) dooms.set(o.doomBy, (dooms.get(o.doomBy) ?? 0) + 1);
  }
  const decided = outcomes.filter((o) => o.winner !== null);
  const ended = outcomes.filter((o) => o.reason !== 'timeout');
  console.log(`\n  decided ${pct(decided.length, games)} · doomed ${pct(outcomes.filter((o) => o.doomBy).length, games)} · timeout ${pct(games - ended.length, games)} · median end wk ${median(ended.map((o) => o.week))} (${weekToDate(median(ended.map((o) => o.week)) || 1).label})`);
  console.log(`  endings: ${reasonTable(outcomes)}\n`);

  let allPass = true;
  for (const r of REASONABLE) {
    const w = wins.get(r) ?? 0;
    const share = decided.length ? w / decided.length : 0;
    const pass = share >= FAIR_MIN && share <= FAIR_MAX;
    if (!pass) allPass = false;
    console.log(`  ${r.padEnd(16)} wins ${pct(w, games).padStart(4)} of games · ${pct(w, decided.length).padStart(4)} of decided${pass ? '' : '  ✗ OUTSIDE BAND'} · dooms caused ${pct(dooms.get(r) ?? 0, games)}`);
  }
  console.log(`\n  FAIRNESS: ${allPass ? 'PASS' : 'FAIL'} (each strategy ${FAIR_MIN * 100}–${FAIR_MAX * 100}% of decided games)`);

  if (duels) {
    console.log('\n  ── pairwise 2v2 duels (win share of decided, 24 games each) ──');
    for (let i = 0; i < REASONABLE.length; i++) {
      for (let j = i + 1; j < REASONABLE.length; j++) {
        const a = REASONABLE[i];
        const b = REASONABLE[j];
        let aw = 0;
        let bw = 0;
        for (let g = 0; g < 24; g++) {
          // alternate seat pattern ABAB / BABA so neither owns a tick slot
          const seats = g % 2 === 0 ? [a, b, a, b] : [b, a, b, a];
          const o = playOne(g + 1, seats);
          if (o.winner === a) aw++;
          if (o.winner === b) bw++;
        }
        console.log(`  ${a} vs ${b}: ${aw}–${bw}${aw + bw < 8 ? ' (mostly undecided)' : ''}`);
      }
    }
  }
  return allPass;
}

// ---------------------------------------------------------------- main

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const duels = process.argv.includes('--duels');
const mode = args[0] === 'cheese' || args[0] === 'fair' ? args[0] : 'both';
const n = Number(args[1] ?? args[0]) || 0;

let pass = true;
if (mode === 'cheese' || mode === 'both') pass = runCheese(n || 24) && pass;
if (mode === 'fair' || mode === 'both') pass = runFair(n || 120, duels) && pass;
process.exitCode = pass ? 0 : 1;
