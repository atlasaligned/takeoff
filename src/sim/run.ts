/**
 * Balancing harness: plays many headless games per strategy and prints
 * pacing / outcome statistics.
 *
 *   npm run sim                 # all strategies, 40 seeds each
 *   npm run sim -- racer 100    # one strategy, 100 seeds
 */
import { newGame } from '../engine/init';
import { flagship } from '../engine/model';
import { weekToDate } from '../engine/balance';
import type { GameState } from '../engine/types';
import { PACING_NAMES, playGame, STRATEGIES } from './strategies';

const MAX_WEEKS = 560;

interface GameStats {
  seed: number;
  endWeek: number;
  result: string; // 'timeout' | win/loss reason
  playerCapEnd: number;
  playerAlignEnd: number;
  frontierCapEnd: number;
  jailbreaks: Record<string, number>;
  week60: number | null; // week the frontier crossed 60
  week80: number | null;
  playerBankruptScare: boolean;
}

function frontier(state: GameState): number {
  return Math.max(...Object.values(state.labs).map((l) => (l.alive ? (flagship(l)?.capability ?? 0) : 0)));
}

function runOne(strategyName: string, seed: number): GameStats {
  const strategy = STRATEGIES.find((s) => s.name === strategyName)!;
  const state = newGame('helios', seed);
  const jailbreaks: Record<string, number> = { minor: 0, bad: 0, severe: 0, terminal: 0, saved: 0 };
  let week60: number | null = null;
  let week80: number | null = null;
  let bankruptScare = false;
  let lastFeedId = -1;

  playGame(state, strategy, MAX_WEEKS, (s) => {
    const f = frontier(s);
    if (week60 === null && f >= 60) week60 = s.week;
    if (week80 === null && f >= 80) week80 = s.week;
    if (s.labs[s.playerLab].brokeWeeks > 0) bankruptScare = true;
    // count new jailbreak feed items exactly once
    for (const item of s.feed) {
      const idNum = Number(item.id.slice(1));
      if (idNum <= lastFeedId) continue;
      if (item.title.startsWith('Jailbreak (MINOR)')) jailbreaks.minor++;
      else if (item.title.startsWith('Jailbreak (BAD)')) jailbreaks.bad++;
      else if (item.title.startsWith('Jailbreak (SEVERE)')) jailbreaks.severe++;
      else if (item.title.startsWith('NEAR MISS')) jailbreaks.saved++;
    }
    lastFeedId = Math.max(lastFeedId, ...s.feed.map((i) => Number(i.id.slice(1))));
  });
  if (state.gameOver?.reason === 'terminal-jailbreak') jailbreaks.terminal++;

  const player = state.labs[state.playerLab];
  const m = flagship(player);
  return {
    seed,
    endWeek: state.week,
    result: state.gameOver ? `${state.gameOver.result}:${state.gameOver.reason}` : 'timeout',
    playerCapEnd: m?.capability ?? 0,
    playerAlignEnd: m?.alignment ?? 0,
    frontierCapEnd: frontier(state),
    jailbreaks,
    week60,
    week80,
    playerBankruptScare: bankruptScare,
  };
}

function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function pct(n: number, total: number): string {
  return `${((100 * n) / total).toFixed(0)}%`;
}

function summarize(name: string, stats: GameStats[]): void {
  const n = stats.length;
  console.log(`\n━━━ strategy: ${name} (${n} games) ━━━`);

  const outcomes = new Map<string, number>();
  for (const s of stats) outcomes.set(s.result, (outcomes.get(s.result) ?? 0) + 1);
  const sorted = [...outcomes.entries()].sort((a, b) => b[1] - a[1]);
  for (const [reason, count] of sorted) console.log(`  ${pct(count, n).padStart(4)} ${reason}`);

  const wins = stats.filter((s) => s.result.startsWith('win')).length;
  console.log(`  WIN RATE: ${pct(wins, n)}`);

  const ended = stats.filter((s) => s.result !== 'timeout');
  console.log(`  median end: week ${median(ended.map((s) => s.endWeek))} (${weekToDate(median(ended.map((s) => s.endWeek)) || 0).label})`);
  const w60 = stats.filter((s) => s.week60 !== null).map((s) => s.week60!);
  const w80 = stats.filter((s) => s.week80 !== null).map((s) => s.week80!);
  console.log(`  frontier ≥60: ${pct(w60.length, n)} of games, median week ${median(w60)} · ≥80: ${pct(w80.length, n)}, median week ${median(w80)}`);
  console.log(`  player cap end: median ${median(stats.map((s) => s.playerCapEnd)).toFixed(1)} · align end: median ${median(stats.map((s) => s.playerAlignEnd)).toFixed(1)}`);
  const jb = { minor: 0, bad: 0, severe: 0, terminal: 0, saved: 0 };
  for (const s of stats) {
    jb.minor += s.jailbreaks.minor;
    jb.bad += s.jailbreaks.bad;
    jb.severe += s.jailbreaks.severe;
    jb.terminal += s.jailbreaks.terminal;
    jb.saved += s.jailbreaks.saved;
  }
  console.log(`  jailbreaks/game: minor ${(jb.minor / n).toFixed(1)} · bad ${(jb.bad / n).toFixed(1)} · severe ${(jb.severe / n).toFixed(2)} · terminal ${(jb.terminal / n).toFixed(2)} · saved ${(jb.saved / n).toFixed(2)}`);
  console.log(`  bankruptcy scares: ${pct(stats.filter((s) => s.playerBankruptScare).length, n)}`);
}

const args = process.argv.slice(2);
const only = args[0] && STRATEGIES.some((s) => s.name === args[0]) ? args[0] : null;
const seeds = Number(args[only ? 1 : 0]) || 40;

for (const strategy of STRATEGIES) {
  if (only ? strategy.name !== only : !PACING_NAMES.includes(strategy.name)) continue;
  const stats: GameStats[] = [];
  for (let seed = 1; seed <= seeds; seed++) stats.push(runOne(strategy.name, seed));
  summarize(strategy.name, stats);
}
