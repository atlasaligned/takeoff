/**
 * ALL tunable numbers live in this file. The sim harness (src/sim) sweeps
 * seeds against these; tune here, never inline magic numbers in systems.
 *
 * Units: money in $M, time in weeks, chips in units.
 */

export const BAL = {
  // ---------------------------------------------------------------- time
  /** week 1 = first week of January */
  START_YEAR: 2025,
  /** history/feed caps */
  FEED_MAX: 250,

  // ---------------------------------------------------------------- capability
  /**
   * capability = CAP_PER_DECADE * (log10(effectiveFlop) - CAP_LOG_BASE)
   * effectiveFlop = flop * algoMultiplier (research) — pure scaling alone
   * cannot reach 100 inside the game span; research multipliers + RSI must
   * close the gap.
   */
  CAP_LOG_BASE: 27.25,
  CAP_PER_DECADE: 15,
  /** FLOP produced by one chip in one week (game units) */
  FLOP_PER_CHIP_WEEK: 7e21,
  /** train cost: $M per 1e27 FLOP (before research discounts) */
  TRAIN_COST_PER_E27: 285,
  /**
   * fraction of a run's cash cost due at launch (data, engineering, cluster
   * prep). The rest is paid week by week as the FLOP actually burns, so a
   * frontier run is a payment plan against future revenue rather than one
   * enormous upfront check. Aborting cancels the unpaid remainder.
   */
  TRAIN_UPFRONT_FRAC: 0.35,
  /** fraction of final capability you keep if you abort at progress p: p^ABORT_EXP */
  ABORT_EXP: 3,
  /** weekly passive algorithmic progress: multiplier on effective FLOP, compounding */
  ALGO_PROGRESS_PER_WEEK: 1.0015,
  /** new model inherits alignment/robustness partly from previous flagship */
  INHERIT_ALIGN: 0.55,
  NEW_MODEL_ALIGN_MEAN: 16,
  NEW_MODEL_ALIGN_SD: 7,
  INHERIT_ROBUST: 0.6,
  NEW_MODEL_ROBUST_MEAN: 14,
  NEW_MODEL_ROBUST_SD: 6,
  /** initial displayed alignment band width */
  BAND_START_WIDTH: 55,
  BAND_MIN_WIDTH: 3,

  // ---------------------------------------------------------------- post-training
  POST_TRAIN_WEEKS: 3,
  POST_TRAIN_COST: 400, // at capability 20; scales with (cap/20)^EXP
  POST_TRAIN_COST_CAP_EXP: 2,
  POST_TRAIN_CHIPS: 4000, // chips committed for the duration of post-training
  /** gains shrink with each pass on the same model: gain * DECAY^passes */
  POST_TRAIN_CAP_GAIN: 1.2,
  POST_TRAIN_ALIGN_GAIN: 1.5,
  POST_TRAIN_ROBUST_GAIN: 2.5,
  POST_TRAIN_DECAY: 0.6,

  // ---------------------------------------------------------------- alignment work
  /**
   * weekly true-alignment gain from alignment compute:
   * ALIGN_RATE * cbrt(chips/1000) * boost * (1 - align/ceiling)
   * cube root: alignment is researcher-bound, not compute-bound, at scale.
   * ceiling depends on research: base → Glass Box → Provable Alignment.
   */
  ALIGN_RATE: 0.19,
  /**
   * alignment compute saturates: chips beyond this contribute nothing (the
   * bottleneck is researchers, not GPUs). Without this cap, late-game mega
   * fleets (millions of chips) grind true alignment to the ceiling in weeks
   * and make an aligned-ASI roll nearly free — the cube root alone is not
   * enough once fleets grow exponentially.
   */
  ALIGN_CHIPS_CAP: 400_000,
  ALIGN_CEILING_BASE: 60,
  ALIGN_CEILING_SCALABLE_OVERSIGHT: 70,
  ALIGN_CEILING_DELIBERATIVE: 76,
  ALIGN_CEILING_WEAK_TO_STRONG: 84,
  ALIGN_CEILING_GLASS_BOX: 80,
  ALIGN_CEILING_VALUE_LEARNING: 86,
  ALIGN_CEILING_PROVABLE: 90,
  /** Scalable Oversight: early bonus to alignment-work rate, fades to 0 by this capability */
  SCALABLE_OVERSIGHT_FADE_CAP: 70,
  SCALABLE_OVERSIGHT_MAX_BONUS: 0.8,
  /** Deliberative Alignment: alignment-work rate bonus that grows with capability */
  DELIBERATIVE_CAP_SCALE: 120,
  /** Weak-to-Strong: alignment granted to a new model per point of capability jump (capped) */
  WEAK_TO_STRONG_PER_JUMP: 0.5,
  WEAK_TO_STRONG_MAX: 15,
  /** AI Control Protocols: terminal-jailbreak save chance = min(cap, share * scale) */
  AI_CONTROL_SHARE_SCALE: 1.5,
  AI_CONTROL_SAVE_CAP: 0.6,
  /** First-Strike Capability: probability completing it triggers a game-ending WWIII */
  FIRST_STRIKE_WW3_CHANCE: 0.45,
  /** Small Modular Reactors: chips added to the fleet on completion */
  SMR_CHIP_GRANT: 10_000,
  /** weekly band narrowing from alignment compute (points of width) */
  BAND_NARROW_RATE: 0.2,

  // ---------------------------------------------------------------- win roll
  /** piecewise-linear P(win) over true alignment at capability 100 */
  WIN_ROLL_POINTS: [
    [84, 0.0],
    [88, 0.08],
    [92, 0.28],
    [95, 0.52],
    [98, 0.72],
    [100, 0.88],
  ] as ReadonlyArray<readonly [number, number]>,
  ASI_CAPABILITY: 100,

  // ---------------------------------------------------------------- RSI
  /**
   * Takeoff: weekly capability growth as fraction of current capability.
   * RSI is mathematically the only route to cap 100 (training FLOP can't get
   * there), so the nerf makes it SLOWER and TAPERED near the top rather than
   * blocking it: the vertical "watch it tick to 100" autopilot becomes a long,
   * decelerating grind you still have to actively feed alignment through.
   */
  RSI_BASE_RATE: 0.0026,
  /** Intelligence Explosion: rsiRate itself compounds weekly by this factor */
  RSI_ACCEL: 1.016,
  /**
   * RSI self-growth is scaled by (1 - cap/RSI_DECEL_CAP) — a real taper near
   * the ceiling (at cap 100 it runs at ~36% of nominal) so the last stretch
   * drags and leaves alignment time to keep pace, without making 100 unreachable.
   */
  RSI_DECEL_CAP: 156,

  // ---------------------------------------------------------------- compute / chips
  CHIP_PRICE_BASE: 0.03, // $M per chip
  /** largest single chip order the fabs will even quote */
  MAX_CHIP_ORDER: 50_000,
  CHIP_DELIVERY_BASE: 12, // weeks
  /** price scales with global backlog: price = base * (1 + backlog / BACKLOG_SOFT) */
  BACKLOG_SOFT: 600_000,
  BACKLOG_DECAY: 0.02, // fabs work through this fraction of backlog per week
  /** delivery lengthens with backlog */
  DELIVERY_PER_BACKLOG: 10 / 600_000,
  /** PRC labs pay a premium and wait longer (export controls) */
  PRC_CHIP_PRICE_MULT: 1.4,
  PRC_CHIP_DELIVERY_EXTRA: 6,
  /** weekly opex per chip, $M — every chip is always working (no idle) */
  CHIP_OPEX: 0.0016,
  /**
   * grid strain: fleets beyond this size pay progressively more opex per chip
   * (power contracts, land, cooling). Kills the "buy 30% of cash in chips
   * every week forever" runaway found by the tournament cheese sweep.
   */
  CHIP_OPEX_SOFT_FLEET: 600_000,
  CHIP_OPEX_STRAIN: 0.6,
  /**
   * Capability at which grid-strain relief begins. Below this the soft cap is a
   * flat 600k (the fleet-maxxing cheese freezes capability well under it, so it
   * gets zero relief and the runaway stays dead). Set high so only near-frontier
   * labs — which earn far more revenue per chip — see softened upkeep.
   */
  CHIP_OPEX_CAP_BASE: 70,
  /** each capability point past CHIP_OPEX_CAP_BASE lifts the strain soft cap by this fraction of 600k */
  CHIP_OPEX_CAP_RELIEF: 0.05,
  /** obsolescence: fleet efficiency multiplier decays to this floor */
  CHIP_EFF_DECAY_PER_WEEK: 0.0012,
  CHIP_EFF_FLOOR: 0.55,
  /** buying chips refreshes fleet efficiency toward 1.0 by blended average */

  // ---------------------------------------------------------------- licenses / revenue
  /** total addressable seats = adoption^2 * SEATS_PER_ADOPTION2 */
  SEATS_PER_ADOPTION2: 42_000,
  /** demand share weight = exp(cap / CAP_DEMAND_SCALE) * (REF_PRICE/price)^PRICE_ELASTICITY */
  CAP_DEMAND_SCALE: 10,
  PRICE_ELASTICITY: 1.4,
  REF_PRICE: 25, // $/seat/month
  /**
   * seats served per inference chip at the base capability (before MoE etc.);
   * grows with flagship capability — better models serve far more users per
   * chip. Tuned so week-0 demand ≈ the whole starting fleet: alignment and
   * training compute come straight out of served revenue.
   */
  SEATS_PER_CHIP: 150,
  SEATS_PER_CHIP_CAP_SCALE: 0.18, // +18% seats/chip per capability point above the base
  /** capability where seats/chip growth starts — sits just above the US start caps */
  SEATS_PER_CHIP_CAP_BASE: 13,
  DEFAULT_LICENSE_PRICE: 25,
  /** PRC labs address a mostly-domestic market: demand weight multiplier */
  PRC_DEMAND_MULT: 0.12,

  // ---------------------------------------------------------------- enterprise sales
  /**
   * Enterprise leads: an actively-chased third revenue stream for the early
   * game. Sizes are FLAT in $M — as license revenue grows quadratically with
   * adoption, enterprise fades into background noise without extra rules.
   */
  ENT_LEAD_CHANCE: 0.5, // weekly chance a lead lands (≈1 per 1-2 weeks)
  ENT_MAX_LEADS: 3, // open leads per lab; new ones stop arriving until slots free
  /**
   * sales-team bandwidth: no new leads while this many contracts are running.
   * This is what keeps enterprise an early-game survival tool instead of a
   * scaling money engine — without it the exploit sweep's money-cheese lines
   * (tycoon/saint) farm contracts into mega-fleet valuations.
   */
  ENT_MAX_ACTIVE: 4,
  ENT_LEAD_EXPIRY: 4, // weeks before an unanswered lead walks
  ENT_FT_FRAC: 0.3, // fraction of leads that require a fine-tuned model
  /** standard lead ranges (fine-tune leads multiply these) */
  ENT_CASH_MIN: 18,
  ENT_CASH_MAX: 45, // $M upfront, paid win or lose
  ENT_CHIPS_MIN: 200,
  ENT_CHIPS_MAX: 800, // chips locked for the duration on success
  ENT_PAY_MIN: 2.5,
  ENT_PAY_MAX: 6, // $M/wk
  ENT_WEEKS_MIN: 28,
  ENT_WEEKS_MAX: 52,
  ENT_ODDS_MIN: 0.5,
  ENT_ODDS_MAX: 0.85,
  /** conversion odds bonus per flagship capability point above the US start (~10) */
  ENT_ODDS_PER_CAP: 0.004,
  ENT_ODDS_CAP: 0.92,
  /** fine-tune multipliers: pricier, longer, bigger */
  ENT_FT_CASH_MULT: 2.4,
  ENT_FT_CHIPS_MULT: 2.0,
  ENT_FT_PAY_MULT: 2.2,
  ENT_FT_WEEKS_MULT: 1.7,
  /** PRC labs sell into a mostly-domestic enterprise market: pay & cost scale */
  ENT_PRC_MULT: 0.35,
  /**
   * investors value fixed-term contract revenue near its remaining cash value,
   * not at the startup hype multiple: only this fraction of enterprise $/wk
   * counts toward fair valuation. Kills the enterprise→valuation→mega-raise
   * loop while keeping the cash-flow benefit that is the point of the system.
   */
  ENT_VALUATION_FRAC: 0.25,

  // ---------------------------------------------------------------- valuation
  /**
   * valuation = (annualRev * multiple + CAP_PREMIUM * e^(cap/CAP_PREMIUM_SCALE)) * trustMult
   * The revenue multiple compresses from REV_MULTIPLE (startup hype) toward
   * REV_MULTIPLE_FLOOR as annual revenue approaches real-company scale.
   */
  REV_MULTIPLE: 30,
  REV_MULTIPLE_FLOOR: 8,
  /** $M of annual revenue at which the multiple has compressed ~63% of the way */
  REV_MULTIPLE_COMPRESS: 60_000,
  /** anchored so a start-cap (~10) US lab has the same fair value it had at the old cap-17 start */
  CAP_PREMIUM: 7200, // $M
  CAP_PREMIUM_SCALE: 12,
  VALUATION_DRIFT: 0.08, // weekly fraction moved toward fair value

  // ---------------------------------------------------------------- fundraising
  SMALL_RAISE_FRAC: 0.12, // of valuation
  LARGE_RAISE_FRAC: 0.22,
  RAISE_COOLDOWN: 26, // ≈ the revenue-target window — no round-mashing
  /**
   * Raise proceeds scale with founder stake: investors who already own most of
   * the company write smaller checks. The multiplier ramps from RAISE_STAKE_MIN
   * (at STAKE_FLOOR) to 1 (at STAKE_COMFORT), so serial dilution yields steadily
   * less cash — closing the "small-raises-forever, dilution doesn't matter" loop.
   */
  RAISE_STAKE_MIN: 0.35,
  /** small round: expectation = max(rev * SMALL_RAISE_EXPECT_MULT, rev + SMALL_RAISE_EXPECT_MIN_STEP) */
  SMALL_RAISE_EXPECT_MULT: 1.35,
  SMALL_RAISE_EXPECT_MIN_STEP: 40,
  SMALL_RAISE_EXPECT_WEEKS: 22,
  EXPECT_MISS_VALUATION_HIT: 0.25,
  EXPECT_MISS_DISCONTENT: 10,
  /** emergency raise during bankruptcy grace */
  EMERGENCY_RAISE_FRAC: 0.12,
  EMERGENCY_VALUATION_HIT: 0.4,
  EMERGENCY_DISCONTENT: 25,
  BANKRUPTCY_GRACE_WEEKS: 8,

  // ---------------------------------------------------------------- dilution
  /** founder stake at game start; every raise dilutes by amount / post-money */
  STAKE_START: 0.8,
  /**
   * investor pressure ramps 0→1 as stake falls from STAKE_COMFORT to
   * STAKE_FLOOR; scales revenue-target strictness, miss penalties and
   * board-demand event frequency.
   */
  STAKE_COMFORT: 0.65,
  STAKE_FLOOR: 0.15,
  /** revenue expectation multiplier gains this much at full pressure */
  EXPECT_MULT_PRESSURE: 0.6,

  // ---------------------------------------------------------------- payroll
  BASE_PAYROLL: 25, // $M/week non-named staff, scales with chips a bit
  /** PRC labs pay a fraction of US comp */
  PRC_PAYROLL_MULT: 0.25,
  PAYROLL_PER_10K_CHIPS: 4,

  // ---------------------------------------------------------------- trust
  TRUST_DRIFT_TARGET: 45, // both trusts slowly drift here
  TRUST_DRIFT_RATE: 0.01,
  /** recovery from below the target is faster — the news cycle moves on */
  TRUST_DRIFT_RATE_UP: 0.022,
  PUBLIC_TRUST_LOW: 30, // below: protests / attacks / leaks
  GOV_TRUST_NATIONALIZE: 25, // below + nervous quadrant: nationalization risk

  // ---------------------------------------------------------------- governments
  FEAR_MID: 50,
  /** risk fear creeps with the global capability frontier */
  RISK_FEAR_PER_CAP: 0.0095, // per week per (frontierCap - 40) above 40
  /**
   * risk fear also decays each week toward the floor. Without this it only ever
   * climbs, so the Pause fear-gate is a pure time gate every game eventually
   * clears — making the pause near-inevitable. With decay, sustained high fear
   * needs a genuinely advancing frontier (or active alarms), so the pause is a
   * real race against rivals reaching ASI rather than a formality.
   */
  RISK_FEAR_DECAY: 0.13,
  /** race fear creeps with rival-country frontier lead */
  RACE_FEAR_PER_LEAD: 0.05, // per week per point of lead
  RACE_FEAR_DECAY: 0.3, // weekly decay toward 25 when behind is small
  FEAR_FLOOR: 5,

  // ---------------------------------------------------------------- jailbreaks
  /**
   * weekly p = JB_BASE * cap^JB_CAP_EXP * (0.5 + adoption/100)
   *            * ((100 - robustness)/70)^JB_ROBUST_EXP
   * Unbreakable sets robustness 99 → p collapses.
   */
  JB_BASE: 0.0003,
  JB_CAP_EXP: 0.95,
  JB_ROBUST_EXP: 1.6,
  /** capability buckets for severity */
  JB_MINOR_MAX: 30,
  JB_BAD_MAX: 55,
  JB_SEVERE_MAX: 80,
  /** Corrigibility Core: chance a terminal event is shut down at the last second */
  CORRIGIBILITY_SAVE: 0.55,
  /** Crisis Hotline: multiplier on jailbreak trust/fear damage */
  RED_PHONE_DAMPING: 0.6,
  /** Transparency Pledge: one-time capability each rival flagship gains from your disclosures */
  TRANSPARENCY_RIVAL_CAP_GAIN: 0.6,

  // ---------------------------------------------------------------- adoption
  ADOPTION_START: 12,
  ADOPTION_BASE_GROWTH: 0.45, // per week
  ADOPTION_PER_FRONTIER: 0.025, // extra per point of frontier cap above the base
  /** frontier capability where adoption growth accelerates — just above the US start caps */
  ADOPTION_FRONTIER_BASE: 13,

  // ---------------------------------------------------------------- events
  /** chance of a random event per week = base + perWeek * week (capped) */
  EVENT_BASE_CHANCE: 0.1,
  EVENT_CHANCE_PER_WEEK: 0.0006,
  EVENT_CHANCE_MAX: 0.32,
  /** additional ramp: each event-free week adds this to the chance */
  EVENT_DROUGHT_BOOST: 0.012,
  /** default per-event cooldown, weeks */
  EVENT_COOLDOWN: 20,

  // ---------------------------------------------------------------- govt ladder
  /** min weeks between any two govt events (offers or crackdown steps) */
  GOV_EVENT_MIN_GAP: 6,
  /** weeks the govt sulks after a rejected offer before retrying the same rung */
  GOV_RETRY_COOLDOWN: 10,
  /** weekly chance an eligible offer actually lands (eval grant is deterministic) */
  GOV_OFFER_CHANCE: 0.4,
  /**
   * Core procurement ladder, offered strictly in order. trust/week are gates;
   * chips lock into the contract; pay = chips * CHIP_OPEX * payMult; upfront =
   * pay * upfrontWeeks; cash is a one-off grant on top. Rejecting costs
   * trustLoss and freezes the ladder for GOV_RETRY_COOLDOWN.
   */
  GOV_LADDER: [
    /* eval grant   */ { trust: 0, week: 2, chipFrac: 0, minChips: 0, maxChips: 0, payMult: 0, upfrontWeeks: 0, cash: 300, trustGain: 3, trustLoss: 2 },
    /* pilot        */ { trust: 40, week: 8, chipFrac: 0.02, minChips: 500, maxChips: 1500, payMult: 8, upfrontWeeks: 10, cash: 120, trustGain: 3, trustLoss: 3 },
    /* civilian     */ { trust: 50, week: 20, chipFrac: 0.04, minChips: 1000, maxChips: 6000, payMult: 9, upfrontWeeks: 12, cash: 0, trustGain: 4, trustLoss: 3 },
    /* classified   */ { trust: 58, week: 32, chipFrac: 0.06, minChips: 2000, maxChips: 10_000, payMult: 11, upfrontWeeks: 14, cash: 0, trustGain: 5, trustLoss: 4 },
    /* supplier     */ { trust: 68, week: 48, chipFrac: 0.09, minChips: 5000, maxChips: 30_000, payMult: 13, upfrontWeeks: 18, cash: 0, trustGain: 6, trustLoss: 4 },
    /* sovereign    */ { trust: 74, week: 60, chipFrac: 0.15, minChips: 8000, maxChips: 50_000, payMult: 5, upfrontWeeks: 0, cash: 15_000, trustGain: 6, trustLoss: 6 },
  ] as ReadonlyArray<{ trust: number; week: number; chipFrac: number; minChips: number; maxChips: number; payMult: number; upfrontWeeks: number; cash: number; trustGain: number; trustLoss: number }>,
  /** research-gated bonus offers (fire out of ladder order, once each) */
  GOV_MEGADEAL: { trust: 62, chipFrac: 0.08, minChips: 4000, maxChips: 20_000, payMult: 9, upfrontWeeks: 16, trustGain: 5, trustLoss: 4 },
  GOV_CHAMPION: { trust: 65, chipFrac: 0.15, minChips: 10_000, maxChips: 60_000, payMult: 14, cash: 80_000, trustGain: 10, trustLoss: 6 },
  /** Sovereign Compute Buildout: permanent multiplier on chip purchase price */
  SOVEREIGN_CHIP_DISCOUNT: 0.8,

  // ---------------------------------------------------------------- govt crackdown
  /** below this govt trust the crackdown branch escalates */
  GOV_CRACKDOWN_TRUST: 30,
  /** recovering above this resets the crackdown ladder to step 0 */
  GOV_CRACKDOWN_RESET: 50,
  /** weekly chance the next crackdown step fires while eligible */
  GOV_CRACKDOWN_CHANCE: 0.35,
  /** public hearing gamble */
  HEARING_WIN_CHANCE: 0.45,
  HEARING_TRUST_GAIN: 8,
  HEARING_TRUST_LOSS: 5,
  HEARING_PUBLIC_LOSS: 6,
  /** binding regulations: runs on at least this many chips train slower */
  BINDING_REGS_CHIP_MIN: 15_000,
  BINDING_REGS_SLOWDOWN: 0.3,
  /** embedded oversight: fraction of weekly revenue burned on compliance */
  OVERSIGHT_REVENUE_CUT: 0.08,
  /** compute requisition: fraction of the fleet commandeered (pays nothing) */
  REQUISITION_FRAC: 0.2,

  // ---------------------------------------------------------------- board
  /** RIVAL weekly vote-out probability when seats <= 4, scaled by discontent above 50 */
  VOTEOUT_BASE: 0.004,
  DISCONTENT_DECAY: 0.5, // per week when things are calm
  /** weekly discontent added per hostile exec on the C-suite (board plant) */
  HOSTILE_EXEC_DISCONTENT: 0.9,

  // ---------------------------------------------------------------- people
  POACH_BASE_ODDS: 0.16,
  POACH_CHARISMA_WEIGHT: 0.004, // + per charisma point above 50
  POACH_COST_MULT: 3, // signing bonus = salary * 52 weeks * this / 52 → ~3 months... see people.ts
  /** signing-bonus premium per tier² — makes stripping top researchers costly */
  POACH_TIER_COST: 2400,
  /** public-trust hit per poach attempt — serial talent-raiding reads as hostile */
  POACH_TRUST_HIT: 4,
  NEW_STAR_MARKET_MEAN_WEEKS: 14,

  // ---------------------------------------------------------------- diplomacy
  CHARM_COST: 150,
  CHARM_COOLDOWN: 4,
  CHARM_RACE_FEAR: 4,
  SUMMIT_COST: 800,
  SUMMIT_COOLDOWN: 10,
  SUMMIT_RACE_FEAR: 6,
  ALARM_COOLDOWN: 22,
  /** trimmed from 2 when the govt ladder landed — contract cash made the alarm→pause rush too fast */
  ALARM_RISK_FEAR: 1.5,
  ALARM_PUBLIC_TRUST: 8,
  ALARM_REVENUE_HIT: 0.1, // fraction of weekly revenue lost for a while
  ALARM_REVENUE_WEEKS: 8,
  BACKCHANNEL_COST: 350,
  BACKCHANNEL_COOLDOWN: 8,
  BACKCHANNEL_RACE_FEAR: 8,
  BACKCHANNEL_LEAK_CHANCE: 0.25,
  BACKCHANNEL_LEAK_RACE_FEAR: 5,
  /**
   * treaty agreement: P = clamp((TREATY_BASE - gap * GAP_WEIGHT) * window, .02, .95)
   * gap = strongest rival cap - your cap; window closes linearly over the last
   * TREATY_ASI_WINDOW capability points before the gatekeeper reaches 100.
   */
  TREATY_BASE: 0.34,
  TREATY_GAP_WEIGHT: 0.06,
  TREATY_ASI_WINDOW: 95,
  /** weeks talks stay collapsed after a failed treaty agreement roll */
  TREATY_FAIL_COOLDOWN: 24,

  // ---------------------------------------------------------------- rival AI
  AI_RUNWAY_RAISE_AT: 20, // weeks of runway triggering a raise
  AI_TRAIN_CASH_FRAC: 0.6, // max fraction of cash an AI spends on one run
  /** fraction of uncommitted chips an AI commits to a run: BASE + aggression * AGGR */
  AI_TRAIN_COMMIT_BASE: 0.45,
  AI_TRAIN_COMMIT_AGGR: 0.2,
  /** longest run an AI signs up for to break the mid-game training wall */
  AI_RUN_WALL_WEEKS: 85,
  /**
   * Compute Cap Treaty refusal: rivals walk out if the proposer's fleet
   * exceeds the biggest rival fleet by this factor (anti cap-freeze cheese).
   */
  TREATY_CAP_FLEET_LEAD: 1.1,
} as const;

/** Date helpers: week 1 = Mon Jan 6 2025 (the game starts in week 1). */
export function weekToDate(week: number): { year: number; month: number; day: number; label: string } {
  const ms = Date.UTC(2025, 0, 6) + (week - 1) * 7 * 86400_000;
  const d = new Date(ms);
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    label: `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()} ${d.getUTCFullYear()}`,
  };
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export function clamp01(x: number): number {
  return clamp(x, 0, 1);
}

export function clamp100(x: number): number {
  return clamp(x, 0, 100);
}
