import { BAL } from './balance';
import { licenseDemand, maxChipOrder, runwayWeeks, seatsPerChip } from './finance';
import { committedChips, flagship, flopForCapability, postTrainCost, predictCapability, trainCost } from './model';
import { makeExec } from './people';
import { labMods, RESEARCH, researchBlocked } from './research';
import { fundraise, orderChips, promoteModel, setAlignmentCompute, startPostTraining, startResearch, startTrainingRun } from './actions';
import { chance } from './rng';
import type { CSuiteRole, GameState, Lab } from './types';

/**
 * Weekly decision pass for an AI-controlled lab. Uses the exact same action
 * functions as the player so the simulation is symmetric.
 */
export function rivalAct(state: GameState, lab: Lab): void {
  if (!lab.alive) return;
  const profile = lab.profile;
  const m = flagship(lab);

  // 0. promote the best vault model
  let best = m;
  for (const model of lab.models) {
    if (!best || model.capability > best.capability) best = model;
  }
  if (best && best.id !== lab.flagshipId) promoteModel(lab, best.id);

  // 1. money: raise when the runway gets short
  const runway = runwayWeeks(lab);
  if (lab.cash < 0) {
    fundraise(state, lab, 'emergency');
  } else if (runway < BAL.AI_RUNWAY_RAISE_AT && state.week >= lab.fundraiseCooldownUntil) {
    // prefer small rounds; go large only with a comfortable seat cushion
    fundraise(state, lab, lab.boardYours >= 6 && chance(state.rng, 0.4) ? 'large' : 'small');
  } else if (!lab.run && state.week >= lab.fundraiseCooldownUntil) {
    // raise to fund the next frontier run — but only if the run is actually reachable
    const plan = planRun(state, lab);
    if (lab.cash < plan.cost * 1.4 && plan.cost < lab.valuation * 0.25) fundraise(state, lab, 'small');
  }

  // 2. allocation
  allocate(state, lab);

  // 3. training runs
  if (!lab.run) maybeStartRun(state, lab);
  // 3b. post-training runs on its own chip commitment, even alongside a run
  if (!lab.postTraining && lab.cash > postTrainCost(lab) * 4) {
    startPostTraining(lab);
  }

  // 4. research: keep up to 2 nodes running
  if (lab.research.active.length < 2) {
    const wish = researchWishlist(state, lab);
    for (const nodeId of wish) {
      const node = RESEARCH.find((n) => n.id === nodeId);
      if (!node) continue;
      if (lab.cash < node.cost * 1.3) continue; // keep a buffer
      if (researchBlocked(lab, nodeId, flagship(lab)?.capability ?? 0) === null) {
        startResearch(state, lab, nodeId);
        break;
      }
    }
  }

  // 5. chips: grow toward a fleet the business can actually power
  const burn = Math.max(1, lab.weeklyCosts - lab.weeklyRevenue);
  const incoming = lab.chipOrders.reduce((s, o) => s + o.chips, 0);
  const targetFleet = Math.max(8_000, demandChips(state, lab) * (1.3 + profile.aggression * 0.7), Math.floor(lab.chips * (1 + profile.aggression * 0.12)));
  if (lab.chips + incoming < targetFleet && lab.cash > Math.max(1500, burn * 45) && chance(state.rng, 0.25)) {
    const budget = lab.cash * (0.12 + profile.aggression * 0.12);
    const price = state.world.chipPrice * (lab.country === 'prc' ? BAL.PRC_CHIP_PRICE_MULT : 1);
    const count = Math.min(maxChipOrder(lab), targetFleet - lab.chips - incoming, Math.floor(budget / price / 1000) * 1000);
    if (count >= 2000) orderChips(state, lab, count);
  }

  // 6. price: hug the reference, undercut when trailing
  const frontier = Math.max(...Object.values(state.labs).filter((l) => l.alive).map((l) => flagship(l)?.capability ?? 0));
  const myCap = flagship(lab)?.capability ?? 0;
  const gap = frontier - myCap;
  const target = BAL.REF_PRICE * (1 + (profile.commerce - 0.5) * 0.3 - Math.min(0.4, gap * 0.02));
  lab.licensePrice = Math.max(4, Math.round(lab.licensePrice + (target - lab.licensePrice) * 0.3));

  // 7. fill empty C-suite slots now and then
  const roles: CSuiteRole[] = ['cto', 'cfo', 'research', 'alignment', 'comms'];
  const empty = roles.filter((r) => !lab.csuite[r]);
  if (empty.length && lab.cash > 5000 && chance(state.rng, 0.12)) {
    const role = empty[0];
    lab.csuite[role] = makeExec(state.rng, role, 0.4 + profile.safety * 0.2 + profile.aggression * 0.2);
  }
}

