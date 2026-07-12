import { describe, expect, it } from 'vitest';
import { abortTrainingRun, fundraise, orderChips, promoteModel, respondToEvent, setAlignmentCompute, setLicensePrice, startPostTraining, startTrainingRun } from './actions';
import { BAL } from './balance';
import { newGame } from './init';
import { advanceWeek } from './tick';
import { flagship, trainCost } from './model';

describe('training runs', () => {
  it('start pays the up-front share and rejects a second run', () => {
    const state = newGame('helios', 1);
    const lab = state.labs.helios;
    lab.cash = 5000;
    const cost = trainCost(lab, 2e27);
    const res = startTrainingRun(state, lab, 2e27, 8000);
    expect(res.ok).toBe(true);
    expect(lab.cash).toBeCloseTo(5000 - cost * BAL.TRAIN_UPFRONT_FRAC, 5);
    expect(lab.run!.costTotal).toBeCloseTo(cost, 5);
    expect(lab.run!.costPaid).toBeCloseTo(cost * BAL.TRAIN_UPFRONT_FRAC, 5);
    expect(startTrainingRun(state, lab, 1e27, 2000).ok).toBe(false);
  });

  it('rejects unaffordable runs', () => {
    const state = newGame('helios', 1);
    const lab = state.labs.helios;
    lab.cash = 10;
    expect(startTrainingRun(state, lab, 5e27, 8000).ok).toBe(false);
  });

  it('rejects committing more chips than are free, and squeezes alignment last', () => {
    const state = newGame('helios', 1);
    const lab = state.labs.helios;
    lab.cash = 100_000;
    expect(startTrainingRun(state, lab, 1e27, lab.chips + 1).ok).toBe(false);
    setAlignmentCompute(lab, 2000);
    expect(startTrainingRun(state, lab, 1e27, lab.chips).ok).toBe(true);
    expect(lab.run!.chips).toBe(lab.chips);
    expect(lab.alloc.alignment).toBe(0);
    expect(lab.alloc.inference).toBe(0);
  });

  it('freed chips flow back to inference on abort', () => {
    const state = newGame('helios', 1);
    const lab = state.labs.helios;
    lab.cash = 100_000;
    setAlignmentCompute(lab, 1000);
    startTrainingRun(state, lab, 1e27, 8000);
    const inferenceDuring = lab.alloc.inference;
    abortTrainingRun(state, lab);
    expect(lab.alloc.inference).toBe(inferenceDuring + 8000);
    expect(lab.alloc.alignment).toBe(1000);
  });

  it('progresses weekly, finishes, and auto-promotes the new model to flagship', () => {
    const state = newGame('helios', 2);
    const lab = state.labs.helios;
    lab.cash = 100_000;
    startTrainingRun(state, lab, 12_000 * BAL.FLOP_PER_CHIP_WEEK * 10, 12_000);
    const flagshipBefore = lab.flagshipId;
    const run = lab.run!;
    for (let i = 0; i < 30 && lab.run; i++) {
      state.pendingEvents = [];
      advanceWeek(state);
    }
    expect(lab.run).toBeNull();
    expect(run.costPaid).toBeCloseTo(run.costTotal, 5); // weekly payments settle the full cost by completion
    expect(lab.models.length).toBe(2);
    expect(lab.flagshipId).not.toBe(flagshipBefore); // fresh model takes over automatically
    expect(lab.flagshipId).toBe(lab.models[1].id);
  });

  it('abort salvages a weak model and frees the run slot', () => {
    const state = newGame('helios', 3);
    const lab = state.labs.helios;
    lab.cash = 100_000;
    startTrainingRun(state, lab, 10_000 * BAL.FLOP_PER_CHIP_WEEK * 60, 10_000);
    for (let i = 0; i < 5; i++) {
      state.pendingEvents = [];
      advanceWeek(state);
    }
    const est = lab.run!.estCapability;
    const res = abortTrainingRun(state, lab);
    expect(res.ok).toBe(true);
    expect(lab.run).toBeNull();
    const salvaged = lab.models[lab.models.length - 1];
    expect(salvaged.capability).toBeLessThan(est * 0.2);
  });
});

