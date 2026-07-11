import { BAL, clamp, clamp100 } from './balance';
import { flagship } from './model';
import type { GameState, GovId, GovQuadrant, Government, Lab } from './types';

export function quadrant(gov: Government): GovQuadrant {
  const risk = gov.riskFear >= BAL.FEAR_MID;
  const race = gov.raceFear >= BAL.FEAR_MID;
  if (risk && race) return 'nervous';
  if (risk) return 'regulating';
  if (race) return 'accelerating';
  return 'asleep';
}

export function frontierCap(state: GameState): number {
  let max = 0;
  for (const lab of Object.values(state.labs)) {
    if (!lab.alive) continue;
    const m = flagship(lab);
    if (m && m.capability > max) max = m.capability;
  }
  return max;
}

export function countryFrontier(state: GameState, country: GovId): number {
  let max = 0;
  for (const lab of Object.values(state.labs)) {
    if (!lab.alive || lab.country !== country) continue;
    const m = flagship(lab);
    if (m && m.capability > max) max = m.capability;
  }
  return max;
}

/** Weekly world updates: adoption, chip market, algorithmic progress. */
export function worldTick(state: GameState): void {
  const w = state.world;
  const frontier = frontierCap(state);
  w.adoption = clamp100(w.adoption + BAL.ADOPTION_BASE_GROWTH + Math.max(0, frontier - 20) * BAL.ADOPTION_PER_FRONTIER);
  w.backlog = Math.max(0, w.backlog * (1 - BAL.BACKLOG_DECAY));
  w.chipPrice = BAL.CHIP_PRICE_BASE * (1 + w.backlog / BAL.BACKLOG_SOFT);
  w.chipDeliveryWeeks = BAL.CHIP_DELIVERY_BASE + w.backlog * BAL.DELIVERY_PER_BACKLOG;
  w.algoProgress *= BAL.ALGO_PROGRESS_PER_WEEK;
}

/** Weekly government fear updates. */
export function govTick(state: GameState): void {
  const frontier = frontierCap(state);
  for (const gov of Object.values(state.govs)) {
    // risk fear creeps up as the frontier advances, and decays otherwise — so
    // sustaining it near the Pause gate requires a genuinely advancing frontier
    if (frontier > 40) gov.riskFear += (frontier - 40) * BAL.RISK_FEAR_PER_CAP;
    gov.riskFear -= BAL.RISK_FEAR_DECAY;
    // race fear tracks how far the rival country is ahead
    const rival: GovId = gov.id === 'us' ? 'prc' : 'us';
    const lead = countryFrontier(state, rival) - countryFrontier(state, gov.id);
    if (lead > 0) gov.raceFear += lead * BAL.RACE_FEAR_PER_LEAD;
    else gov.raceFear -= BAL.RACE_FEAR_DECAY;
    gov.riskFear = clamp(gov.riskFear, BAL.FEAR_FLOOR, 100);
    gov.raceFear = clamp(gov.raceFear, BAL.FEAR_FLOOR, 100);
  }
}

/** Weekly trust drift toward the neutral point + regulation drag update. */
export function trustTick(state: GameState, lab: Lab): void {
  // recovery from below the target runs faster than decay from above
  const drift = (x: number, mult = 1) => x + (BAL.TRUST_DRIFT_TARGET - x) * (x < BAL.TRUST_DRIFT_TARGET ? BAL.TRUST_DRIFT_RATE_UP : BAL.TRUST_DRIFT_RATE) * mult;
  const modsDecay = lab.publicTrust > BAL.TRUST_DRIFT_TARGET ? 1 : 0; // comms only slows decay, not gains
  // comms chief slows the downward drift
  const comms = lab.csuite.comms;
  const commsMult = modsDecay && comms ? 1 - comms.commsBonus / 100 : 1;
  lab.publicTrust = clamp100(drift(lab.publicTrust, commsMult));
  lab.govTrust = clamp100(drift(lab.govTrust));

  const gov = state.govs[lab.country];
  const q = quadrant(gov);
  const target = q === 'regulating' ? 0.15 : q === 'nervous' ? 0.3 : 0;
  // drag moves gradually so entering/leaving a quadrant isn't a cliff
  lab.regulationDrag += (target - lab.regulationDrag) * 0.2;
  if (lab.regulationDrag < 0.005) lab.regulationDrag = 0;
}
