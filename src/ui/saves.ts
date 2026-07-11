import type { GameState } from '../engine/types';
import { deserialize, serialize, saveSummary, type SaveSummary } from '../engine/save';

/**
 * Named save slots on top of localStorage. The autosave slot ('takeoff-save',
 * owned by useGame) is separate and untouched by this module. Layout: an index
 * of metadata under one key, plus one key per slot for the state itself, so
 * listing saves never parses full game states.
 */

export interface SaveMeta {
  /** slot name as typed by the player — also the slot key; saving twice overwrites */
  name: string;
  /** real-world save time, epoch ms */
  savedAt: number;
  summary: SaveSummary;
}

const INDEX_KEY = 'takeoff-saves';
const slotKey = (name: string) => `takeoff-save:${name}`;

function readIndex(): SaveMeta[] {
  try {
    const json = localStorage.getItem(INDEX_KEY);
    if (!json) return [];
    const idx = JSON.parse(json) as SaveMeta[];
    return Array.isArray(idx) ? idx : [];
  } catch {
    return [];
  }
}

function writeIndex(index: SaveMeta[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

/** All named saves, most recently saved first. */
export function listSaves(): SaveMeta[] {
  return readIndex().sort((a, b) => b.savedAt - a.savedAt);
}

export function writeSave(name: string, state: GameState): boolean {
  try {
    localStorage.setItem(slotKey(name), serialize(state));
    const meta: SaveMeta = { name, savedAt: Date.now(), summary: saveSummary(state) };
    writeIndex([...readIndex().filter((m) => m.name !== name), meta]);
    return true;
  } catch {
    return false; // storage full or unavailable
  }
}

export function readSave(name: string): GameState | null {
  try {
    const json = localStorage.getItem(slotKey(name));
    return json ? deserialize(json) : null;
  } catch {
    return null;
  }
}

export function deleteSave(name: string): void {
  try {
    localStorage.removeItem(slotKey(name));
    writeIndex(readIndex().filter((m) => m.name !== name));
  } catch {
    // unavailable storage — nothing to delete
  }
}
