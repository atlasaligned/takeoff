import type { RngState } from './rng';

/** All money amounts are in $ millions. */

export type LabId = 'helios' | 'axiom' | 'tianshu' | 'qingfeng';
export type GovId = 'us' | 'prc';

export type CSuiteRole = 'ceo' | 'coo' | 'cto' | 'cfo' | 'research' | 'alignment' | 'comms';

/** What a named person is good at. C-suite bonuses are role-specific fields. */
export interface Executive {
  id: string;
  name: string;
  role: CSuiteRole;
  /** salary in $M per week */
  salary: number;
  // role-specific stats, 0..100-ish scales
  charisma: number; // ceo: fundraising terms, poaching
  credibility: number; // ceo: trust gains
  trainingSpeed: number; // cto: % bonus to training speed
  capabilityBonus: number; // cto: % bonus to trained capability
  financeBonus: number; // cfo: % better raise sizes, % lower burn
  researchBonus: number; // head of research: % research speed
  alignmentBonus: number; // head of alignment: % alignment work effectiveness
  commsBonus: number; // comms: % slower public trust decay
  opsBonus: number; // coo: % lower burn
  /** board plant (hostile COO event): no bonus, feeds board discontent weekly */
  hostile?: boolean;
}

export type StarField =
  | 'scaling' // % capability per training run
  | 'rl' // % post-training effect
  | 'interp' // % alignment band narrowing
  | 'robustness' // flat robustness on new models
  | 'alignment' // % alignment work effectiveness
  | 'agents'; // % revenue

export interface Star {
  id: string;
  name: string;
  field: StarField;
  /** magnitude of the field-specific bonus (percent points or flat, per field) */
  bonus: number;
  /** salary in $M per week */
  salary: number;
  /** 1..3 stars, display + poach difficulty */
  tier: number;
}

export interface Model {
  id: string;
  name: string;
  createdWeek: number;
  capability: number; // 0..100, capped at 100 — reaching the cap triggers the win roll
  alignment: number; // TRUE alignment 0..100, hidden from player
  /** displayed band [lo, hi]; invariant: lo <= alignment <= hi */
  alignmentLo: number;
  alignmentHi: number;
  /** fixed per-model fraction of the band that sits below the true value (0.15..0.85) */
  bandSkew: number;
  robustness: number; // 0..100
  postTrainCount: number;
}

export interface TrainingRun {
  id: string;
  codename: string;
  modelName: string;
  targetFlop: number;
  doneFlop: number;
  startedWeek: number;
  /** chips committed to the run at start — fixed for its duration */
  chips: number;
  /** capability the finished model is predicted to reach (recomputed with bonuses at finish) */
  estCapability: number;
  /** full cash cost: TRAIN_UPFRONT_FRAC at launch, the rest weekly with FLOP progress */
  costTotal: number;
  /** cash paid so far (upfront + settled weekly payments) */
  costPaid: number;
}

export interface ChipOrder {
  chips: number;
  orderedWeek: number;
  arrivesWeek: number;
}

export interface GovContract {
  id: string;
  name: string;
  weeklyPay: number; // $M / week
  chips: number; // chips permanently locked
  startedWeek: number;
}

/** An enterprise customer shopping for a deal. Pursue it or it walks. */
export interface EnterpriseLead {
  id: string;
  /** customer name */
  name: string;
  /** requires a fine-tuned model: pricier, longer, bigger */
  fineTune: boolean;
  /** one-off cash cost to pursue, paid win or lose */
  cashCost: number;
  /** chips locked into the deployment for the duration (returned at expiry) */
  chips: number;
  /** true conversion probability, shown to the player as-is */
  odds: number;
  weeklyPay: number; // $M / week
  durationWeeks: number;
  /** lead disappears if not pursued by this week */
  expiresWeek: number;
}

