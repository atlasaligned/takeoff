import { BAL, clamp } from './balance';
import { labMods } from './research';
import { pick, randInt, randRange, type RngState, chance } from './rng';
import type { CSuiteRole, Executive, GameState, Lab, Star, StarField } from './types';

const FIRST = ['Mara', 'Devraj', 'Elena', 'Tomás', 'Grace', 'Kenji', 'Rana', 'Sofia', 'Wei', 'Priya', 'Liu', 'Adaeze', 'Jonas', 'Ingrid', 'Marcus', 'Yuki', 'Omar', 'Clara', 'Felix', 'Nadia', 'Viktor', 'Amara', 'Diego', 'Hana', 'Lars', 'Mei', 'Ravi', 'Zoe', 'Anton', 'Leila', 'Pavel', 'Chen', 'Astrid', 'Emeka', 'Silvia', 'Hugo', 'Fatima', 'Nikolai', 'Aoife', 'Jun'];
const LAST = ['Voss', 'Iyer', 'Sorokina', 'Ferreira', 'Adeyemi', 'Nakamura', 'Haddad', 'Lindqvist', 'Zhang', 'Mehta', 'Chen', 'Okafor', 'Berg', 'Fischer', 'Cole', 'Tanaka', 'Rashid', 'Moreau', 'Weber', 'Petrova', 'Novak', 'Diallo', 'Ramos', 'Sato', 'Nilsen', 'Wong', 'Krishnan', 'Marsh', 'Volkov', 'Amini', 'Sokolov', 'Wu', 'Dahl', 'Obi', 'Rossi', 'Blanc', 'Zahra', 'Orlov', "Ó Braonáin", 'Park'];

export function randomName(rng: RngState): string {
  return `${pick(rng, FIRST)} ${pick(rng, LAST)}`;
}

function baseExec(rng: RngState, role: CSuiteRole, quality: number): Executive {
  // quality 0..1 scales all stats
  const q = clamp(quality, 0, 1);
  const stat = () => Math.round(35 + q * 40 + randRange(rng, -8, 8));
  const pct = (lo: number, hi: number) => Math.round(lo + q * (hi - lo) + randRange(rng, -2, 2));
  return {
    id: `exec-${randInt(rng, 1e9)}`,
    name: randomName(rng),
    role,
    salary: Math.round((0.5 + q * 1.5) * 10) / 10,
    charisma: role === 'ceo' ? stat() : 0,
    credibility: role === 'ceo' ? stat() : 0,
    trainingSpeed: role === 'cto' ? pct(5, 18) : 0,
    capabilityBonus: role === 'cto' ? pct(1, 6) : 0,
    financeBonus: role === 'cfo' ? pct(4, 14) : 0,
    researchBonus: role === 'research' ? pct(6, 20) : 0,
    alignmentBonus: role === 'alignment' ? pct(8, 25) : 0,
    commsBonus: role === 'comms' ? pct(10, 30) : 0,
    opsBonus: role === 'coo' ? pct(4, 12) : 0,
  };
}

export function makeExec(rng: RngState, role: CSuiteRole, quality: number): Executive {
  return baseExec(rng, role, quality);
}

const STAR_FIELDS: { field: StarField; label: string; lo: number; hi: number }[] = [
  { field: 'scaling', label: 'scaling', lo: 4, hi: 10 },
  { field: 'rl', label: 'RL', lo: 5, hi: 12 },
  { field: 'interp', label: 'interpretability', lo: 6, hi: 15 },
  { field: 'robustness', label: 'robustness', lo: 3, hi: 8 },
  { field: 'alignment', label: 'alignment', lo: 6, hi: 15 },
  { field: 'agents', label: 'agents', lo: 4, hi: 10 },
];

export function starFieldLabel(field: StarField): string {
  return STAR_FIELDS.find((f) => f.field === field)?.label ?? field;
}

export function makeStar(rng: RngState, tier?: number): Star {
  const spec = pick(rng, STAR_FIELDS);
  const t = tier ?? 1 + randInt(rng, 3);
  const frac = (t - 1) / 2 + randRange(rng, 0, 0.3);
  return {
    id: `star-${randInt(rng, 1e9)}`,
    name: randomName(rng),
    field: spec.field,
    bonus: Math.round(spec.lo + (spec.hi - spec.lo) * clamp(frac, 0, 1)),
    salary: Math.round((0.3 + t * 0.5 + randRange(rng, 0, 0.3)) * 10) / 10,
    tier: t,
  };
}

/** Poaching odds: your charisma & public trust vs. target tier. */
export function poachOdds(_state: GameState, lab: Lab, target: Star): number {
  const mods = labMods(lab);
  let p = BAL.POACH_BASE_ODDS + mods.poachBonus;
  p += (lab.publicTrust - 50) * 0.002;
  p -= (target.tier - 1) * 0.08;
  return clamp(p, 0.05, 0.9);
}

/** Signing bonus to attempt a poach (paid whether or not it succeeds — lawyers).
 * Scales steeply with tier so serially stripping a rival's best researchers to
 * stall their race is a real cash sink, not a cheap sabotage loop. */
export function poachCost(target: Star): number {
  return Math.round(target.salary * 52 + target.tier * target.tier * BAL.POACH_TIER_COST);
}

export function attemptPoach(state: GameState, lab: Lab, fromLab: Lab, target: Star): boolean {
  const p = poachOdds(state, lab, target);
  lab.cash -= poachCost(target);
  // Talent-raiding a rival reads as hostile whether or not it lands — small
  // public-trust hit, so serial stripping compounds against you (odds fall too).
  lab.publicTrust = clamp(lab.publicTrust - BAL.POACH_TRUST_HIT, 0, 100);
  if (chance(state.rng, p)) {
    fromLab.stars = fromLab.stars.filter((s) => s.id !== target.id);
    target.salary = Math.round(target.salary * 1.4 * 10) / 10; // they know their worth now
    lab.stars.push(target);
    return true;
  }
  return false;
}
