import { describe, expect, it } from 'vitest';
import { EVENTS, EVENTS_BY_ID, GOV_EVENTS, rollEvent, rollGovLadder, resolveEvent } from './events';
import { BAL } from './balance';
import { newGame } from './init';

const ALL_EVENTS = [...EVENTS, ...GOV_EVENTS];

describe('event definitions', () => {
  it('ids are unique and choices non-empty', () => {
    expect(new Set(ALL_EVENTS.map((e) => e.id)).size).toBe(ALL_EVENTS.length);
    for (const e of ALL_EVENTS) expect(e.choices.length).toBeGreaterThan(0);
  });

  it('weights and bodies evaluate without crashing at game start', () => {
    const state = newGame('helios', 1);
    for (const e of ALL_EVENTS) {
      expect(() => e.weight(state)).not.toThrow();
      const data = e.setup ? e.setup(state) : {};
      expect(typeof e.body(state, data)).toBe('string');
      for (const c of e.choices) expect(typeof c.detail(state, data)).toBe('string');
    }
  });
});

describe('event pacing', () => {
  it('fires roughly 1-2 events per month mid-game', () => {
    // measure the empirical firing rate over many isolated week-rolls
    let fired = 0;
    const trials = 3000;
    for (let seed = 0; seed < trials; seed++) {
      const state = newGame('helios', seed);
      state.week = 100;
      state.weeksSinceEvent = 2; // typical steady state
      if (rollEvent(state)) fired++;
    }
    const perWeek = fired / trials;
    expect(perWeek).toBeGreaterThan(0.15); // ≥ ~0.7/month
    expect(perWeek).toBeLessThan(0.55); // ≤ ~2.4/month
  });

  it('respects per-event cooldowns and once-flags', () => {
    const state = newGame('helios', 1);
    state.week = 50;
    state.eventCooldowns['eu-usb-c'] = 49;
    // roll many times; usb-c must never fire again (once: true)
    for (let i = 0; i < 500; i++) {
      const ev = rollEvent(state);
      if (ev) expect(ev.eventId).not.toBe('eu-usb-c');
    }
  });

  it('drought raises the odds over time', () => {
    let firedDry = 0;
    let firedWet = 0;
    const trials = 2000;
    for (let seed = 0; seed < trials; seed++) {
      const dry = newGame('helios', seed);
      dry.week = 60;
      dry.weeksSinceEvent = 10;
      if (rollEvent(dry)) firedDry++;
      const wet = newGame('helios', seed + 100_000);
      wet.week = 60;
      wet.weeksSinceEvent = 0;
      if (rollEvent(wet)) firedWet++;
    }
    expect(firedDry).toBeGreaterThan(firedWet);
  });
});

describe('govt ladder', () => {
  it('offers the evaluation grant in week 2', () => {
    const state = newGame('helios', 3);
    state.week = 2;
    const ev = rollGovLadder(state);
    expect(ev?.eventId).toBe('gov-eval-grant');
  });

  it('accepting a rung advances the ladder; rejecting freezes and retries it', () => {
    const state = newGame('helios', 5);
    state.week = 2;
    const offer = rollGovLadder(state)!;
    resolveEvent(state, offer, 'reject');
    expect(state.govLadder.rung).toBe(0);
    expect(state.govLadder.rejectedUntil).toBe(2 + BAL.GOV_RETRY_COOLDOWN);
    // frozen: nothing fires during the sulk, even past the spacing gap
    state.week = 2 + BAL.GOV_EVENT_MIN_GAP;
    expect(rollGovLadder(state)).toBeNull();
    // after the cooldown the same rung is offered again
    state.week = 2 + BAL.GOV_RETRY_COOLDOWN;
    const retry = rollGovLadder(state)!;
    expect(retry.eventId).toBe('gov-eval-grant');
    resolveEvent(state, retry, 'accept');
    expect(state.govLadder.rung).toBe(1);
  });

  it('respects the minimum gap between govt events', () => {
    const state = newGame('helios', 7);
    state.week = 2;
    expect(rollGovLadder(state)).not.toBeNull();
    state.week = 2 + BAL.GOV_EVENT_MIN_GAP - 1;
    expect(rollGovLadder(state)).toBeNull();
  });

  it('escalates the crackdown branch while govt trust is low', () => {
    const state = newGame('helios', 9);
    state.labs.helios.govTrust = 10;
    const seen: string[] = [];
    for (let week = 10; week < 400 && seen.length < 5; week++) {
      state.week = week;
      const ev = rollGovLadder(state);
      if (ev) {
        seen.push(ev.eventId);
        resolveEvent(state, ev, ev.choices[ev.choices.length - 1].id); // safe choice
        state.labs.helios.govTrust = 10; // keep it in the doghouse
      }
    }
    expect(seen).toEqual(['gov-hearing', 'gov-binding-regs', 'gov-oversight', 'gov-requisition', 'gov-nationalization']);
    expect(state.gameOver?.reason).toBe('nationalized');
  });

  it('recovering trust resets the crackdown escalation', () => {
    const state = newGame('helios', 11);
    state.govLadder.crackdown = 3;
    state.labs.helios.govTrust = BAL.GOV_CRACKDOWN_RESET + 5;
    state.week = 50;
    rollGovLadder(state);
    expect(state.govLadder.crackdown).toBe(0);
  });
});

describe('event resolution', () => {
  it('every choice of every event applies without crashing', () => {
    for (const e of ALL_EVENTS) {
      for (const c of e.choices) {
        const state = newGame('helios', 7);
        state.labs.helios.cash = 100_000;
        state.week = 60;
        const data = e.setup ? e.setup(state) : {};
        const event = {
          eventId: e.id,
          week: state.week,
          title: typeof e.title === 'function' ? e.title(state, data) : e.title,
          body: e.body(state, data),
          choices: e.choices.map((ch) => ({ id: ch.id, label: ch.label, detail: ch.detail(state, data) })),
          data,
        };
        expect(() => resolveEvent(state, event, c.id)).not.toThrow();
      }
    }
  });

  it('signing a star actually adds them to the roster', () => {
    const state = newGame('helios', 9);
    const def = EVENTS_BY_ID['star-on-market'];
    const data = def.setup!(state);
    const event = { eventId: def.id, week: 0, title: 'x', body: 'x', choices: [], data };
    const before = state.labs.helios.stars.length;
    resolveEvent(state, event, 'hire');
    expect(state.labs.helios.stars.length).toBe(before + 1);
  });
});
