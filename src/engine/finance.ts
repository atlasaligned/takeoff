import { BAL, clamp, clamp01 } from './balance';
import { flagship } from './model';
import { labMods } from './research';
import type { GameState, Lab } from './types';

/** Seats each serving lab would attract this week (demand, before capacity). */
export function licenseDemand(state: GameState): Record<string, number> {
  const totalSeats = state.world.adoption * state.world.adoption * BAL.SEATS_PER_ADOPTION2;
  const labs = Object.values(state.labs).filter((l) => l.alive);
  const weights: Record<string, number> = {};
  let sum = 0;
  for (const lab of labs) {
    const m = flagship(lab);
    const cap = m ? m.capability : 0;
    const price = Math.max(1, lab.licensePrice);
    let w = Math.exp(cap / BAL.CAP_DEMAND_SCALE) * Math.pow(BAL.REF_PRICE / price, BAL.PRICE_ELASTICITY);
    if (lab.country === 'prc') w *= BAL.PRC_DEMAND_MULT; // mostly-domestic market
    weights[lab.id] = w;
    sum += w;
  }
  const out: Record<string, number> = {};
  for (const lab of labs) out[lab.id] = sum > 0 ? (totalSeats * weights[lab.id]) / sum : 0;
  return out;
}

/** Seats one allocated inference chip serves for this lab (grows with flagship capability). */
export function seatsPerChip(lab: Lab): number {
  const mods = labMods(lab);
  const cap = flagship(lab)?.capability ?? 0;
  const capMult = 1 + Math.max(0, cap - 20) * BAL.SEATS_PER_CHIP_CAP_SCALE;
  return lab.chipEfficiency * BAL.SEATS_PER_CHIP * capMult * mods.inferenceSeatsMult;
}

export function serveCapacity(lab: Lab): number {
  return lab.alloc.inference * seatsPerChip(lab);
}

/** License revenue ($M/wk) for a number of served seats. */
export function licenseRevenueForSeats(lab: Lab, seats: number): number {
  const mods = labMods(lab);
  // price is $/seat/month → /4.33 weeks; revenue in $M
  return (seats * lab.licensePrice * mods.revenueMult) / 4.33 / 1e6;
}

export interface WeeklyPnl {
  licenseRevenue: number;
  contractRevenue: number;
  payroll: number;
  computeOpex: number;
  lawsuits: number;
  /** embedded govt oversight: compliance burn as a fraction of revenue */
  oversight: number;
  revenue: number;
  costs: number;
  net: number;
  licensesServed: number;
}

export function weeklyPnl(_state: GameState, lab: Lab, demand: Record<string, number>): WeeklyPnl {
  const mods = labMods(lab);
  const served = Math.min(demand[lab.id] ?? 0, serveCapacity(lab));
  const licenseRevenue = licenseRevenueForSeats(lab, served);
  const contractRevenue = lab.contracts.reduce((s, c) => s + c.weeklyPay, 0);

  const namedPay = Object.values(lab.csuite).reduce((s, e) => s + (e?.salary ?? 0), 0) + lab.stars.reduce((s, r) => s + r.salary, 0);
  const basePayroll = BAL.BASE_PAYROLL * (lab.country === 'prc' ? BAL.PRC_PAYROLL_MULT : 1);
  const payroll = (basePayroll + (lab.chips / 10000) * BAL.PAYROLL_PER_10K_CHIPS + namedPay) * mods.burnMult;

  const computeOpex = lab.chips * BAL.CHIP_OPEX * mods.burnMult * mods.chipUpkeepMult;

  const lawsuits = lab.lawsuits.reduce((s, l) => s + l.weeklyCost, 0);

  const revenue = licenseRevenue + contractRevenue;
  const oversight = revenue * lab.oversightCut;
  const costs = payroll + computeOpex + lawsuits + oversight;
  return { licenseRevenue, contractRevenue, payroll, computeOpex, lawsuits, oversight, revenue, costs, net: revenue - costs, licensesServed: served };
}

/** "Fair" valuation the market drifts toward. */
export function fairValuation(lab: Lab): number {
  const m = flagship(lab);
  const cap = m ? m.capability : 0;
  const annual = Math.max(0, lab.weeklyRevenue) * 52;
  // hype multiple compresses toward the floor as revenue reaches real-company scale
  const multiple = BAL.REV_MULTIPLE_FLOOR + (BAL.REV_MULTIPLE - BAL.REV_MULTIPLE_FLOOR) * Math.exp(-annual / BAL.REV_MULTIPLE_COMPRESS);
  const capPart = BAL.CAP_PREMIUM * Math.exp(cap / BAL.CAP_PREMIUM_SCALE);
  const trustMult = 0.7 + (lab.publicTrust + lab.govTrust) / 350;
  return (annual * multiple + capPart) * trustMult;
}

