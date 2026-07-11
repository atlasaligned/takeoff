import { describe, expect, it } from 'vitest';
import { BAL } from './balance';
import { jailbreakChance, jailbreakTick, jbSeverity } from './jailbreak';
import { flagship } from './model';
import { newGame } from './init';
import { makeRng } from './rng';

describe('severity buckets', () => {
  it('maps capability to the hazard ladder', () => {
    expect(jbSeverity(10)).toBe('minor');
    expect(jbSeverity(29.9)).toBe('minor');
    expect(jbSeverity(30)).toBe('bad');
    expect(jbSeverity(54.9)).toBe('bad');
    expect(jbSeverity(55)).toBe('severe');
    expect(jbSeverity(79.9)).toBe('severe');
    expect(jbSeverity(80)).toBe('terminal');
    expect(jbSeverity(120)).toBe('terminal');
  });
});

describe('jailbreak chance', () => {
  it('rises with capability, falls with robustness, rises with adoption', () => {
    const state = newGame('helios', 1);
    const lab = state.labs.helios;
    const m = flagship(lab)!;
    m.capability = 40;
    m.robustness = 50;
    const base = jailbreakChance(state, lab);

    m.capability = 60;
    expect(jailbreakChance(state, lab)).toBeGreaterThan(base);
    m.capability = 40;

    m.robustness = 90;
    expect(jailbreakChance(state, lab)).toBeLessThan(base);
    m.robustness = 50;

    state.world.adoption = 80;
    expect(jailbreakChance(state, lab)).toBeGreaterThan(base);
  });

  it('is small for a robust mid-capability model and collapses with Unbreakable-level robustness', () => {
    const state = newGame('helios', 1);
    const lab = state.labs.helios;
    const m = flagship(lab)!;
    state.world.adoption = 50;
    m.capability = 85;
    m.robustness = 99;
    expect(jailbreakChance(state, lab)).toBeLessThan(0.002);
    m.robustness = 40;
    expect(jailbreakChance(state, lab)).toBeGreaterThan(0.01);
  });

  it('never exceeds 50%', () => {
    const state = newGame('helios', 1);
    const lab = state.labs.helios;
    const m = flagship(lab)!;
    m.capability = 500;
    m.robustness = 0;
    state.world.adoption = 100;
    expect(jailbreakChance(state, lab)).toBeLessThanOrEqual(0.5);
  });
});

describe('jailbreak outcomes', () => {
  it('terminal events end the game unless corrigibility saves it', () => {
    let terminals = 0;
    let saves = 0;
    for (let seed = 0; seed < 400; seed++) {
      const state = newGame('helios', seed);
      const lab = state.labs.helios;
      const m = flagship(lab)!;
      m.capability = 90;
      m.robustness = 0; // force high chance
      lab.research.completed.push('corrigibility');
      const out = jailbreakTick(state, lab, makeRng(seed * 7 + 1));
      if (!out) continue;
      expect(out.severity).toBe('terminal');
      if (out.terminal) terminals++;
      if (out.saved) saves++;
    }
    expect(saves).toBeGreaterThan(0);
    expect(terminals).toBeGreaterThan(0);
    // save rate should be in the ballpark of CORRIGIBILITY_SAVE
    const rate = saves / (saves + terminals);
    expect(rate).toBeGreaterThan(BAL.CORRIGIBILITY_SAVE - 0.2);
    expect(rate).toBeLessThan(BAL.CORRIGIBILITY_SAVE + 0.2);
  });

  it('grey goo cannot fire without APM researched', () => {
    for (let seed = 0; seed < 300; seed++) {
      const state = newGame('helios', seed);
      const lab = state.labs.helios;
      const m = flagship(lab)!;
      m.capability = 90;
      m.robustness = 0;
      const out = jailbreakTick(state, lab, makeRng(seed));
      if (out) expect(out.name).not.toBe('Grey Goo');
    }
  });

  it('universal vaccines counter an Engineered Pathogen', () => {
    for (let seed = 0; seed < 4000; seed++) {
      const state = newGame('helios', seed);
      state.world.adoption = 70; // busy world, lots of probing
      const lab = state.labs.helios;
      const m = flagship(lab)!;
      m.capability = 60; // "severe" bucket
      m.robustness = 0;
      lab.research.completed.push('universal-vaccines');
      const trustBefore = lab.publicTrust;
      const out = jailbreakTick(state, lab, makeRng(seed));
      if (out?.name === 'Engineered Pathogen') {
        expect(out.countered).toBe(true);
        expect(lab.publicTrust).toBeGreaterThan(trustBefore);
        return; // saw one, verified, done
      }
    }
    throw new Error('never rolled an Engineered Pathogen in 4000 tries');
  });

  it('universal vaccines hard-counter a terminal Engineered Pandemic', () => {
    let seen = 0;
    for (let seed = 0; seed < 4000 && seen < 3; seed++) {
      const state = newGame('helios', seed);
      const lab = state.labs.helios;
      const m = flagship(lab)!;
      m.capability = 90;
      m.robustness = 0;
      lab.research.completed.push('whole-cell-sim', 'universal-vaccines');
      const out = jailbreakTick(state, lab, makeRng(seed));
      if (out?.name === 'Engineered Pandemic') {
        seen++;
        expect(out.terminal).toBe(false);
        expect(out.saved || out.countered).toBe(true);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('minor events only scratch trust', () => {
    for (let seed = 0; seed < 200; seed++) {
      const state = newGame('helios', seed);
      const lab = state.labs.helios;
      const m = flagship(lab)!;
      m.capability = 20;
      m.robustness = 0;
      const before = lab.publicTrust;
      const out = jailbreakTick(state, lab, makeRng(seed));
      if (out) {
        expect(out.severity).toBe('minor');
        expect(before - lab.publicTrust).toBeLessThanOrEqual(5);
      }
    }
  });
});
