import type { GameState } from './types';
import { flagship } from './model';
import { weekToDate } from './balance';

// v8: per-lab diplomacy (cooldown keys, brokeredBy), GameOver.byLab, Lab.strategy.
export const SAVE_VERSION = 8;

/** GameState is plain JSON by construction — serialization is trivial. */
export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export function deserialize(json: string): GameState {
  const state = JSON.parse(json) as GameState;
  if (typeof state.version !== 'number' || state.version !== SAVE_VERSION) {
    throw new Error(`incompatible save version: ${state.version}`);
  }
  if (!state.labs || !state.rng || typeof state.week !== 'number') {
    throw new Error('corrupt save');
  }
  return state;
}

/** Compact description of a game for save-slot listings. */
export interface SaveSummary {
  labName: string;
  week: number;
  dateLabel: string;
  /** flagship capability, 0 if the lab has no flagship */
  capability: number;
  /** $M */
  cash: number;
  gameOver: { result: 'win' | 'loss'; title: string } | null;
}

export function saveSummary(state: GameState): SaveSummary {
  const lab = state.labs[state.playerLab];
  const m = flagship(lab);
  return {
    labName: lab.name,
    week: state.week,
    dateLabel: weekToDate(state.week).label,
    capability: m?.capability ?? 0,
    cash: lab.cash,
    gameOver: state.gameOver ? { result: state.gameOver.result, title: state.gameOver.title } : null,
  };
}
