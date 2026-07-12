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
    const lab = state.labs.helios;
    for (const e of ALL_EVENTS) {
      expect(() => e.weight(state, lab)).not.toThrow();
      const data = e.setup ? e.setup(state, lab) : {};
      expect(typeof e.body(state, lab, data)).toBe('string');
      for (const c of e.choices) expect(typeof c.detail(state, lab, data)).toBe('string');
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
      state.labs.helios.weeksSinceEvent = 2; // typical steady state
      if (rollEvent(state, state.labs.helios)) fired++;
    }
    const perWeek = fired / trials;
    expect(perWeek).toBeGreaterThan(0.15); // ≥ ~0.7/month
    expect(perWeek).toBeLessThan(0.55); // ≤ ~2.4/month
  });

  it('respects per-event cooldowns and once-flags', () => {
    const state = newGame('helios', 1);
    state.week = 50;
    state.labs.helios.eventCooldowns['eu-usb-c'] = 49;
    // roll many times; usb-c must never fire again (once: true)
    for (let i = 0; i < 500; i++) {
      const ev = rollEvent(state, state.labs.helios);
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
      dry.labs.helios.weeksSinceEvent = 10;
      if (rollEvent(dry, dry.labs.helios)) firedDry++;
      const wet = newGame('helios', seed + 100_000);
      wet.week = 60;
      wet.labs.helios.weeksSinceEvent = 0;
      if (rollEvent(wet, wet.labs.helios)) firedWet++;
    }
    expect(firedDry).toBeGreaterThan(firedWet);
  });
});

describe('govt ladder', () => {
  it('offers the evaluation grant in week 2', () => {
    const state = newGame('helios', 3);
    state.week = 2;
    const ev = rollGovLadder(state, state.labs.helios);
    expect(ev?.eventId).toBe('gov-eval-grant');
  });

  it('accepting a rung advances the ladder; rejecting freezes and retries it', () => {
    const state = newGame('helios', 5);
    const lab = state.labs.helios;
    state.week = 2;
    const offer = rollGovLadder(state, lab)!;
    resolveEvent(state, offer, 'reject');
    expect(lab.govLadder.rung).toBe(0);
    expect(lab.govLadder.rejectedUntil).toBe(2 + BAL.GOV_RETRY_COOLDOWN);
    // frozen: nothing fires during the sulk, even past the spacing gap
    state.week = 2 + BAL.GOV_EVENT_MIN_GAP;
    expect(rollGovLadder(state, lab)).toBeNull();
    // after the cooldown the same rung is offered again
    state.week = 2 + BAL.GOV_RETRY_COOLDOWN;
    const retry = rollGovLadder(state, lab)!;
    expect(retry.eventId).toBe('gov-eval-grant');
    resolveEvent(state, retry, 'accept');
    expect(lab.govLadder.rung).toBe(1);
  });

  it('respects the minimum gap between govt events', () => {
    const state = newGame('helios', 7);
    state.week = 2;
    expect(rollGovLadder(state, state.labs.helios)).not.toBeNull();
    state.week = 2 + BAL.GOV_EVENT_MIN_GAP - 1;
    expect(rollGovLadder(state, state.labs.helios)).toBeNull();
  });

  it('escalates the crackdown branch while govt trust is low', () => {
    const state = newGame('helios', 9);
    const lab = state.labs.helios;
    lab.govTrust = 10;
    const seen: string[] = [];
    for (let week = 10; week < 400 && seen.length < 5; week++) {
      state.week = week;
      const ev = rollGovLadder(state, lab);
      if (ev) {
        seen.push(ev.eventId);
        resolveEvent(state, ev, ev.choices[ev.choices.length - 1].id); // safe choice
        lab.govTrust = 10; // keep it in the doghouse
      }
    }
    expect(seen).toEqual(['gov-hearing', 'gov-binding-regs', 'gov-oversight', 'gov-requisition', 'gov-nationalization']);
    expect(state.gameOver?.reason).toBe('nationalized');
  });

  it('recovering trust resets the crackdown escalation', () => {
    const state = newGame('helios', 11);
    const lab = state.labs.helios;
    lab.govLadder.crackdown = 3;
    lab.govTrust = BAL.GOV_CRACKDOWN_RESET + 5;
    state.week = 50;
    rollGovLadder(state, lab);
    expect(lab.govLadder.crackdown).toBe(0);
  });
});

describe('event resolution', () => {
  it('every choice of every event applies without crashing', () => {
    for (const e of ALL_EVENTS) {
      for (const c of e.choices) {
        const state = newGame('helios', 7);
        const lab = state.labs.helios;
        lab.cash = 100_000;
        state.week = 60;
        const data = e.setup ? e.setup(state, lab) : {};
        const event = {
          eventId: e.id,
          labId: lab.id,
          week: state.week,
          title: typeof e.title === 'function' ? e.title(state, lab, data) : e.title,
          body: e.body(state, lab, data),
          choices: e.choices.map((ch) => ({ id: ch.id, label: ch.label, detail: ch.detail(state, lab, data) })),
          data,
        };
        expect(() => resolveEvent(state, event, c.id)).not.toThrow();
      }
    }
  });

  it('signing a star actually adds them to the roster', () => {
    const state = newGame('helios', 9);
    const lab = state.labs.helios;
    const def = EVENTS_BY_ID['star-on-market'];
    const data = def.setup!(state, lab);
    const event = { eventId: def.id, labId: lab.id, week: 0, title: 'x', body: 'x', choices: [], data };
    const before = lab.stars.length;
    resolveEvent(state, event, 'hire');
    expect(lab.stars.length).toBe(before + 1);
  });
});
