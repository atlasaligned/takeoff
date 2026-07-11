import { describe, expect, it } from 'vitest';
import { newTutorialGame } from './init';
import { advanceWeek } from './tick';

describe('tutorial game', () => {
  it('is flagged, funded, and starts like a normal game otherwise', () => {
    const s = newTutorialGame();
    expect(s.tutorial).toBe(true);
    expect(s.hintsEnabled).toBe(false);
    expect(s.labs[s.playerLab].cash).toBe(25_000);
    expect(s.labs[s.playerLab].models).toHaveLength(1);
  });

  it('never fires blocking events — the scripted tour stays uninterrupted', () => {
    const s = newTutorialGame();
    for (let i = 0; i < 30; i++) advanceWeek(s);
    expect(s.pendingEvents).toHaveLength(0);
    expect(s.gameOver).toBeNull();
  });
});
