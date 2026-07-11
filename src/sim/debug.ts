/** Single-game trace for balance debugging: npx tsx src/sim/debug.ts [strategy] [seed] */
import { newGame } from '../engine/init';
import { flagship } from '../engine/model';
import { weekToDate } from '../engine/balance';
import { playGame, STRATEGIES } from './strategies';

const stratName = process.argv[2] ?? 'balanced-racer';
const seed = Number(process.argv[3] ?? 1);
const strategy = STRATEGIES.find((s) => s.name === stratName)!;
const state = newGame('helios', seed);

console.log('week |', Object.values(state.labs).map((l) => l.shortName.padStart(9)).join(' |'));
playGame(state, strategy, 500, (s) => {
  if (s.week % 25 !== 0) return;
  const cells = Object.values(s.labs).map((l) => {
    if (!l.alive) return '     DEAD'.padStart(9);
    const m = flagship(l);
    return `${(m?.capability ?? 0).toFixed(0).padStart(3)}c ${(m?.alignment ?? 0).toFixed(0)}a`.padStart(9);
  });
  const cash = Object.values(s.labs).map((l) => (l.alive ? `${(l.cash / 1000).toFixed(1)}B/${(l.chips / 1000).toFixed(0)}k` : '-').padStart(10));
  console.log(`${String(s.week).padStart(4)} | ${cells.join(' | ')} || cash/chips: ${cash.join(' ')} | adopt ${s.world.adoption.toFixed(0)} | usRisk ${s.govs.us.riskFear.toFixed(0)} usRace ${s.govs.us.raceFear.toFixed(0)}`);
});
console.log(state.gameOver ? `${weekToDate(state.week).label}: ${state.gameOver.result} — ${state.gameOver.reason}` : 'timeout');
