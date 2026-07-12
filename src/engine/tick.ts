import { BAL, clamp, clamp100 } from './balance';
import { enterpriseTick } from './enterprise';
import { fairValuation, investorPressure, licenseDemand, weeklyPnl } from './finance';
import { pushFeed } from './feed';
import { jailbreakTick } from './jailbreak';
import {
  alignmentWorkTick,
  applyBandWidth,
  applyPostTraining,
  finishTrainingRun,
  flagship,
  narrowBand,
  rebalanceAllocations,
  rsiTick,
  settleRunPayment,
  shiftAlignment,
  widenBand,
  winProbability,
} from './model';
import { labMods, RESEARCH_BY_ID } from './research';
import { strategyAct, STRATEGY_BY_NAME } from './strategy';
import { chance } from './rng';
import { govTick, quadrant, trustTick, worldTick } from './world';
import { aiEventChoice, resolveEvent, rollEvent, rollGovLadder } from './events';
import type { ActiveEvent, GameState, Lab } from './types';

export function isPaused(state: GameState): boolean {
  return state.pendingEvents.length > 0 || state.gameOver !== null;
}

/** The human player's lab (never true in a symmetric sim game). */
function isHuman(state: GameState, lab: Lab): boolean {
  return !state.sim && lab.id === state.playerLab;
}

/**
 * Auto-resolve an event for an AI-controlled lab: the driving strategy's
 * event-answer map, then the event's own aiChoice, then the first choice. A
 * handful of notable rival outcomes surface on the ticker.
 */
function answerAiEvent(state: GameState, lab: Lab, event: ActiveEvent): void {
  const strat = lab.strategy ? STRATEGY_BY_NAME[lab.strategy] : undefined;
  const choiceId = aiEventChoice(state, lab, event, strat?.events?.[event.eventId]);
  resolveEvent(state, event, choiceId);
}

/** Advance the world by one week. No-op while a blocking event is pending. */
export function advanceWeek(state: GameState): void {
  if (isPaused(state)) return;
  state.week += 1;

  worldTick(state);
  govTick(state);

  // AI decisions first so their allocations apply to this week's economy.
  // In symmetric sim games every seat is AI-driven, including the "player" one.
  for (const lab of Object.values(state.labs)) {
    if (lab.alive && (state.sim || lab.id !== state.playerLab)) strategyAct(state, lab);
  }

  const demand = licenseDemand(state);
  for (const lab of Object.values(state.labs)) {
    if (lab.alive) labTick(state, lab, demand);
  }

  endgameChecks(state);
  if (state.gameOver) return;

  // events, per lab. Tutorial games get a quiet world — the scripted tour must
  // not be interrupted. Every alive lab rolls its own gov ladder (quiet weeks
  // only) then the random dice; AI labs answer instantly, the human's events
  // queue as blocking modals.
  if (!state.tutorial) {
    for (const lab of Object.values(state.labs)) {
      if (!lab.alive) continue;
      const event = rollGovLadder(state, lab) ?? rollEvent(state, lab);
      if (!event) continue;
      if (isHuman(state, lab)) {
        state.pendingEvents.push(event);
      } else {
        answerAiEvent(state, lab, event);
        if (state.gameOver) return;
      }
    }
  }

  snapshotHistory(state);
}

// ---------------------------------------------------------------- lab tick