/** A won enterprise deal: fixed-duration weekly revenue on locked chips. */
export interface EnterpriseContract {
  id: string;
  name: string;
  fineTune: boolean;
  weeklyPay: number; // $M / week
  chips: number; // locked until endsWeek, then released
  startedWeek: number;
  endsWeek: number;
  /** model the fine-tune was built from (deployment portfolio display) */
  modelName: string | null;
}

export interface RevenueExpectation {
  target: number; // $M / week
  deadlineWeek: number;
}

export interface ResearchProgress {
  nodeId: string;
  weeksDone: number;
  totalWeeks: number;
}

/** Strategy knobs for AI-controlled labs (0..1 each). */
export interface RivalProfile {
  aggression: number; // bigger training runs, earlier capability research
  safety: number; // alignment compute share, alignment research priority
  commerce: number; // price undercutting, bio research, chip buying
}

export interface Lab {
  id: LabId;
  name: string;
  shortName: string;
  hq: string;
  country: GovId;
  color: string;

  cash: number;
  valuation: number;
  weeklyRevenue: number; // last computed, for display
  weeklyCosts: number;
  /** licenses (seats) served last week, millions of seats stored as raw count */
  licensesServed: number;
  licensePrice: number; // $ per seat per month
  revenueExpectation: RevenueExpectation | null;
  /** weeks in a row with cash < 0; bankruptcy at BANKRUPTCY_GRACE_WEEKS */
  brokeWeeks: number;
  fundraiseCooldownUntil: number; // week

  chips: number;
  /** fleet efficiency 1.0 → decays with obsolescence; effective chips = chips * chipEfficiency */
  chipEfficiency: number;
  /**
   * Chip split. Training chips are not here — they are committed on the run /
   * post-training and fixed for its duration. `alignment` is the player knob;
   * `inference` is the maintained remainder (rebalanceAllocations) — no idle.
   */
  alloc: { inference: number; alignment: number };
  chipOrders: ChipOrder[];

  models: Model[];
  flagshipId: string | null;
  run: TrainingRun | null;
  postTraining: { weeksLeft: number; totalWeeks: number; chips: number } | null;
  modelCounter: number;

  research: {
    completed: string[];
    active: ResearchProgress[];
  };
  /** recursive self-improvement: % of capability added per week (0 if Takeoff not researched) */
  rsiRate: number;

  contracts: GovContract[];
  /** open enterprise leads waiting for a pursue/ignore call */
  leads: EnterpriseLead[];
  /** running enterprise contracts (chips locked until endsWeek) */
  enterprise: EnterpriseContract[];
  leadCounter: number;
  lawsuits: { name: string; weeklyCost: number; weeksLeft: number }[];

  /** govt crackdown: big training runs slowed while true */
  bindingRegulations: boolean;
  /** govt crackdown: fraction of revenue consumed by embedded oversight (0 = none) */
  oversightCut: number;
  /** sovereign compute buildout accepted: permanent chip-cost discount */
  sovereignCompute: boolean;

  govTrust: number; // 0..100, trust of the HOME government
  publicTrust: number; // 0..100

  boardYours: number;
  boardInvestors: number;
  discontent: number; // 0..100
  /** founder equity stake 0..1; every raise dilutes it (amount / post-money) */
  stake: number;

  csuite: Partial<Record<CSuiteRole, Executive>>;
  stars: Star[];

  /** regulation penalty 0..1 applied to training speed while home govt is 'regulating'/'nervous' */
  regulationDrag: number;

  alive: boolean;
  deathReason: string | null;

  /** AI profile; unused for the player lab */
  profile: RivalProfile;
  /** named strategy driving this lab when AI-controlled (see engine/strategy.ts) */
  strategy?: string;
  /** arbiter ('optimal') bookkeeping: which playbook it currently follows */
  metaStrategy?: { current: string; nextEvalWeek: number };

  /** this lab's standing in its home government's procurement ladder */
  govLadder: GovLadderState;
  /** per-event-id week of last firing for THIS lab, to space repeatable events */
  eventCooldowns: Record<string, number>;
  /** weeks since this lab's last random event (raises the odds gradually) */
  weeksSinceEvent: number;
}

