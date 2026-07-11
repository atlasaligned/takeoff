import { respondToEvent } from '../engine/actions';
import { rivalAct } from '../engine/rivalAI';
import { advanceWeek } from '../engine/tick';
import type { GameState } from '../engine/types';
import type { Strategy } from '../engine/strategy';

/**
 * Player-seat harness plumbing. The strategies themselves live in
 * src/engine/strategy.ts (they double as in-game rival personalities);
 * this file drives one of them in the PLAYER seat of a real, asymmetric
 * game — events, government ladder and all.
 */
export { STRATEGIES, STRATEGY_BY_NAME, REASONABLE, CHEESES, type Strategy } from '../engine/strategy';

/** The pacing harness lineup (npm run sim): the two floors + the reasonable four. */
export const PACING_NAMES = ['passive', 'racer', 'balanced-racer', 'commerce-safety', 'diplomat', 'hybrid'];

/** Play one full game with `strategy` in the player seat; returns the final state. */
export function playGame(state: GameState, strategy: Strategy, maxWeeks: number, onWeek?: (state: GameState) => void): GameState {
  const player = state.labs[state.playerLab];
  player.profile = strategy.profile;
  while (!state.gameOver && state.week < maxWeeks) {
    while (state.pendingEvents.length > 0 && !state.gameOver) {
      const event = state.pendingEvents[0];
      const wanted = strategy.events?.[event.eventId];
      const choice = event.choices.find((c) => c.id === wanted) ?? event.choices[0];
      respondToEvent(state, choice.id);
    }
    if (state.gameOver) break;
    if (strategy.baseAI) rivalAct(state, player, { reserved: strategy.reserved, noRuns: strategy.ownRuns, noRaises: strategy.ownRuns });
    strategy.extra?.(state, player);
    advanceWeek(state);
    onWeek?.(state);
  }
  return state;
}
