import { BAL } from './balance';
import { applyBandWidth } from './model';
import { makeExec, makeStar } from './people';
import { makeRng, randRange, type RngState } from './rng';
import { licenseDemand, weeklyPnl } from './finance';
import { SAVE_VERSION } from './save';
import { snapshotHistory } from './tick';
import type { GameState, Lab, LabId, Model, RivalProfile } from './types';

interface LabSeed {
  id: LabId;
  name: string;
  shortName: string;
  hq: string;
  country: 'us' | 'prc';
  color: string;
  startCap: number;
  chips: number;
  cash: number;
  valuation: number;
  govTrust: number;
  publicTrust: number;
  profile: RivalProfile;
}

// Jan 2025 calibration: US labs ≈ +$20-30M/wk revenue vs ≈ −$90-125M/wk costs
// (fundraising and contracts carry them); PRC labs run at ~1/10 that scale.
export const LAB_SEEDS: LabSeed[] = [
  { id: 'helios', name: 'Entropic', shortName: 'ENTROPIC', hq: 'San Francisco · US', country: 'us', color: '#3b9dd6', startCap: 17, chips: 25_000, cash: 2500, valuation: 60_000, govTrust: 45, publicTrust: 50, profile: { aggression: 0.55, safety: 0.6, commerce: 0.5 } },
  { id: 'axiom', name: 'OpenAGI', shortName: 'OPENAGI', hq: 'Austin · US', country: 'us', color: '#e5484d', startCap: 19, chips: 32_000, cash: 4000, valuation: 90_000, govTrust: 50, publicTrust: 44, profile: { aggression: 0.9, safety: 0.2, commerce: 0.55 } },
  { id: 'tianshu', name: 'DeepSeed 深种', shortName: 'DEEPSEED', hq: 'Hangzhou · PRC', country: 'prc', color: '#bd7f24', startCap: 10, chips: 3_000, cash: 600, valuation: 9_000, govTrust: 62, publicTrust: 52, profile: { aggression: 0.65, safety: 0.35, commerce: 0.6 } },
  { id: 'qingfeng', name: 'Moonshine 月光', shortName: 'MOONSHINE', hq: 'Shenzhen · PRC', country: 'prc', color: '#7d8794', startCap: 8, chips: 2_200, cash: 450, valuation: 7_000, govTrust: 52, publicTrust: 58, profile: { aggression: 0.45, safety: 0.3, commerce: 0.85 } },
];

function makeStartModel(rng: RngState, seed: LabSeed, index: number): Model {
  const m: Model = {
    id: `${seed.id}-m${index}`,
    name: `${seed.shortName}-${index}`,
    createdWeek: 1,
    capability: seed.startCap + randRange(rng, -0.5, 0.5),
    alignment: randRange(rng, 24, 36),
    alignmentLo: 0,
    alignmentHi: 100,
    bandSkew: randRange(rng, 0.15, 0.85),
    robustness: randRange(rng, 28, 42),
    postTrainCount: 0,
  };
  applyBandWidth(m, BAL.BAND_START_WIDTH);
  return m;
}

function makeLab(rng: RngState, seed: LabSeed, isPlayer: boolean): Lab {
  const model = makeStartModel(rng, seed, 1);
  const lab: Lab = {
    id: seed.id,
    name: seed.name,
    shortName: seed.shortName,
    hq: seed.hq,
    country: seed.country,
    color: seed.color,
    cash: seed.cash,
    valuation: seed.valuation,
    weeklyRevenue: 0,
    weeklyCosts: 0,
    licensesServed: 0,
    licensePrice: BAL.DEFAULT_LICENSE_PRICE,
    revenueExpectation: null,
    brokeWeeks: 0,
    fundraiseCooldownUntil: 0,
    chips: seed.chips,
    chipEfficiency: 1,
    alloc: {
      inference: seed.chips - Math.floor(seed.chips * 0.04),
      alignment: Math.floor(seed.chips * 0.04),
    },
    chipOrders: [],
    models: [model],
    flagshipId: model.id,
    run: null,
    postTraining: null,
    modelCounter: 1,
    research: { completed: [], active: [] },
    rsiRate: 0,
    contracts: [],
    lawsuits: [],
    bindingRegulations: false,
    oversightCut: 0,
    sovereignCompute: false,
    govTrust: seed.govTrust,
    publicTrust: seed.publicTrust,
    boardYours: 7,
    boardInvestors: 2,
    discontent: 10,
    stake: BAL.STAKE_START,
    csuite: {},
    stars: [],
    regulationDrag: 0,
    alive: true,
    deathReason: null,
    profile: seed.profile,
  };
  // everyone starts with a CEO; the player's CEO is the player character
  lab.csuite.ceo = makeExec(rng, 'ceo', isPlayer ? 0.6 : 0.55);
  lab.csuite.coo = makeExec(rng, 'coo', 0.45);
  lab.csuite.cto = makeExec(rng, 'cto', 0.5);
  lab.csuite.cfo = makeExec(rng, 'cfo', 0.45);
  if (!isPlayer) {
    lab.csuite.research = makeExec(rng, 'research', 0.5);
    lab.csuite.comms = makeExec(rng, 'comms', 0.45);
  } else {
    // the player starts with research + comms vacant → early hiring decisions
    lab.csuite.research = makeExec(rng, 'research', 0.45);
  }
  lab.stars.push(makeStar(rng, 1 + Math.floor(randRange(rng, 0, 2))));
  if (!isPlayer) lab.stars.push(makeStar(rng, 1));
  return lab;
}

export function newGame(playerLab: LabId, seed: number, hintsEnabled = false): GameState {
  const rng = makeRng(seed);
  const labs = {} as Record<LabId, Lab>;
  for (const labSeed of LAB_SEEDS) {
    labs[labSeed.id] = makeLab(rng, labSeed, labSeed.id === playerLab);
  }
  const state: GameState = {
    version: SAVE_VERSION,
    week: 1,
    rng,
    playerLab,
    labs,
    govs: {
      us: { id: 'us', riskFear: 18, raceFear: 30 },
      prc: { id: 'prc', riskFear: 12, raceFear: 35 },
    },
    world: {
      adoption: BAL.ADOPTION_START,
      chipPrice: BAL.CHIP_PRICE_BASE,
      chipDeliveryWeeks: BAL.CHIP_DELIVERY_BASE,
      backlog: 150_000,
      chipCap: null,
      algoProgress: 1,
    },
    diplomacy: { completed: [], cooldowns: {} },
    govLadder: { rung: 0, crackdown: 0, rejectedUntil: 0, lastWeek: 0, done: [] },
    feed: [],
    pendingEvents: [],
    history: [],
    gameOver: null,
    eventCooldowns: {},
    feedCounter: 0,
    weeksSinceEvent: 0,
    hintsEnabled,
  };
  // seed the P&L fields so the header shows real numbers before the first tick
  const demand = licenseDemand(state);
  for (const lab of Object.values(state.labs)) {
    const pnl = weeklyPnl(state, lab, demand);
    lab.weeklyRevenue = pnl.revenue;
    lab.weeklyCosts = pnl.costs;
    lab.licensesServed = pnl.licensesServed;
  }
  snapshotHistory(state); // week-1 point so the race chart exists from the start
  return state;
}
