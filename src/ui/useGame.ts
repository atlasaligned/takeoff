import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { advanceWeek, isPaused } from '../engine/tick';
import { deserialize, serialize } from '../engine/save';
import { newGame } from '../engine/init';
import type { ActionResult } from '../engine/actions';
import type { FeedItem, GameState, LabId } from '../engine/types';

const SAVE_KEY = 'takeoff-save';
/** ~6 real seconds per game week at 1x */
const WEEK_MS = 6000;

export type TabId = 'overview' | 'models' | 'compute' | 'research' | 'diplomacy' | 'people' | 'finance' | 'rivals' | 'world' | 'feed';

export interface Game {
  state: GameState | null;
  /** bumps on every mutation — components re-render off it via context */
  version: number;
  speed: number; // 0 = paused, 1/2/4
  tab: TabId;
  toast: { msg: string; err: boolean } | null;
  /** queue of important outcome reports (engine feed items flagged `notice`); the loop holds while non-empty */
  notices: FeedItem[];
  dismissNotice: () => void;
  /** node id to preselect after a goTab deep link (research / diplomacy trees) */
  focusId: string | null;
  clearFocus: () => void;
  setSpeed: (s: number) => void;
  goTab: (t: TabId, focus?: string) => void;
  /** run an engine action against the live state and re-render */
  act: (fn: (s: GameState) => ActionResult | void) => void;
  start: (lab: LabId, seed: number, hints: boolean) => void;
  load: () => boolean;
  save: () => void;
  quitToMenu: () => void;
}

export function hasSave(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

export function useGameController(): Game {
  const stateRef = useRef<GameState | null>(null);
  const [version, setVersion] = useState(0);
  const [speed, setSpeedRaw] = useState(0);
  const [tab, setTab] = useState<TabId>('overview');
  const [focusId, setFocusId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; err: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticesRef = useRef<FeedItem[]>([]);
  /** feedCounter watermark — feed items at/above it haven't been shown as a notice yet */
  const noticeSeen = useRef(0);

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const save = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    try {
      localStorage.setItem(SAVE_KEY, serialize(s));
    } catch {
      // storage full or unavailable — the game keeps running
    }
  }, []);

  /** queue new notice-flagged feed items (oldest first). Never over the end screen. */
  const collectNotices = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    const since = noticeSeen.current;
    noticeSeen.current = s.feedCounter;
    if (s.gameOver) return;
    const fresh = s.feed.filter((f) => f.notice && Number(f.id.slice(1)) >= since).reverse();
    if (fresh.length) noticesRef.current = [...noticesRef.current, ...fresh];
  }, []);

  const dismissNotice = useCallback(() => {
    noticesRef.current = noticesRef.current.slice(1);
    bump();
  }, [bump]);

  // the game loop
  useEffect(() => {
    if (speed === 0 || !stateRef.current) return;
    const id = setInterval(() => {
      const s = stateRef.current;
      if (!s || isPaused(s) || noticesRef.current.length > 0) return;
      advanceWeek(s);
      collectNotices();
      if (s.week % 4 === 0 || s.gameOver) save();
      bump();
    }, WEEK_MS / speed);
    return () => clearInterval(id);
  }, [speed, version === 0, bump, save, collectNotices]);

  const showToast = useCallback((msg: string, err: boolean) => {
    if (!msg) return;
    setToast({ msg, err });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const act = useCallback(
    (fn: (s: GameState) => ActionResult | void) => {
      const s = stateRef.current;
      if (!s || s.gameOver) return;
      const res = fn(s);
      if (res && !res.ok) showToast(res.msg, true);
      else if (res && res.msg) showToast(res.msg, false);
      // actions never flag notices themselves, but move the watermark past any
      // feed items they pushed — the player just clicked; they saw it
      noticeSeen.current = s.feedCounter;
      save();
      bump();
    },
    [bump, save, showToast],
  );

  const goTab = useCallback((t: TabId, focus?: string) => {
    setTab(t);
    setFocusId(focus ?? null);
  }, []);

  const clearFocus = useCallback(() => setFocusId(null), []);

  const start = useCallback(
    (lab: LabId, seed: number, hints: boolean) => {
      stateRef.current = newGame(lab, seed, hints);
      noticesRef.current = [];
      noticeSeen.current = stateRef.current.feedCounter;
      setTab('overview');
      setSpeedRaw(0);
      save();
      bump();
    },
    [bump, save],
  );

  const load = useCallback((): boolean => {
    try {
      const json = localStorage.getItem(SAVE_KEY);
      if (!json) return false;
      stateRef.current = deserialize(json);
      noticesRef.current = [];
      noticeSeen.current = stateRef.current.feedCounter;
      setTab('overview');
      setSpeedRaw(0);
      bump();
      return true;
    } catch {
      return false;
    }
  }, [bump]);

  const quitToMenu = useCallback(() => {
    save();
    stateRef.current = null;
    noticesRef.current = [];
    setSpeedRaw(0);
    bump();
  }, [bump, save]);

  return {
    state: stateRef.current,
    version,
    speed,
    tab,
    toast,
    notices: noticesRef.current,
    dismissNotice,
    focusId,
    clearFocus,
    setSpeed: setSpeedRaw,
    goTab,
    act,
    start,
    load,
    save,
    quitToMenu,
  };
}

export const GameCtx = createContext<Game | null>(null);

export function useGame(): Game {
  const g = useContext(GameCtx);
  if (!g) throw new Error('GameCtx missing');
  return g;
}

/** The live game state; only call inside the running game screen. */
export function useSt(): GameState {
  const g = useGame();
  if (!g.state) throw new Error('no game running');
  return g.state;
}