/**
 * How hard investors lean on you: 0 while your stake is comfortable, ramping
 * to 1 as it falls toward STAKE_FLOOR. Scales revenue-target strictness,
 * miss penalties and board-demand event frequency.
 */
export function investorPressure(lab: Lab): number {
  return clamp01((BAL.STAKE_COMFORT - lab.stake) / (BAL.STAKE_COMFORT - BAL.STAKE_FLOOR));
}

/** Stake fraction lost if this raise happens now (amount / post-money). */
export function dilutionOf(lab: Lab, amount: number): number {
  return amount / Math.max(1, lab.valuation + amount);
}

export function runwayWeeks(lab: Lab): number {
  const burn = lab.weeklyCosts - lab.weeklyRevenue;
  if (burn <= 0) return Infinity;
  return Math.max(0, lab.cash) / burn;
}

export interface RaiseTerms {
  amount: number;
  kind: 'small' | 'large' | 'emergency';
  /** for small rounds */
  expectation?: { target: number; deadlineWeek: number };
  /** for large rounds */
  seatCost?: number;
  valuationHit?: number;
}

/**
 * Investors who already own most of the company write smaller checks. Ramps
 * from RAISE_STAKE_MIN at STAKE_FLOOR to 1 at STAKE_COMFORT — so serially
 * diluted founders raise steadily less per round.
 */
export function raiseStakeMult(lab: Lab): number {
  const t = clamp01((lab.stake - BAL.STAKE_FLOOR) / (BAL.STAKE_COMFORT - BAL.STAKE_FLOOR));
  return BAL.RAISE_STAKE_MIN + (1 - BAL.RAISE_STAKE_MIN) * t;
}

export function raiseTerms(state: GameState, lab: Lab, kind: 'small' | 'large' | 'emergency'): RaiseTerms {
  const mods = labMods(lab);
  const stakeMult = raiseStakeMult(lab);
  if (kind === 'large') {
    return { kind, amount: lab.valuation * BAL.LARGE_RAISE_FRAC * mods.raiseMult * stakeMult, seatCost: 1 };
  }
  if (kind === 'emergency') {
    return { kind, amount: lab.valuation * BAL.EMERGENCY_RAISE_FRAC, seatCost: 1, valuationHit: BAL.EMERGENCY_VALUATION_HIT };
  }
  // diluted founders face pushier investors: the target multiplier grows with pressure
  const expectMult = BAL.SMALL_RAISE_EXPECT_MULT + investorPressure(lab) * BAL.EXPECT_MULT_PRESSURE;
  const target = Math.max(lab.weeklyRevenue * expectMult, lab.weeklyRevenue + BAL.SMALL_RAISE_EXPECT_MIN_STEP);
  return {
    kind,
    amount: lab.valuation * BAL.SMALL_RAISE_FRAC * mods.raiseMult * stakeMult,
    expectation: { target, deadlineWeek: state.week + BAL.SMALL_RAISE_EXPECT_WEEKS },
  };
}

export function applyRaise(state: GameState, lab: Lab, terms: RaiseTerms): void {
  lab.cash += terms.amount;
  lab.fundraiseCooldownUntil = state.week + BAL.RAISE_COOLDOWN;
  if (terms.kind === 'small' && terms.expectation) {
    lab.revenueExpectation = { ...terms.expectation };
  }
  if (terms.seatCost && lab.boardYours > 0) {
    lab.boardYours -= terms.seatCost;
    lab.boardInvestors += terms.seatCost;
  }
  if (terms.valuationHit) {
    lab.valuation *= 1 - terms.valuationHit;
    lab.discontent = clamp(lab.discontent + BAL.EMERGENCY_DISCONTENT, 0, 100);
  }
  // dilution at post-money — emergency rounds price off the crushed valuation
  lab.stake *= 1 - dilutionOf(lab, terms.amount);
}

/** Largest single order the fabs will quote you — grows with your existing footprint. */
export function maxChipOrder(lab: Lab): number {
  return Math.max(BAL.MAX_CHIP_ORDER, lab.chips);
}

export function chipPriceFor(state: GameState, lab: Lab): number {
  const mods = labMods(lab);
  let price = state.world.chipPrice;
  if (lab.country === 'prc') price *= BAL.PRC_CHIP_PRICE_MULT;
  return price * mods.chipCostMult;
}

export function chipDeliveryFor(state: GameState, lab: Lab): number {
  const mods = labMods(lab);
  if (mods.chipDeliveryOverride !== null) return mods.chipDeliveryOverride;
  let weeks = state.world.chipDeliveryWeeks;
  if (lab.country === 'prc') weeks += BAL.PRC_CHIP_DELIVERY_EXTRA;
  return Math.round(weeks);
}
