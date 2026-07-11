import type { GameState } from './types';

// v4: govt procurement ladder + crackdown branch (govLadder state, lab govt flags).
export const SAVE_VERSION = 4;

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