describe('promote & post-train', () => {
  it('promotes a vault model', () => {
    const state = newGame('helios', 1);
    const lab = state.labs.helios;
    const m = { ...lab.models[0], id: 'x2', name: 'HELIOS-X' };
    lab.models.push(m);
    expect(promoteModel(lab, 'x2').ok).toBe(true);
    expect(flagship(lab)!.name).toBe('HELIOS-X');
  });

  it('post-training commits chips, refuses to run twice, and runs alongside a training run', () => {
    const state = newGame('helios', 1);
    const lab = state.labs.helios;
    lab.cash = 100_000;
    const inferenceBefore = lab.alloc.inference;
    expect(startPostTraining(lab).ok).toBe(true);
    expect(lab.postTraining!.chips).toBe(BAL.POST_TRAIN_CHIPS);
    expect(lab.alloc.inference).toBe(inferenceBefore - BAL.POST_TRAIN_CHIPS);
    expect(startPostTraining(lab).ok).toBe(false); // already running
    lab.postTraining = null;
    startTrainingRun(state, lab, 1e27, 5000);
    expect(startPostTraining(lab).ok).toBe(true); // independent commitment, run active is fine
    expect(lab.alloc.inference + lab.alloc.alignment).toBe(lab.chips - 5000 - BAL.POST_TRAIN_CHIPS);
  });
});

describe('chips & pricing', () => {
  it('orders cost cash now and arrive later', () => {
    const state = newGame('helios', 1);
    const lab = state.labs.helios;
    lab.cash = 10_000;
    const chipsBefore = lab.chips;
    const res = orderChips(state, lab, 5000);
    expect(res.ok).toBe(true);
    expect(lab.chips).toBe(chipsBefore); // not yet delivered
    expect(lab.chipOrders).toHaveLength(1);
    const arrival = lab.chipOrders[0].arrivesWeek;
    while (state.week < arrival) {
      state.pendingEvents = [];
      advanceWeek(state);
    }
    expect(lab.chips).toBeGreaterThanOrEqual(chipsBefore + 5000);
  });

  it('PRC labs pay more for chips', () => {
    const state = newGame('helios', 1);
    state.labs.tianshu.cash = 10_000;
    state.labs.helios.cash = 10_000;
    orderChips(state, state.labs.helios, 1000);
    orderChips(state, state.labs.tianshu, 1000);
    const usSpent = 10_000 - state.labs.helios.cash;
    const prcSpent = 10_000 - state.labs.tianshu.cash;
    expect(prcSpent).toBeGreaterThan(usSpent * 1.3);
  });

  it('license price is bounded', () => {
    const state = newGame('helios', 1);
    expect(setLicensePrice(state.labs.helios, 0).ok).toBe(false);
    expect(setLicensePrice(state.labs.helios, 30).ok).toBe(true);
  });
});

describe('fundraise action', () => {
  it('respects the cooldown', () => {
    const state = newGame('helios', 1);
    const lab = state.labs.helios;
    expect(fundraise(state, lab, 'small').ok).toBe(true);
    expect(fundraise(state, lab, 'small').ok).toBe(false);
    state.week += BAL.RAISE_COOLDOWN;
    expect(fundraise(state, lab, 'small').ok).toBe(true);
  });
});

describe('event responses', () => {
  it('resolves the oldest pending event and unpauses', () => {
    const state = newGame('helios', 1);
    state.pendingEvents.push({
      eventId: 'eu-usb-c',
      labId: 'helios',
      week: state.week,
      title: 'EU mandates USB-C on datacenters',
      body: '...',
      choices: [
        { id: 'comply', label: 'Retrofit the racks', detail: '' },
        { id: 'contest', label: 'Contest it', detail: '' },
      ],
      data: {},
    });
    const cash = state.labs.helios.cash;
    const res = respondToEvent(state, 'comply');
    expect(res.ok).toBe(true);
    expect(state.pendingEvents).toHaveLength(0);
    expect(state.labs.helios.cash).toBe(cash); // EU events are pure theater
  });
});
