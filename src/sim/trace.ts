/**
 * Single-game trace for debugging. Two modes:
 *
 *   npx tsx src/sim/trace.ts real [strategy] [seed]
 *       one lab in the player seat of the real asymmetric game (default: optimal)
 *   npx tsx src/sim/trace.ts sym [s1,s2,s3,s4] [seed]
 *       a symmetric 4-lab game (default seats: the four reasonable strategies)
 */
import { newGame, newTournamentGame } from '../engine/init';
import { flagship } from '../engine/model';
import { hasR } from '../engine/research';
import { weekToDate } from '../engine/balance';
import { optimalAct } from '../engine/arbiter';
import { runStrategy, STRATEGY_BY_NAME } from '../engine/strategy';
import { aiEventChoice, resolveEvent } from '../engine/events';
import { advanceWeek } from '../engine/tick';
import type { GameState } from '../engine/types';

function row(state: GameState): string {
  const cells = Object.values(state.labs).map((l) => {
    if (!l.alive) return 'DEAD';
    const m = flagship(l);
    const tag = l.metaStrategy ? `opt→${l.metaStrategy.current}` : (l.strategy ?? '?');
    return `${tag}: ${(m?.capability ?? 0).toFixed(0)}c ${(m?.alignment ?? 0).toFixed(0)}a${hasR(l, 'rsi') ? ' RSI' : ''}${l.run ? ' run' : ''}`;
  });
  return `${String(state.week).padStart(4)} | ${cells.join(' | ')} | risk ${state.govs.us.riskFear.toFixed(0)} | treaties ${state.diplomacy.completed.length}`;
}

const mode = process.argv[2] === 'sym' ? 'sym' : 'real';

if (mode === 'sym') {
  const seats = (process.argv[3] ?? 'balanced-racer,commerce-safety,diplomat,hybrid').split(',');
  const seed = Number(process.argv[4] ?? 1);
  const state = newTournamentGame(seed, seats);
  while (!state.gameOver && state.week < 800) {
    advanceWeek(state);
    if (state.week % 80 === 0) console.log(row(state));
  }
  console.log(state.gameOver ? `${state.gameOver.result} — ${state.gameOver.reason} by ${state.gameOver.byLab}` : 'timeout');
} else {
  const stratName = process.argv[3] ?? 'optimal';
  const seed = Number(process.argv[4] ?? 1);
  const strat = STRATEGY_BY_NAME[stratName];
  const state = newGame('helios', seed);
  const player = state.labs[state.playerLab];
  player.strategy = stratName;
  player.profile = strat.profile;
  while (!state.gameOver && state.week < 620) {
    while (state.pendingEvents.length > 0 && !state.gameOver) {
      const ev = state.pendingEvents[0];
      const choiceId = aiEventChoice(state, player, ev, strat.events?.[ev.eventId]);
      resolveEvent(state, state.pendingEvents.shift()!, choiceId);
    }
    if (state.gameOver) break;
    if (strat.meta) optimalAct(state, player);
    else runStrategy(state, player, strat);
    advanceWeek(state);
    if (state.week % 25 === 0) console.log(row(state));
  }
  console.log(state.gameOver ? `${weekToDate(state.week).label}: ${state.gameOver.result} — ${state.gameOver.reason} by ${state.gameOver.byLab}` : 'timeout');
}
