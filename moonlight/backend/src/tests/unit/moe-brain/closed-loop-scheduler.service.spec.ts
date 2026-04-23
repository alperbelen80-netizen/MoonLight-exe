import { ClosedLoopSchedulerService } from '../../../moe-brain/learning/closed-loop-scheduler.service';
import { ClosedLoopLearnerService } from '../../../moe-brain/learning/closed-loop-learner.service';
import { Eye1SystemObserverService } from '../../../trinity-oversight/eye1-system-observer.service';
import { ResourceBrokerService } from '../../../trinity-oversight/resource-broker.service';
import { OversightVerdict } from '../../../trinity-oversight/shared/trinity.enums';

function fakeEye1(verdict: OversightVerdict): Eye1SystemObserverService {
  return {
    observe: jest.fn().mockResolvedValue({
      eye: 'EYE_1_SYSTEM_OBSERVER',
      verdict,
      budgetPct: 80,
      snapshot: {
        cpuUsagePct: 10,
        memUsagePct: 10,
        eventLoopLagMs: 1,
        queueDepth: 0,
        latencyP95Ms: 0,
        timestampUtc: new Date().toISOString(),
      },
      notes: [],
    }),
  } as unknown as Eye1SystemObserverService;
}

function fakeBroker(allow: boolean): ResourceBrokerService {
  return {
    requestBudget: jest.fn().mockReturnValue({
      allowed: allow,
      cpuUsagePct: allow ? 10 : 90,
      memUsagePct: allow ? 20 : 90,
      budgetPct: 80,
      reason: allow ? undefined : 'over budget',
    }),
    sample: jest.fn().mockReturnValue({ cpuUsagePct: 10, memUsagePct: 10 }),
    getBudgetPct: () => 80,
  } as unknown as ResourceBrokerService;
}

function fakeLearner(stepResult: { ran: boolean; reason: string; snapshots?: unknown[] }): ClosedLoopLearnerService {
  return { step: jest.fn().mockReturnValue(stepResult) } as unknown as ClosedLoopLearnerService;
}

describe('ClosedLoopSchedulerService', () => {
  const origEnv = process.env.CLOSED_LOOP_SCHEDULER_ENABLED;

  afterEach(() => {
    if (origEnv === undefined) delete process.env.CLOSED_LOOP_SCHEDULER_ENABLED;
    else process.env.CLOSED_LOOP_SCHEDULER_ENABLED = origEnv;
  });

  it('returns SCHEDULER_DISABLED when env flag is off', async () => {
    delete process.env.CLOSED_LOOP_SCHEDULER_ENABLED;
    const svc = new ClosedLoopSchedulerService(
      fakeLearner({ ran: true, reason: 'APPLIED' }),
      fakeEye1(OversightVerdict.OK),
      fakeBroker(true),
    );
    const t = await svc.tick();
    expect(t.ran).toBe(false);
    expect(t.reason).toBe('SCHEDULER_DISABLED');
    expect(svc.isEnabled()).toBe(false);
  });

  it('defers when GÖZ-1 is HALT', async () => {
    process.env.CLOSED_LOOP_SCHEDULER_ENABLED = 'true';
    const svc = new ClosedLoopSchedulerService(
      fakeLearner({ ran: true, reason: 'APPLIED' }),
      fakeEye1(OversightVerdict.HALT),
      fakeBroker(true),
    );
    const t = await svc.tick();
    expect(t.ran).toBe(false);
    expect(t.reason).toBe('EYE1_HALT');
  });

  it('defers when resource budget denies', async () => {
    process.env.CLOSED_LOOP_SCHEDULER_ENABLED = 'true';
    const svc = new ClosedLoopSchedulerService(
      fakeLearner({ ran: true, reason: 'APPLIED' }),
      fakeEye1(OversightVerdict.OK),
      fakeBroker(false),
    );
    const t = await svc.tick();
    expect(t.ran).toBe(false);
    expect(t.reason).toMatch(/^BUDGET_DENIED/);
  });

  it('delegates to learner.step() when all gates are green', async () => {
    process.env.CLOSED_LOOP_SCHEDULER_ENABLED = 'true';
    const learner = fakeLearner({
      ran: true,
      reason: 'APPLIED',
      snapshots: [1, 2, 3] as unknown[],
    });
    const svc = new ClosedLoopSchedulerService(
      learner,
      fakeEye1(OversightVerdict.OK),
      fakeBroker(true),
    );
    const t = await svc.tick();
    expect(t.ran).toBe(true);
    expect(t.reason).toBe('APPLIED');
    expect(t.brains).toBe(3);
    expect(learner.step).toHaveBeenCalledTimes(1);
  });

  it('records tick history up to maxHistory', async () => {
    process.env.CLOSED_LOOP_SCHEDULER_ENABLED = 'true';
    const svc = new ClosedLoopSchedulerService(
      fakeLearner({ ran: true, reason: 'APPLIED' }),
      fakeEye1(OversightVerdict.OK),
      fakeBroker(true),
    );
    for (let i = 0; i < 150; i++) {
      await svc.handleCron();
    }
    expect(svc.getHistory().length).toBe(100);
  });

  it('catches learner errors and reports reason', async () => {
    process.env.CLOSED_LOOP_SCHEDULER_ENABLED = 'true';
    const learner = {
      step: jest.fn().mockImplementation(() => {
        throw new Error('learner crash');
      }),
    } as unknown as ClosedLoopLearnerService;
    const svc = new ClosedLoopSchedulerService(
      learner,
      fakeEye1(OversightVerdict.OK),
      fakeBroker(true),
    );
    const t = await svc.tick();
    expect(t.ran).toBe(false);
    expect(t.reason).toMatch(/^LEARNER_ERROR/);
  });
});