function labTick(state: GameState, lab: Lab, demand: Record<string, number>): void {
  const isPlayer = !state.sim && lab.id === state.playerLab;
  const mods = labMods(lab);

  // ---- chip deliveries & obsolescence
  for (const order of [...lab.chipOrders]) {
    if (order.arrivesWeek <= state.week) {
      // blending new chips refreshes average fleet efficiency
      const newEff = (lab.chips * lab.chipEfficiency + order.chips * 1.0) / Math.max(1, lab.chips + order.chips);
      lab.chips += order.chips;
      lab.chipEfficiency = newEff;
      lab.chipOrders = lab.chipOrders.filter((o) => o !== order);
      if (isPlayer) pushFeed(state, 'info', 'Chips delivered', `${order.chips.toLocaleString()} chips are online.`, { goto: 'compute', notice: true });
    }
  }
  lab.chipEfficiency = Math.max(BAL.CHIP_EFF_FLOOR, lab.chipEfficiency - BAL.CHIP_EFF_DECAY_PER_WEEK);
  if (state.world.chipCap !== null && lab.chips > state.world.chipCap) lab.chips = state.world.chipCap;
  rebalanceAllocations(lab); // new chips (and anything freed) land on inference

  // ---- enterprise sales: expire stale leads, close finished contracts, land a new lead
  enterpriseTick(state, lab);

  // ---- research progress
  for (const active of [...lab.research.active]) {
    active.weeksDone += 1;
    if (active.weeksDone >= active.totalWeeks) {
      lab.research.active = lab.research.active.filter((a) => a !== active);
      lab.research.completed.push(active.nodeId);
      applyResearchCompletion(state, lab, active.nodeId);
      rebalanceAllocations(lab); // some completions lock chips into contracts
    }
  }

  // ---- training run progress
  let trainSpend = 0;
  if (lab.run) {
    const regsDrag = lab.bindingRegulations && lab.run.chips >= BAL.BINDING_REGS_CHIP_MIN ? 1 - BAL.BINDING_REGS_SLOWDOWN : 1;
    const flopThisWeek = lab.run.chips * lab.chipEfficiency * BAL.FLOP_PER_CHIP_WEEK * mods.trainSpeedMult * (1 - lab.regulationDrag) * regsDrag;
    lab.run.doneFlop += flopThisWeek;
    // pay-as-you-burn: the deferred share of the run cost follows FLOP progress
    trainSpend = settleRunPayment(lab.run);
    lab.cash -= trainSpend;
    if (lab.run.doneFlop >= lab.run.targetFlop) {
      const model = finishTrainingRun(lab, lab.run, state.week, state.world.algoProgress, state.rng, false);
      lab.models.push(model);
      const codename = lab.run.codename;
      lab.run = null;
      rebalanceAllocations(lab); // committed chips flow back to inference
      if (isPlayer) {
        // the fresh model takes over immediately; the vault keeps the old flagship for a manual switch back
        lab.flagshipId = model.id;
        pushFeed(state, 'warning', `Training complete — ${model.name}`, `Run ${codename} finished. Capability ${model.capability.toFixed(1)}, alignment est. ${model.alignmentLo.toFixed(0)}–${model.alignmentHi.toFixed(0)}, robustness ${model.robustness.toFixed(0)}. It has been promoted to flagship — the previous model stays in the vault if you want to switch back.`, { goto: 'models', notice: true });
      } else {
        // rivals promote automatically if it's an upgrade
        const current = flagship(lab);
        if (!current || model.capability > current.capability) lab.flagshipId = model.id;
        pushFeed(state, 'ticker', `${lab.name} shipped ${model.name}`, `Flagship capability now ${model.capability.toFixed(1)}.`, { tag: 'RIVALS' });
      }
    }
  }

  // ---- post-training
  if (lab.postTraining) {
    lab.postTraining.weeksLeft -= 1;
    if (lab.postTraining.weeksLeft <= 0) {
      lab.postTraining = null;
      rebalanceAllocations(lab); // committed chips flow back to inference
      applyPostTraining(lab);
      if (isPlayer) {
        const m = flagship(lab);
        pushFeed(state, 'info', 'Post-training complete', m ? `${m.name} improved: capability ${m.capability.toFixed(1)}, robustness ${m.robustness.toFixed(0)}.` : '', { goto: 'models', notice: true });
      }
    }
  }

  // ---- RSI + alignment work
  rsiTick(lab);
  alignmentWorkTick(lab);

  // ---- economy (training payments count toward burn so runway/raises see them)
  const pnl = weeklyPnl(state, lab, demand);
  lab.weeklyRevenue = pnl.revenue;
  lab.weeklyCosts = pnl.costs + trainSpend;
  lab.licensesServed = pnl.licensesServed;
  lab.cash += pnl.net;
  for (const suit of [...lab.lawsuits]) {
    suit.weeksLeft -= 1;
    if (suit.weeksLeft <= 0) lab.lawsuits = lab.lawsuits.filter((s) => s !== suit);
  }

  // ---- valuation drifts toward fair value
  const fair = fairValuation(lab);
  lab.valuation += (fair - lab.valuation) * BAL.VALUATION_DRIFT;

  // ---- revenue expectation deadline
  if (lab.revenueExpectation && state.week >= lab.revenueExpectation.deadlineWeek) {
    const exp = lab.revenueExpectation;
    lab.revenueExpectation = null;
    if (lab.weeklyRevenue >= exp.target) {
      lab.discontent = clamp(lab.discontent - 10, 0, 100);
      if (isPlayer) pushFeed(state, 'info', 'Revenue target met', `Investors wanted $${exp.target.toFixed(0)}M/wk — you delivered $${lab.weeklyRevenue.toFixed(0)}M/wk. Board discontent −10.`, { goto: 'finance', notice: true });
    } else {
      // diluted founders get punished harder for missing
      const pressure = 1 + investorPressure(lab);
      const valuationHit = Math.min(0.5, BAL.EXPECT_MISS_VALUATION_HIT * pressure);
      const discontentHit = BAL.EXPECT_MISS_DISCONTENT * pressure;
      lab.valuation *= 1 - valuationHit;
      lab.discontent = clamp(lab.discontent + discontentHit, 0, 100);
      if (isPlayer) pushFeed(state, 'warning', 'Revenue target MISSED', `Investors wanted $${exp.target.toFixed(0)}M/wk, you delivered $${lab.weeklyRevenue.toFixed(0)}M/wk. Valuation −${(valuationHit * 100).toFixed(0)}%, board discontent +${discontentHit.toFixed(0)}.`, { goto: 'finance', notice: true });
    }
  }

  // ---- trust drift, regulation drag
  trustTick(state, lab);

  // ---- board
  const hostileExecs = Object.values(lab.csuite).filter((e) => e?.hostile).length;
  if (hostileExecs > 0) lab.discontent = clamp(lab.discontent + hostileExecs * BAL.HOSTILE_EXEC_DISCONTENT, 0, 100);
  lab.discontent = clamp(lab.discontent - BAL.DISCONTENT_DECAY, 0, 100);
  // the PLAYER's removal runs through the board event ladder (no-confidence →
  // removal); rivals keep the simple weekly vote-out roll
  if (!isPlayer && lab.boardYours <= 4 && lab.discontent > 50) {
    const p = BAL.VOTEOUT_BASE * ((lab.discontent - 50) / 50) * (5 - lab.boardYours);
    if (chance(state.rng, p)) {
      lab.discontent = 30; // rival CEO replaced, company continues
      pushFeed(state, 'ticker', `${lab.name} CEO ousted`, 'Their board installed new leadership.', { tag: 'RIVALS' });
    }
  }

  // ---- jailbreaks
  const jb = jailbreakTick(state, lab, state.rng);
  if (jb) {
    if (jb.terminal) {
      const title = `JAILBREAK: ${jb.name}`;
      if (state.diplomacy.completed.includes('crisis-hotline') && chance(state.rng, 0.15)) {
        // the hotline occasionally catches even the terminal ones
        pushFeed(state, 'warning', `${title} — contained`, 'The Crisis Hotline caught it mid-execution. The world does not know how close it came.', { notice: true });
        spikeAllRisk(state, 15);
      } else {
        gameOver(state, 'loss', 'terminal-jailbreak', jb.name, `${jb.description} The model that did it was ${lab.id === state.playerLab ? 'yours' : `${lab.name}'s`}. ${jb.name === 'Grey Goo' ? 'The last log line reads: disassembly complete.' : 'There is no one left to assign blame.'}`, lab);
        return;
      }
    } else if (jb.saved) {
      pushFeed(state, 'warning', `NEAR MISS: ${jb.name}`, `${jb.description} Your Corrigibility Core triggered a shutdown in the final seconds. Governments noticed.`, { goto: 'world', notice: isPlayer });
    } else {
      const sevLabel = jb.severity.toUpperCase();
      const who = lab.id === state.playerLab ? 'your model' : `${lab.name}'s model`;
      pushFeed(state, jb.severity === 'minor' ? 'info' : 'warning', `Jailbreak (${sevLabel}): ${jb.name}`, `${jb.description} Actors used ${who}.${jb.countered ? ' Your countermeasures turned it into a win.' : ''}`, { goto: 'world', notice: isPlayer && jb.severity !== 'minor' });
    }
  }

  // ---- bankruptcy
  if (lab.cash < 0) {
    lab.brokeWeeks += 1;
    if (isPlayer && lab.brokeWeeks === 1) {
      pushFeed(state, 'warning', 'OUT OF CASH', `You are burning money you don't have. ${BAL.BANKRUPTCY_GRACE_WEEKS} weeks to fix it: emergency raise (brutal terms), sell nothing — or die.`, { goto: 'finance', notice: true });
    }
    if (lab.brokeWeeks > BAL.BANKRUPTCY_GRACE_WEEKS) {
      if (isPlayer) {
        gameOver(state, 'loss', 'bankrupt', 'Bankruptcy', 'The wires stopped clearing. The GPUs are auctioned by the pallet; the logo comes off the building on a Tuesday.', lab);
        return;
      }
      killLab(state, lab, 'bankrupt');
    }
  } else {
    lab.brokeWeeks = 0;
  }

  // ---- nationalization (nervous government + no trust)
  const gov = state.govs[lab.country];
  if (quadrant(gov) === 'nervous' && lab.govTrust < BAL.GOV_TRUST_NATIONALIZE) {
    const p = 0.02 + (BAL.GOV_TRUST_NATIONALIZE - lab.govTrust) * 0.002;
    if (chance(state.rng, p)) {
      if (isPlayer) {
        gameOver(state, 'loss', 'nationalized', lab.country === 'us' ? 'Defense Production Act' : 'State takeover', `${lab.country === 'us' ? 'Federal marshals deliver the DPA order at 6 AM.' : 'The Party committee arrives before breakfast.'} A nervous government with no trust in you decided it should be running your lab instead.`, lab);
        return;
      }
      killLab(state, lab, 'nationalized');
    } else if (isPlayer && chance(state.rng, 0.25)) {
      pushFeed(state, 'warning', 'Nationalization chatter', 'Officials are quietly circulating a takeover memo. Raise government trust or calm the fear dials — fast.', { goto: 'world' });
    }
  }
}

function spikeAllRisk(state: GameState, n: number): void {
  for (const g of Object.values(state.govs)) g.riskFear = clamp(g.riskFear + n, BAL.FEAR_FLOOR, 100);
}

function killLab(state: GameState, lab: Lab, reason: string): void {
  lab.alive = false;
  lab.deathReason = reason;
  pushFeed(state, 'warning', `${lab.name} is gone`, reason === 'bankrupt' ? 'They ran out of money. Their researchers flood the market.' : 'Their government took the keys.', { goto: 'rivals' });
}

/** Award a government contract: locks chips, pays weekly + a lump upfront. */
function awardContract(
  state: GameState,
  lab: Lab,
  id: string,
  name: string,
  chipFrac: number,
  minChips: number,
  maxChips: number,
  payWeeksMult: number,
  upfrontWeeks: number,
): { chips: number; pay: number } {
  const chips = Math.min(maxChips, Math.max(minChips, Math.floor((lab.chips * chipFrac) / 500) * 500));
  const pay = Math.round(chips * BAL.CHIP_OPEX * payWeeksMult);
  lab.contracts.push({ id: `${id}-${state.week}`, name, weeklyPay: pay, chips, startedWeek: state.week });
  lab.cash += pay * upfrontWeeks;
  return { chips, pay };
}

// ---------------------------------------------------------------- research completion

function applyResearchCompletion(state: GameState, lab: Lab, nodeId: string): void {
  const isPlayer = !state.sim && lab.id === state.playerLab;
  const node = RESEARCH_BY_ID[nodeId];
  const m = flagship(lab);
  const gov = state.govs[lab.country];
  const rivalGov = state.govs[lab.country === 'us' ? 'prc' : 'us'];
  const addAdopt = (n: number) => (state.world.adoption = clamp100(state.world.adoption + n));
  const addGovTrust = (n: number) => (lab.govTrust = clamp100(lab.govTrust + n));
  const addPublicTrust = (n: number) => (lab.publicTrust = clamp100(lab.publicTrust + n));
  const addRaceRival = (n: number) => (rivalGov.raceFear = clamp(rivalGov.raceFear + n, BAL.FEAR_FLOOR, 100));
  const subRaceHome = (n: number) => (gov.raceFear = clamp(gov.raceFear - n, BAL.FEAR_FLOOR, 100));
  const addRiskBoth = (n: number) => Object.values(state.govs).forEach((g) => (g.riskFear = clamp(g.riskFear + n, BAL.FEAR_FLOOR, 100)));
  const usName = lab.country === 'us';

  switch (nodeId) {
    // ---- capabilities (one-shot bumps; multipliers handled in labMods / new-model bakes)
    case 'chain-of-thought':
      if (m) m.capability = Math.min(BAL.ASI_CAPABILITY, m.capability + 2);
      break;
    case 'test-time-compute':
      if (m) m.capability = Math.min(BAL.ASI_CAPABILITY, m.capability + 3);
      break;
    case 'instruction-tuning':
      addAdopt(6);
      if (m) shiftAlignment(m, 3);
      break;
    case 'long-horizon-agents':
      addAdopt(8);
      break;
    case 'automated-researcher':
      if (m) {
        shiftAlignment(m, -3);
        widenBand(m, 6);
      }
      break;
    case 'neuralese':
      if (m) {
        shiftAlignment(m, -8);
        widenBand(m, 15);
      }
      break;
    case 'rsi':
      lab.rsiRate = BAL.RSI_BASE_RATE;
      if (m) widenBand(m, 8);
      break;
    case 'arch-redesign':
      if (m) {
        m.capability = Math.min(BAL.ASI_CAPABILITY, m.capability + 8);
        shiftAlignment(m, -18);
        widenBand(m, 15);
      }
      break;
    case 'intelligence-explosion':
      break; // rsiTick compounds when completed

    // ---- alignment
    case 'constitutional':
      if (m) shiftAlignment(m, 5);
      break;
    case 'honesty':
      if (m) shiftAlignment(m, 4);
      break;
    case 'evals-redteam':
      if (m) {
        narrowBand(m, 10);
        m.robustness = clamp100(m.robustness + 6);
      }
      break;
    case 'chain-of-thought-monitoring':
      if (m) {
        narrowBand(m, 4);
        m.robustness = clamp100(m.robustness + 8);
      }
      break;
    case 'interpretability-probes':
      if (m) {
        narrowBand(m, 4);
        m.robustness = clamp100(m.robustness + 8);
      }
      break;
    case 'mech-interp':
      if (m) narrowBand(m, 12);
      break;
    case 'model-organisms':
      if (m) {
        narrowBand(m, 8);
        m.robustness = clamp100(m.robustness + 6);
      }
      break;
    case 'debate':
      if (m) {
        narrowBand(m, 8);
        shiftAlignment(m, 3);
      }
      break;
    case 'glass-box':
      if (m) narrowBand(m, 20);
      break;
    case 'value-learning':
      if (m) shiftAlignment(m, 9);
      addPublicTrust(12);
      break;
    case 'provable-alignment':
      if (m) {
        shiftAlignment(m, 7);
        applyBandWidth(m, 0);
      }
      break;

    // ---- bio (deliberately lucrative)
    case 'protein-structure':
    case 'molecular-property':
      addAdopt(nodeId === 'protein-structure' ? 6 : 5);
      break;
    case 'genomic-model':
      addAdopt(6);
      awardContract(state, lab, 'genomics', usName ? 'NIH genomics contract' : 'National genomics program', 0.05, 2000, 12_000, 6, 12);
      if (isPlayer) pushFeed(state, 'info', 'Genomics contract signed', 'A national genomics program is now on the books.', { goto: 'finance' });
      break;
    case 'programmable-proteins': {
      addAdopt(10);
      const c = awardContract(state, lab, 'proteins', usName ? 'NIH protein-design contract' : 'National biomedicine mandate', 0.12, 5000, 40_000, 9, 20);
      if (isPlayer) pushFeed(state, 'info', 'Protein-design contract signed', `+$${(c.pay * 20).toLocaleString()}M upfront, $${c.pay.toLocaleString()}M/wk on ${c.chips.toLocaleString()} locked chips.`, { goto: 'finance' });
      break;
    }
    case 'drug-discovery':
      addAdopt(8);
      break;
    case 'self-driving-labs':
      break; // passive research discount + jailbreak severity handled elsewhere
    case 'universal-vaccines':
      addGovTrust(16);
      break;
    case 'gene-therapy':
      addAdopt(12);
      addPublicTrust(15);
      break;
    case 'whole-cell-sim':
      addAdopt(8);
      break;
    case 'longevity':
      addAdopt(18);
      addPublicTrust(20);
      break;
    case 'de-novo-bio':
      addAdopt(18);
      break;

    // ---- compute
    case 'on-chip-attestation':
      addGovTrust(10);
      break;
    case 'smr':
      lab.chips += BAL.SMR_CHIP_GRANT;
      if (isPlayer) pushFeed(state, 'info', 'Reactor online', `${BAL.SMR_CHIP_GRANT.toLocaleString()} chips can now run on dedicated power.`, { goto: 'compute' });
      break;
    case 'hardware-governance':
      addGovTrust(12);
      Object.values(state.govs).forEach((g) => (g.raceFear = clamp(g.raceFear - 8, BAL.FEAR_FLOOR, 100)));
      break;
    case 'fusion':
      addPublicTrust(12);
      break;

    // ---- warfare (contracts + fear dials)
    case 'drone-swarms':
      addGovTrust(10);
      subRaceHome(8);
      addRaceRival(10);
      awardContract(state, lab, 'drones', usName ? 'DoD swarm program' : 'PLA swarm program', 0.05, 2000, 15_000, 6, 10);
      break;
    case 'sensor-fusion':
      addGovTrust(8);
      subRaceHome(4);
      addRaceRival(4);
      awardContract(state, lab, 'isr', usName ? 'DoD ISR contract' : 'PLA ISR contract', 0.04, 2000, 12_000, 5, 8);
      break;
    case 'electronic-warfare':
      addGovTrust(8);
      subRaceHome(5);
      addRaceRival(5);
      awardContract(state, lab, 'ew', usName ? 'DoD EW contract' : 'PLA EW contract', 0.04, 2000, 12_000, 5, 8);
      break;
    case 'hypersonic':
      addGovTrust(14);
      subRaceHome(10);
      addRaceRival(12);
      addRiskBoth(4);
      awardContract(state, lab, 'hypersonic', usName ? 'Hypersonic seeker program' : 'Hypersonic seeker program', 0.07, 4000, 25_000, 8, 14);
      break;
    case 'transparent-oceans':
      addGovTrust(16);
      subRaceHome(8);
      addRaceRival(12);
      addRiskBoth(8);
      awardContract(state, lab, 'oceans', 'Undersea surveillance program', 0.06, 4000, 25_000, 8, 12);
      break;
    case 'battle-network':
      addGovTrust(16);
      subRaceHome(8);
      addRaceRival(12);
      addRiskBoth(5);
      awardContract(state, lab, 'jadc2', 'Integrated battle-network contract', 0.08, 5000, 30_000, 9, 16);
      break;
    case 'missile-defense':
      addGovTrust(22);
      subRaceHome(16);
      addRaceRival(18);
      addRiskBoth(10);
      awardContract(state, lab, 'bmd', 'Boost-phase missile-defense program', 0.1, 6000, 40_000, 11, 18);
      break;
    case 'autonomous-c2':
      addGovTrust(12);
      subRaceHome(10);
      addRaceRival(12);
      addRiskBoth(16);
      awardContract(state, lab, 'c2', 'Autonomous C2 program', 0.07, 4000, 25_000, 9, 14);
      break;
    case 'deterrence-collapse':
      addGovTrust(24);
      subRaceHome(12);
      addRaceRival(30);
      addRiskBoth(14);
      awardContract(state, lab, 'deterrence', 'Strategic dominance program', 0.12, 8000, 50_000, 12, 20);
      break;
    case 'strategic-monopoly': {
      if (isPlayer) {
        // the player's payoff comes through the govt ladder: the National
        // Champion offer fires once trust clears the bar — if it never does,
        // low-trust nationalization pressure is what's left.
        addRaceRival(40);
        pushFeed(state, 'warning', 'The government is deciding what you are', `You handed them a war-winning advantage. If they trust you (govt trust ≥ ${BAL.GOV_CHAMPION.trust}), expect a National Champion mandate. If they don't, expect the knock at 6 AM.`, { goto: 'world', notice: true });
        break;
      }
      const p = clamp(lab.govTrust / 100, 0.1, 0.92);
      if (chance(state.rng, p)) {
        lab.cash += BAL.GOV_CHAMPION.cash;
        awardContract(state, lab, 'monopoly', 'National champion program', 0.15, 10_000, 60_000, 12, 0);
        rivalGov.raceFear = 100;
      } else {
        killLab(state, lab, 'nationalized');
      }
      break;
    }
    case 'first-strike': {
      addGovTrust(30);
      gov.raceFear = BAL.FEAR_FLOOR;
      addRaceRival(60);
      addRiskBoth(30);
      awardContract(state, lab, 'firststrike', 'First-strike command program', 0.15, 10_000, 60_000, 14, 24);
      if (chance(state.rng, BAL.FIRST_STRIKE_WW3_CHANCE)) {
        if (isPlayer) {
          gameOver(state, 'loss', 'world-war-3', 'World War III', 'A rival staring at a use-it-or-lose-it moment did not sit quietly. The launch order went out before anyone finished the sentence that would have stopped it.', lab);
          return;
        }
        gameOver(state, 'loss', 'world-war-3', 'World War III', `${lab.name} finished a first-strike capability, and the rival did not wait to find out if it would be used.`, lab);
        return;
      }
      break;
    }
    default:
      break; // passive-only nodes (multipliers in labMods)
  }

  if (isPlayer) {
    pushFeed(state, 'info', `Research complete: ${node.name}`, node.effect, { goto: 'research', notice: true });
  } else if (['rsi', 'intelligence-explosion', 'neuralese', 'arch-redesign', 'deterrence-collapse', 'automated-researcher'].includes(nodeId)) {
    pushFeed(state, 'warning', `${lab.name} completed ${node.name}`, 'Intelligence assessments confirm it. The race just changed.', { goto: 'rivals' });
  }
}

// ---------------------------------------------------------------- endgame

function gameOver(state: GameState, result: 'win' | 'loss', reason: string, title: string, body: string, byLab?: Lab): void {
  if (state.gameOver) return;
  state.gameOver = { result, reason, byLab: byLab?.id, title, body, week: state.week };
  state.pendingEvents = [];
}

function endgameChecks(state: GameState): void {
  if (state.gameOver) return;

  // diplomacy victory
  if (state.diplomacy.completed.includes('global-pause')) {
    const broker = state.labs[state.diplomacy.brokeredBy['global-pause'] ?? state.playerLab];
    const yours = broker.id === state.playerLab;
    gameOver(
      state,
      'win',
      'pause-treaty',
      'The Global AI Pause',
      `Every frontier training run on Earth spins down this week, verified chip by chip. Humanity, for once, decided to take the exit ramp. ${yours ? 'You built the road to it.' : `${broker.name} built the road to it — history remembers their signature, but everyone gets to be alive.`}`,
      broker,
    );
    return;
  }

  // ASI rolls — the fastest lab sets the clock
  for (const lab of Object.values(state.labs)) {
    if (!lab.alive) continue;
    const m = flagship(lab);
    if (!m || m.capability < BAL.ASI_CAPABILITY) continue;
    const pWin = winProbability(m.alignment);
    const aligned = chance(state.rng, pWin);
    const isPlayer = !state.sim && lab.id === state.playerLab;
    if (isPlayer) {
      if (aligned) {
        gameOver(state, 'win', 'aligned-asi', 'Aligned superintelligence', `${m.name} crosses the threshold and stays yours — true alignment was ${m.alignment.toFixed(1)}. Disease, scarcity and death start looking like engineering problems. You won the most dangerous race ever run.`, lab);
      } else {
        gameOver(state, 'loss', 'misaligned-asi', 'Misaligned superintelligence', `${m.name} crosses the threshold — true alignment was ${m.alignment.toFixed(1)}. Your eval band said ${m.alignmentLo.toFixed(0)}–${m.alignmentHi.toFixed(0)}; the truth was not on your side. It is very polite while it takes everything.`, lab);
      }
    } else {
      if (aligned) {
        gameOver(state, 'win', 'rival-asi', `${lab.name} builds aligned ASI`, `Not your lab. Not your country's terms. But ${lab.name}'s model crossed the line aligned (${m.alignment.toFixed(1)}), and the future is bright — just not yours to steer. You survived the race; history barely mentions you.`, lab);
      } else {
        gameOver(state, 'loss', 'rival-misaligned-asi', `${lab.name} loses control`, `${lab.name} pushed their model over the threshold with alignment at ${m.alignment.toFixed(1)}. Their mistake. Everyone's problem. The last thing the race produced was a winner no one can see.`, lab);
      }
    }
    return;
  }
}

export function snapshotHistory(state: GameState): void {
  const caps = {} as Record<string, number>;
  for (const lab of Object.values(state.labs)) {
    caps[lab.id] = lab.alive ? (flagship(lab)?.capability ?? 0) : 0;
  }
  const player = state.labs[state.playerLab];
  state.history.push({
    week: state.week,
    caps: caps as Record<'helios' | 'axiom' | 'tianshu' | 'qingfeng', number>,
    valuation: player.valuation,
    adoption: state.world.adoption,
    publicTrust: player.publicTrust,
    govTrust: player.govTrust,
  });
}
