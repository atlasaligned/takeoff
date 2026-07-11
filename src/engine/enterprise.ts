import { BAL, clamp } from './balance';
import { pushFeed } from './feed';
import { flagship, rebalanceAllocations } from './model';
import { chance, pick, randRange } from './rng';
import type { EnterpriseLead, GameState, Lab } from './types';

/**
 * Enterprise sales: leads land every week or two; pursuing one costs cash up
 * front and, on success, locks chips into a fixed-duration contract paying
 * weekly. Deal sizes are flat $M by design — the stream matters early, when
 * survival is about revenue, and fades as licenses scale with adoption.
 */

const CUSTOMERS = [
  'Meridian Health', 'CedarBank', 'Northstar Retail Group', 'Kessler Automotive', 'BluePeak Insurance',
  'Draywick Energy', 'Summit Aerospace', 'Pantheon Media', 'Ironline Freight', 'Clearwater Pharma',
  'Atlas Telecom', 'Halewood & Marsh LLP', 'Orbital Foods', 'Vantor Logistics', 'Copperfield Hotels',
  'Stratus Mining', 'Rowan & Pike Consulting', 'Lakeshore Grid', 'Fairbanks Capital', 'Osprey Shipping',
];

/** True conversion probability for a lead — what the player sees is what rolls. */
function leadOdds(state: GameState, lab: Lab): number {
  const cap = flagship(lab)?.capability ?? 0;
  const base = randRange(state.rng, BAL.ENT_ODDS_MIN, BAL.ENT_ODDS_MAX);
  return clamp(base + Math.max(0, cap - 10) * BAL.ENT_ODDS_PER_CAP, BAL.ENT_ODDS_MIN, BAL.ENT_ODDS_CAP);
}

function makeLead(state: GameState, lab: Lab): EnterpriseLead {
  const fineTune = chance(state.rng, BAL.ENT_FT_FRAC);
  const scale = lab.country === 'prc' ? BAL.ENT_PRC_MULT : 1;
  const cashCost = randRange(state.rng, BAL.ENT_CASH_MIN, BAL.ENT_CASH_MAX) * scale * (fineTune ? BAL.ENT_FT_CASH_MULT : 1);
  const chips = Math.round(randRange(state.rng, BAL.ENT_CHIPS_MIN, BAL.ENT_CHIPS_MAX) * (fineTune ? BAL.ENT_FT_CHIPS_MULT : 1) / 50) * 50;
  const weeklyPay = randRange(state.rng, BAL.ENT_PAY_MIN, BAL.ENT_PAY_MAX) * scale * (fineTune ? BAL.ENT_FT_PAY_MULT : 1);
  const durationWeeks = Math.round(randRange(state.rng, BAL.ENT_WEEKS_MIN, BAL.ENT_WEEKS_MAX) * (fineTune ? BAL.ENT_FT_WEEKS_MULT : 1));
  return {
    id: `lead-${lab.id}-${lab.leadCounter++}`,
    name: pick(state.rng, CUSTOMERS),
    fineTune,
    cashCost: Math.round(cashCost),
    chips,
    odds: leadOdds(state, lab),
    weeklyPay: Math.round(weeklyPay * 10) / 10,
    durationWeeks,
    expiresWeek: state.week + BAL.ENT_LEAD_EXPIRY,
  };
}

/** Weekly enterprise pass for one lab: expire leads, end contracts, spawn a lead. */
export function enterpriseTick(state: GameState, lab: Lab): void {
  const isPlayer = lab.id === state.playerLab;

  const before = lab.leads.length;
  lab.leads = lab.leads.filter((l) => l.expiresWeek > state.week);
  if (isPlayer && lab.leads.length < before) {
    pushFeed(state, 'ticker', 'Enterprise lead expired', 'A customer stopped waiting and signed elsewhere.', { tag: 'MARKET' });
  }

  for (const c of [...lab.enterprise]) {
    if (c.endsWeek <= state.week) {
      lab.enterprise = lab.enterprise.filter((x) => x !== c);
      if (isPlayer) {
        pushFeed(state, 'info', `Enterprise contract ended — ${c.name}`, `The $${c.weeklyPay.toFixed(1)}M/wk deal ran its course. ${c.chips.toLocaleString()} chips return to the pool.`, { goto: 'finance' });
      }
    }
  }
  rebalanceAllocations(lab); // released chips land on inference

  const bandwidth = lab.enterprise.length < BAL.ENT_MAX_ACTIVE; // the sales team is at capacity
  if (flagship(lab) && bandwidth && lab.leads.length < BAL.ENT_MAX_LEADS && chance(state.rng, BAL.ENT_LEAD_CHANCE)) {
    const lead = makeLead(state, lab);
    lab.leads.push(lead);
    if (isPlayer) {
      pushFeed(
        state,
        'info',
        `Enterprise lead — ${lead.name}`,
        `${lead.fineTune ? 'Wants a fine-tuned model. ' : ''}$${lead.weeklyPay.toFixed(1)}M/wk for ${lead.durationWeeks} weeks at ${(lead.odds * 100).toFixed(0)}% odds. Costs $${lead.cashCost}M and ${lead.chips.toLocaleString()} chips to land. Expires W${lead.expiresWeek}.`,
        { goto: 'finance' },
      );
    }
  }
}

/** Simple expected value of a lead, for AI decisions and the advisor. */
export function leadValue(lead: EnterpriseLead): number {
  return lead.odds * lead.weeklyPay * lead.durationWeeks - lead.cashCost;
}
