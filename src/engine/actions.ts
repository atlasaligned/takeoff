import { BAL } from './balance';
import { applyRaise, chipDeliveryFor, chipPriceFor, maxChipOrder, raiseTerms } from './finance';
import { committedChips, flagship, postTrainCost, predictCapability, rebalanceAllocations, trainCost, finishTrainingRun } from './model';
import { attemptPoach } from './people';
import { RESEARCH_BY_ID, researchBlocked, researchCost, researchWeeks } from './research';
import { agreementProbability, applySmallAction, applyTreaty, smallActionReady, treatyBlocked, TREATY_BY_ID } from './diplomacy';
import { resolveEvent } from './events';
import { chance, pick } from './rng';
import type { GameState, GovId, Lab, LabId } from './types';
import { pushFeed } from './feed';

export interface ActionResult {
  ok: boolean;
  msg: string;
}

const ok = (msg = ''): ActionResult => ({ ok: true, msg });
const err = (msg: string): ActionResult => ({ ok: false, msg });

const RUN_CODENAMES = ['SUNRISE', 'MERIDIAN', 'BASILISK', 'LIGHTHOUSE', 'ORRERY', 'PERIHELION', 'CASCADE', 'MONOLITH', 'AURORA', 'SINGULAR', 'EVEREST', 'HALCYON', 'ZENITH', 'PARALLAX', 'ECLIPSE', 'REDWOOD'];

/** Set the alignment share of free compute; inference absorbs the rest. */
export function setAlignmentCompute(lab: Lab, alignment: number): ActionResult {
  lab.alloc.alignment = Math.max(0, Math.floor(alignment));
  rebalanceAllocations(lab);
  return ok();
}

export function startTrainingRun(state: GameState, lab: Lab, targetFlop: number, chips: number): ActionResult {
  if (lab.run) return err('a training run is already active');
  if (targetFlop <= 0) return err('invalid run size');
  chips = Math.floor(chips);
  if (chips <= 0) return err('commit at least some chips');
  if (chips > lab.chips - committedChips(lab)) return err('not enough free chips');
  const cost = trainCost(lab, targetFlop);
  const upfront = cost * BAL.TRAIN_UPFRONT_FRAC;
  if (lab.cash < upfront) return err('not enough cash for the up-front payment');
  lab.cash -= upfront;
  const modelNumber = lab.modelCounter + 1;
  lab.run = {
    id: `run-${lab.id}-${state.week}`,
    codename: pick(state.rng, RUN_CODENAMES),
    modelName: `${lab.shortName}-${modelNumber}`,
    targetFlop,
    doneFlop: 0,
    startedWeek: state.week,
    chips,
    estCapability: predictCapability(lab, targetFlop, state.world.algoProgress),
    costTotal: cost,
    costPaid: upfront,
  };
  rebalanceAllocations(lab);
  return ok(`training run ${lab.run.codename} started`);
}

export function abortTrainingRun(state: GameState, lab: Lab): ActionResult {
  const run = lab.run;
  if (!run) return err('no active run');
  lab.run = null;
  rebalanceAllocations(lab); // freed chips flow back to inference
  if (run.doneFlop <= 0) return ok('run aborted before any compute was spent');
  const m = finishTrainingRun(lab, run, state.week, state.world.algoProgress, state.rng, true);
  lab.models.push(m);
  return ok(`run ${run.codename} aborted — salvaged ${m.name} at capability ${m.capability.toFixed(1)}`);
}

export function promoteModel(lab: Lab, modelId: string): ActionResult {
  const m = lab.models.find((x) => x.id === modelId);
  if (!m) return err('no such model');
  lab.flagshipId = m.id;
  return ok(`${m.name} promoted to flagship`);
}

export function startPostTraining(lab: Lab): ActionResult {
  if (lab.postTraining) return err('post-training already running');
  if (!flagship(lab)) return err('no flagship');
  const cost = postTrainCost(lab);
  if (lab.cash < cost) return err('not enough cash');
  if (lab.chips - committedChips(lab) < BAL.POST_TRAIN_CHIPS) return err(`needs ${BAL.POST_TRAIN_CHIPS} free chips to commit`);
  lab.cash -= cost;
  lab.postTraining = { weeksLeft: BAL.POST_TRAIN_WEEKS, totalWeeks: BAL.POST_TRAIN_WEEKS, chips: BAL.POST_TRAIN_CHIPS };
  rebalanceAllocations(lab);
  return ok('post-training started');
}

