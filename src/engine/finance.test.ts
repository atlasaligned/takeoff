import { describe, expect, it } from 'vitest';
import { applyRaise, fairValuation, licenseDemand, raiseTerms, runwayWeeks, seatsPerChip, weeklyPnl } from './finance';
import { flagship } from './model';
import { newGame } from './init';

describe('license demand', () => {
  it('gives more demand to more capable labs', () => {
    const state = newGame('helios', 1);
    flagship(state.labs.helios)!.capability = 40;
    flagship(state.labs.axiom)!.capability = 25;
    const d = licenseDemand(state);
    expect(d.helios).toBeGreaterThan(d.axiom);
  });

  it('punishes higher prices', () => {
    const state = newGame('helios', 1);
    const before = licenseDemand(state).helios;
    state.labs.helios.licensePrice = 60;
    const after = licenseDemand(state).helios;
    expect(after).toBeLessThan(before);
  });

  it('total demand grows with adoption', () => {
    const state = newGame('helios', 1);
    const d1 = Object.values(licenseDemand(state)).reduce((a, b) => a + b, 0);
    state.world.adoption = 60;
    const d2 = Object.values(licenseDemand(state)).reduce((a, b) => a + b, 0);
    expect(d2).toBeGreaterThan(d1 * 5);
  });

  it('dead labs get no demand', () => {
    const state = newGame('helios', 1);
    state.labs.axiom.alive = false;
    const d = licenseDemand(state);
    expect(d.axiom).toBeUndefined();
  });
});

describe('pricing has a revenue hump', () => {
  it('raising the price beyond the sweet spot lowers revenue', () => {
    const state = newGame('helios', 1);
    state.world.adoption = 50;
    state.labs.helios.chips = 1_000_000;
    state.labs.helios.alloc.inference = 1_000_000; // no capacity limit
    const revAt = (price: number) => {
      state.labs.helios.licensePrice = price;
      const d = licenseDemand(state);
      return weeklyPnl(state, state.labs.helios, d).licenseRevenue;
    };
    // elasticity > 1 → monotandically decreasing revenue in price once uncapped;
    // the "hump" comes from the capacity limit at low prices
    expect(revAt(120)).toBeLessThan(revAt(25));
  });

  it('capacity caps what you can serve', () => {
    const state = newGame('helios', 1);
    state.world.adoption = 80; // huge demand
    const lab = state.labs.helios;
    lab.alloc.inference = 100;
    const d = licenseDemand(state);
    const pnl = weeklyPnl(state, lab, d);
    expect(pnl.licensesServed).toBeLessThanOrEqual(100 * seatsPerChip(lab));
  });
});

describe('pnl', () => {
  it('net = revenue - costs and contracts pay weekly', () => {
    const state = newGame('helios', 1);
    const lab = state.labs.helios;
    lab.contracts.push({ id: 'c', name: 'DoD', weeklyPay: 20, chips: 2000, startedWeek: 0 });
    const d = licenseDemand(state);
    const pnl = weeklyPnl(state, lab, d);
    expect(pnl.contractRevenue).toBe(20);
    expect(pnl.net).toBeCloseTo(pnl.revenue - pnl.costs, 8);
  });

  it('lawsuits drain cash weekly', () => {
    const state = newGame('helios', 1);
    const lab = state.labs.helios;
    const d = licenseDemand(state);
    const before = weeklyPnl(state, lab, d).costs;
    lab.lawsuits.push({ name: 'suit', weeklyCost: 30, weeksLeft: 10 });
    const after = weeklyPnl(state, lab, d).costs;
    expect(after - before).toBeCloseTo(30, 8);
  });
});

describe('valuation & runway', () => {
  it('fair valuation grows with capability and revenue', () => {
    const state = newGame('helios', 1);
    const lab = state.labs.helios;
    const v1 = fairValuation(lab);
    flagship(lab)!.capability += 20;
    const v2 = fairValuation(lab);
    expect(v2).toBeGreaterThan(v1);
    lab.weeklyRevenue = 200;
    expect(fairValuation(lab)).toBeGreaterThan(v2);
  });

  it('runway is cash / burn, infinite when profitable', () => {
    const state = newGame('helios', 1);
    const lab = state.labs.helios;
    lab.cash = 1000;
    lab.weeklyCosts = 110;
    lab.weeklyRevenue = 10;
    expect(runwayWeeks(lab)).toBeCloseTo(10, 5);
    lab.weeklyRevenue = 200;
    expect(runwayWeeks(lab)).toBe(Infinity);
  });
});

describe('fundraising', () => {
  it('small rounds set revenue expectations, no seat lost', () => {
    const state = newGame('helios', 1);
    const lab = state.labs.helios;
    lab.weeklyRevenue = 50;
    const seats = lab.boardYours;
    const terms = raiseTerms(state, lab, 'small');
    applyRaise(state, lab, terms);
    expect(lab.boardYours).toBe(seats);
    expect(lab.revenueExpectation).not.toBeNull();
    expect(lab.revenueExpectation!.target).toBeGreaterThan(50);
  });

  it('large rounds cost a board seat and raise more', () => {
    const state = newGame('helios', 1);
    const lab = state.labs.helios;
    const seats = lab.boardYours;
    const small = raiseTerms(state, lab, 'small');
    const large = raiseTerms(state, lab, 'large');
    expect(large.amount).toBeGreaterThan(small.amount * 1.5);
    applyRaise(state, lab, large);
    expect(lab.boardYours).toBe(seats - 1);
    expect(lab.boardInvestors).toBe(3);
  });

  it('emergency raises are brutal: valuation slashed, discontent up, seat lost', () => {
    const state = newGame('helios', 1);
    const lab = state.labs.helios;
    const val = lab.valuation;
    const disc = lab.discontent;
    applyRaise(state, lab, raiseTerms(state, lab, 'emergency'));
    expect(lab.valuation).toBeLessThan(val);
    expect(lab.discontent).toBeGreaterThan(disc);
    expect(lab.boardYours).toBe(6);
  });
});
