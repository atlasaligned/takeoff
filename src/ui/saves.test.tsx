/**
 * Named-save store + modal smoke tests. localStorage doesn't exist in the
 * node test environment, so the store runs against a Map-backed stub.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { newGame } from '../engine/init';
import { deleteSave, listSaves, readSave, writeSave } from './saves';
import { serialize } from '../engine/save';
import { SavesModal } from './SavesModal';
import { GameCtx, type Game } from './useGame';
import type { GameState } from '../engine/types';

function stubStorage() {
  const map = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

beforeEach(stubStorage);
afterEach(() => {
  delete (globalThis as Record<string, unknown>).localStorage;
});

describe('named save store', () => {
  it('writes, lists, reads and deletes slots', () => {
    const state = newGame('helios', 3);
    expect(writeSave('run one', state)).toBe(true);
    expect(writeSave('run two', state)).toBe(true);

    const saves = listSaves();
    expect(saves.map((m) => m.name).sort()).toEqual(['run one', 'run two']);
    expect(saves[0].savedAt).toBeGreaterThan(0);
    expect(saves[0].summary.labName).toBe(state.labs.helios.name);

    const loaded = readSave('run one');
    expect(loaded && serialize(loaded)).toBe(serialize(state));

    deleteSave('run one');
    expect(listSaves().map((m) => m.name)).toEqual(['run two']);
    expect(readSave('run one')).toBeNull();
  });

  it('overwrites a same-named slot instead of duplicating it', () => {
    const state = newGame('helios', 3);
    writeSave('slot', state);
    state.week = 40;
    writeSave('slot', state);
    const saves = listSaves();
    expect(saves).toHaveLength(1);
    expect(saves[0].summary.week).toBe(40);
    expect(readSave('slot')!.week).toBe(40);
  });
});

function fakeGame(state: GameState | null): Game {
  return {
    state,
    version: 1,
    speed: 0,
    tab: 'overview',
    toast: null,
    notices: [],
    dismissNotice: () => {},
    focusId: null,
    clearFocus: () => {},
    setSpeed: () => {},
    goTab: () => {},
    act: () => {},
    start: () => {},
    startTutorial: () => {},
    load: () => false,
    save: () => {},
    saveNamed: () => false,
    loadNamed: () => false,
    quitToMenu: () => {},
  };
}

describe('saves modal', () => {
  it('save mode renders the name form and existing slots', () => {
    const state = newGame('helios', 3);
    writeSave('my run', state);
    const html = renderToString(
      <GameCtx.Provider value={fakeGame(state)}>
        <SavesModal mode="save" onClose={() => {}} />
      </GameCtx.Provider>,
    );
    expect(html).toContain('Save game');
    expect(html).toContain('my run');
    expect(html).toContain('Delete');
  });

  it('load mode renders empty state without a game running', () => {
    const html = renderToString(
      <GameCtx.Provider value={fakeGame(null)}>
        <SavesModal mode="load" onClose={() => {}} />
      </GameCtx.Provider>,
    );
    expect(html).toContain('Load game');
    expect(html).toContain('No saved games yet');
  });
});