export function startResearch(_state: GameState, lab: Lab, nodeId: string): ActionResult {
  const capNow = flagship(lab)?.capability ?? 0;
  const blocked = researchBlocked(lab, nodeId, capNow);
  if (blocked) return err(blocked);
  const node = RESEARCH_BY_ID[nodeId];
  lab.cash -= researchCost(lab, node);
  lab.research.active.push({ nodeId, weeksDone: 0, totalWeeks: researchWeeks(lab, node) });
  return ok(`research started: ${node.name}`);
}

export function fundraise(state: GameState, lab: Lab, kind: 'small' | 'large' | 'emergency'): ActionResult {
  if (state.week < lab.fundraiseCooldownUntil && kind !== 'emergency') return err('investors need a breather (cooldown)');
  if (kind === 'large' && lab.boardYours <= 1) return err('no seats left to give');
  const terms = raiseTerms(state, lab, kind);
  applyRaise(state, lab, terms);
  return ok(`raised $${(terms.amount / 1000).toFixed(2)}B (${kind} round)`);
}

export function orderChips(state: GameState, lab: Lab, count: number): ActionResult {
  count = Math.floor(count);
  if (count <= 0) return err('invalid order');
  if (count > maxChipOrder(lab)) return err(`fabs quote at most ${maxChipOrder(lab).toLocaleString()} chips per order`);
  if (state.world.chipCap !== null && lab.chips + count > state.world.chipCap) return err('compute cap treaty forbids this order');
  const cost = count * chipPriceFor(state, lab);
  if (lab.cash < cost) return err('not enough cash');
  lab.cash -= cost;
  lab.chipOrders.push({ chips: count, orderedWeek: state.week, arrivesWeek: state.week + chipDeliveryFor(state, lab) });
  state.world.backlog += count; // your order strains the same fabs everyone uses
  return ok(`ordered ${count.toLocaleString()} chips for $${(cost / 1000).toFixed(2)}B`);
}

export function setLicensePrice(lab: Lab, price: number): ActionResult {
  if (price < 1 || price > 500) return err('unreasonable price');
  lab.licensePrice = price;
  return ok();
}

export function poachStar(state: GameState, lab: Lab, fromLabId: LabId, starId: string): ActionResult {
  const fromLab = state.labs[fromLabId];
  const star = fromLab.stars.find((s) => s.id === starId);
  if (!star) return err('no such researcher');
  if (lab.cash < 0) return err('not enough cash');
  const success = attemptPoach(state, lab, fromLab, star);
  return ok(success ? `${star.name} joins ${lab.name}` : `${star.name} declined — ${fromLab.name} matched the offer`);
}

export function fireStar(lab: Lab, starId: string): ActionResult {
  const star = lab.stars.find((s) => s.id === starId);
  if (!star) return err('no such researcher');
  lab.stars = lab.stars.filter((s) => s.id !== starId);
  return ok(`${star.name} let go`);
}

export function signTreaty(state: GameState, treatyId: string): ActionResult {
  const blocked = treatyBlocked(state, treatyId);
  if (blocked) return err(blocked);
  const t = TREATY_BY_ID[treatyId];
  const playerLab = state.labs[state.playerLab];
  playerLab.cash -= t.cost;
  if (t.needsAgreement) {
    const p = agreementProbability(state);
    if (!chance(state.rng, p)) {
      state.diplomacy.cooldowns[`treaty-${treatyId}`] = state.week + BAL.TREATY_FAIL_COOLDOWN;
      pushFeed(state, 'warning', `${t.name}: talks collapsed`, `The gatekeeper lab walked out (odds were ${(p * 100).toFixed(0)}%). The money is spent; talks can resume in ${BAL.TREATY_FAIL_COOLDOWN} weeks.`);
      return ok(`talks collapsed — ${t.name} not signed`);
    }
  }
  applyTreaty(state, treatyId);
  pushFeed(state, 'info', `${t.name} signed`, t.effect);
  return ok(`${t.name} in force`);
}

export function smallDiplomacy(state: GameState, actionId: string, target: GovId | null): ActionResult {
  if (!smallActionReady(state, actionId)) return err('still on cooldown');
  const playerLab = state.labs[state.playerLab];
  if (playerLab.cash < 0) return err('not enough cash');
  const msg = applySmallAction(state, actionId, target);
  pushFeed(state, 'info', 'Diplomacy', msg);
  return ok(msg);
}

/** Answer the oldest pending blocking event. */
export function respondToEvent(state: GameState, choiceId: string): ActionResult {
  const event = state.pendingEvents.shift();
  if (!event) return err('no pending event');
  const msg = resolveEvent(state, event, choiceId);
  pushFeed(state, 'info', event.title, msg);
  return ok(msg);
}