function allocate(_state: GameState, lab: Lab): void {
  const m = flagship(lab);
  const profile = lab.profile;

  // safety share rises when the model is strong and misaligned-ish
  let safetyShare = 0.05 + profile.safety * 0.15;
  if (m && m.capability > 60) safetyShare += profile.safety * 0.2;
  if (m && m.capability > 80) safetyShare += 0.1;
  // even reckless labs get some fear of god close to the threshold
  if (m && m.capability > 80 && m.alignment < 65) safetyShare += 0.1;

  // alignment gets its share of splittable compute; inference takes the rest
  const free = Math.max(0, lab.chips - committedChips(lab));
  setAlignmentCompute(lab, Math.floor(free * safetyShare));
}

/** Plan the next run: chips to commit and FLOP that would push the flagship ahead. */
export function planRun(state: GameState, lab: Lab): { flop: number; cost: number; chips: number } {
  const profile = lab.profile;
  const mods = labMods(lab);
  const myCap = flagship(lab)?.capability ?? 0;
  const uncommitted = Math.max(0, lab.chips - committedChips(lab));
  const trainChips = Math.floor(uncommitted * (BAL.AI_TRAIN_COMMIT_BASE + profile.aggression * BAL.AI_TRAIN_COMMIT_AGGR));
  if (trainChips < 1000) return { flop: 0, cost: 0, chips: 0 };
  const targetCap = myCap + 3 + profile.aggression * 5;
  const rawNeeded = flopForCapability(targetCap / mods.capRunBonusMult) / (mods.effFlopMult * state.world.algoProgress);
  const flopPerWeek = trainChips * lab.chipEfficiency * BAL.FLOP_PER_CHIP_WEEK * mods.trainSpeedMult;
  const maxDuration = 30 + profile.aggression * 22;
  const flop = Math.min(rawNeeded, flopPerWeek * maxDuration);
  return { flop, cost: trainCost(lab, flop), chips: trainChips };
}

/** How many chips this lab can currently sell inference on. */
export function demandChips(state: GameState, lab: Lab): number {
  const demand = licenseDemand(state)[lab.id] ?? 0;
  const spc = seatsPerChip(lab);
  return spc > 0 ? Math.ceil(demand / spc) : 0;
}

function maybeStartRun(state: GameState, lab: Lab): void {
  const profile = lab.profile;
  const myCap = flagship(lab)?.capability ?? 0;
  // don't chain runs back to back forever; breathe occasionally
  if (!chance(state.rng, 0.3 + profile.aggression * 0.4)) return;

  const plan = planRun(state, lab);
  if (plan.flop <= 0) return;
  let flop = plan.flop;
  const runBurn = lab.weeklyCosts - lab.weeklyRevenue;
  const budget = Math.min(lab.cash * BAL.AI_TRAIN_CASH_FRAC, lab.cash - Math.max(0, runBurn) * 12);
  if (budget <= 0) return;
  if (plan.cost > budget) flop *= budget / plan.cost;
  // a run must be worth the money: meaningfully above the current flagship
  if (predictCapability(lab, flop, state.world.algoProgress) < myCap + 1.2) return;
  startTrainingRun(state, lab, flop, plan.chips);
}

/** Ordered research preferences derived from the lab's personality. */
export function researchWishlist(state: GameState, lab: Lab): string[] {
  const profile = lab.profile;
  const gov = state.govs[lab.country];
  const branchWeight: Record<string, number> = {
    capabilities: 1.0 + profile.aggression * 0.9,
    alignment: 0.4 + profile.safety * 1.2,
    bio: 0.45 + profile.commerce * 1.0,
    compute: 0.5 + profile.commerce * 0.5 + profile.aggression * 0.3,
    warfare: (lab.govTrust > 50 ? 0.25 : 0) + profile.aggression * 0.5 + gov.raceFear / 250,
  };
  return RESEARCH.filter((n) => !lab.research.completed.includes(n.id) && !lab.research.active.some((a) => a.nodeId === n.id))
    // labs without a safety culture never take deep alignment work seriously —
    // this is what makes a reckless frontier lab crossing 100 a world-ending event
    .filter((n) => !(n.branch === 'alignment' && n.tier >= 3 && profile.safety < 0.45))
    // the warfare endgame gambles (Strategic Monopoly, First-Strike) are player-only —
    // no rival is reckless enough to build a doomsday first-strike and roll for WWIII
    .filter((n) => !(n.branch === 'warfare' && n.tier >= 4))
    .map((n) => ({ id: n.id, score: branchWeight[n.branch] / n.tier }))
    .sort((a, b) => b.score - a.score)
    .map((n) => n.id);
}
