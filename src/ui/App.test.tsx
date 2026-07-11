/**
 * UI smoke tests: every tab renders against a real mid-game state without
 * crashing. Guards UI redesigns from silently breaking against the engine.
 */
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { newGame, newTutorialGame } from '../engine/init';
import { advanceWeek } from '../engine/tick';
import { respondToEvent } from '../engine/actions';
import { flagship } from '../engine/model';
import App, { GameScreen } from './App';
import { GameCtx, type Game, type TabId } from './useGame';
import { IconDefs } from './icons';
import type { GameState } from '../engine/types';

function midGame(): GameState {
  const state = newGame('helios', 7);
  state.labs.helios.cash = 100_000; // keep the do-nothing fixture lab solvent for 80 weeks
  for (let i = 0; i < 80; i++) {
    while (state.pendingEvents.length > 0) respondToEvent(state, state.pendingEvents[0].choices[0].id);
    advanceWeek(state);
  }
  return state;
}

function fakeGame(state: GameState, tab: TabId, notices: Game['notices'] = []): Game {
  return {
    state,
    version: 1,
    speed: 0,
    tab,
    toast: null,
    notices,
    dismissNotice: () => {},
    focusId: null,
    clearFocus: () => {},
    setSpeed: () => {},
    goTab: () => {},
    act: (fn) => void fn(state),
    start: () => {},
    startTutorial: () => {},
    load: () => false,
    save: () => {},
    quitToMenu: () => {},
  };
}

function renderTab(state: GameState, tab: TabId): string {
  return renderToString(
    <GameCtx.Provider value={fakeGame(state, tab)}>
      <IconDefs />
      <GameScreen />
    </GameCtx.Provider>,
  );
}

const TABS: TabId[] = ['overview', 'models', 'compute', 'research', 'diplomacy', 'people', 'finance', 'rivals', 'world', 'feed'];

describe('UI smoke', () => {
  it('start screen renders', () => {
    const html = renderToString(<App />);
    // the wordmark is split for the outlined-OFF treatment: TAKE<span>OFF</span>
    expect(html).toMatch(/TAKE.*OFF/);
    expect(html).toContain('New game');
    expect(html).toContain('Tutorial');
  });

  const state = midGame();

  for (const tab of TABS) {
    it(`${tab} tab renders against a real mid-game state`, () => {
      const html = renderTab(state, tab);
      expect(html.length).toBeGreaterThan(2000);
      expect(html).toContain('WEEK');
    });
  }

  it('event modal renders when an event is pending', () => {
    const s = midGame();
    s.pendingEvents.push({
      eventId: 'eu-usb-c',
      week: s.week,
      title: 'EU mandates USB-C on datacenters',
      body: 'Compliance is mandatory and confusing.',
      choices: [{ id: 'comply', label: 'Retrofit the racks', detail: '−$15M' }],
      data: {},
    });
    const html = renderTab(s, 'overview');
    expect(html).toContain('USB-C');
    expect(html).toContain('Game paused');
  });

  it('notice modal renders for notice-flagged feed items', () => {
    const s = midGame();
    const html = renderToString(
      <GameCtx.Provider
        value={fakeGame(s, 'overview', [
          { id: 'f999', week: s.week, kind: 'info', title: 'Chips delivered', body: '5,000 chips are online.', goto: 'compute', notice: true },
        ])}
      >
        <IconDefs />
        <GameScreen />
      </GameCtx.Provider>,
    );
    expect(html).toContain('Chips delivered');
    expect(html).toContain('status report');
    expect(html).toContain('Continue');
  });

  it('tutorial dock renders on every tab of a tutorial game', () => {
    const s = newTutorialGame();
    for (const tab of TABS) {
      const html = renderTab(s, tab);
      expect(html).toContain('TUTORIAL · STEP');
    }
  });

  it('end screen renders on game over', () => {
    const s = midGame();
    const m = flagship(s.labs.helios)!;
    m.capability = 100;
    m.alignment = 99;
    advanceWeek(s);
    expect(s.gameOver).not.toBeNull();
    const html = renderTab(s, 'overview');
    expect(html).toMatch(/YOU WIN|GAME OVER/);
  });

  it('tabs render fine with dead rivals and no flagship', () => {
    const s = midGame();
    s.labs.axiom.alive = false;
    s.labs.axiom.deathReason = 'bankrupt';
    s.labs.helios.flagshipId = null;
    for (const tab of TABS) expect(() => renderTab(s, tab)).not.toThrow();
  });
});