export interface Government {
  id: GovId;
  riskFear: number; // 0..100
  raceFear: number; // 0..100
}

export type GovQuadrant = 'asleep' | 'regulating' | 'accelerating' | 'nervous';

export interface World {
  adoption: number; // 0..100
  chipPrice: number; // $M per chip
  chipDeliveryWeeks: number;
  /** global chip order backlog in units, drives price/delivery */
  backlog: number;
  /** treaty cap on chips per lab, null if no Compute Cap Treaty */
  chipCap: number | null;
  /** global compounding algorithmic-progress multiplier on effective FLOP */
  algoProgress: number;
}

export type FeedKind = 'blocking' | 'warning' | 'info' | 'ticker';

export interface FeedItem {
  id: string;
  week: number;
  kind: FeedKind;
  title: string;
  body: string;
  /** tab to deep-link to */
  goto?: string;
  /** ticker category label, e.g. ADOPTION / MARKET / POLICY */
  tag?: string;
  /** important player outcome — the UI surfaces it as a pause-and-acknowledge modal */
  notice?: boolean;
}

export interface EventChoice {
  id: string;
  label: string;
  /** short cost/effect preview shown to the player */
  detail: string;
}

/** A blocking event waiting for a player decision. */
export interface ActiveEvent {
  eventId: string;
  /** the lab this event targets (events are symmetric — every lab gets them) */
  labId: LabId;
  week: number;
  title: string;
  body: string;
  choices: EventChoice[];
  /** event-specific payload (e.g. the star being offered) */
  data: Record<string, unknown>;
}

/**
 * A lab's standing in the government procurement ladder (home govt only).
 * Symmetric: every lab climbs its own ladder; AI labs auto-answer the offers.
 */
export interface GovLadderState {
  /** next core ladder rung to be offered (index into the ladder) */
  rung: number;
  /** next crackdown step to fire while govt trust stays low */
  crackdown: number;
  /** after a rejected offer the govt sulks until this week (blocks all offers) */
  rejectedUntil: number;
  /** week of the last govt event of any kind — enforces spacing */
  lastWeek: number;
  /** research-gated bonus offers already accepted (event ids) */
  done: string[];
}

export interface DiplomacyState {
  completed: string[];
  /** which lab brokered each completed treaty */
  brokeredBy: Partial<Record<string, LabId>>;
  /** small-action / treaty-talks cooldowns, keyed `${labId}:${actionId}`, week until usable */
  cooldowns: Record<string, number>;
}

export interface HistoryPoint {
  week: number;
  caps: Record<LabId, number>;
  valuation: number; // player
  adoption: number;
  publicTrust: number;
  govTrust: number;
}

export interface GameOver {
  result: 'win' | 'loss';
  /** short machine tag, e.g. 'aligned-asi', 'pause-treaty', 'rival-asi', 'bankrupt' ... */
  reason: string;
  /** the lab that caused the ending (ASI builder, pause broker, jailbroken lab...) */
  byLab?: LabId;
  title: string;
  body: string;
  week: number;
}

export interface GameState {
  version: number;
  week: number; // 0 = first week of Jan 2026
  rng: RngState;
  playerLab: LabId;
  labs: Record<LabId, Lab>;
  govs: Record<GovId, Government>;
  world: World;
  diplomacy: DiplomacyState;
  feed: FeedItem[];
  /** blocking events for the player; game must pause while non-empty */
  pendingEvents: ActiveEvent[];
  history: HistoryPoint[];
  gameOver: GameOver | null;
  feedCounter: number;
  /** newer-player mode: the advisor suggests a helpful next action */
  hintsEnabled: boolean;
  /** guided tutorial game: random events are suppressed and the game is never saved */
  tutorial?: boolean;
  /**
   * symmetric headless simulation (harness): no player special-casing — every
   * lab is AI-driven and answers its own events instantly (nothing blocks)
   */
  sim?: boolean;
}
