/** Scratch trace for one tournament game. */
import { newTournamentGame } from '../engine/init';
import { flagship } from '../engine/model';
import { hasR } from '../engine/research';
import { advanceWeek } from '../engine/tick';

const seats = ['balanced-racer', 'commerce-safety', 'diplomat', 'hybrid'];
const state = newTournamentGame(Number(process.argv[2] ?? 1), seats);
while (!state.gameOver && state.week < 800) {
  advanceWeek(state);
  if (state.week % 80 === 0) {
    const cells = Object.values(state.labs).map((l) => {
      if (!l.alive) return 'DEAD';
      const m = flagship(l);
      return `${l.strategy}: ${(m?.capability ?? 0).toFixed(0)}c ${(m?.alignment ?? 0).toFixed(0)}a${hasR(l, 'rsi') ? ' RSI' : ''}${l.run ? ' running' : ''}`;
    });
    console.log(`${String(state.week).padStart(4)} | ${cells.join(' | ')} | risk ${state.govs.us.riskFear.toFixed(0)} | treaties ${state.diplomacy.completed.length}`);
  }
}
console.log(state.gameOver ? `${state.gameOver.result} — ${state.gameOver.reason} by ${state.gameOver.byLab}` : 'timeout');
const dip = Object.values(state.labs).find((l) => l.strategy === 'diplomat')!;
console.log('treaties in force:', state.diplomacy.completed.join(', ') || 'none');
console.log('diplomat cash', (dip.cash / 1000).toFixed(0) + 'B', 'research done', dip.research.completed.length);
