import { ResourceBrokerService } from '../../../trinity-oversight/resource-broker.service';

describe('ResourceBrokerService', () => {
  const origEnv = process.env.MOE_BUDGET_PCT;

  afterEach(() => {
    if (origEnv === undefined) delete process.env.MOE_BUDGET_PCT;
    else process.env.MOE_BUDGET_PCT = origEnv;
  });

  it('defaults budget to 80 when env is missing or invalid', () => {
    delete process.env.MOE_BUDGET_PCT;
    const svc = new ResourceBrokerService();
    expect(svc.getBudgetPct()).toBe(80);

    process.env.MOE_BUDGET_PCT = 'not-a-number';
    const svc2 = new ResourceBrokerService();
    expect(svc2.getBudgetPct()).toBe(80);
  });

  it('clamps budget into [10,95]', () => {
    process.env.MOE_BUDGET_PCT = '5';
    const svcLow = new ResourceBrokerService();
    expect(svcLow.getBudgetPct()).toBe(10);

    process.env.MOE_BUDGET_PCT = '999';
    const svcHigh = new ResourceBrokerService();
    expect(svcHigh.getBudgetPct()).toBe(95);
  });

  it('produces sample values within [0,100]', () => {
    process.env.MOE_BUDGET_PCT = '80';
    const svc = new ResourceBrokerService();
    // First sample is a warm-up, second gives a real CPU delta.
    svc.sample();
    const s = svc.sample();
    expect(s.cpuUsagePct).toBeGreaterThanOrEqual(0);
    expect(s.cpuUsagePct).toBeLessThanOrEqual(100);
    expect(s.memUsagePct).toBeGreaterThanOrEqual(0);
    expect(s.memUsagePct).toBeLessThanOrEqual(100);
  });

  it('requestBudget returns allowed=true when utilization is below effective budget', () => {
    process.env.MOE_BUDGET_PCT = '80';
    const svc = new ResourceBrokerService();
    // Stub sample to a low-utilization reading.
    jest.spyOn(svc, 'sample').mockReturnValue({ cpuUsagePct: 10, memUsagePct: 20 });
    const verdict = svc.requestBudget(1);
    expect(verdict.allowed).toBe(true);
    expect(verdict.budgetPct).toBe(80);
  });

  it('requestBudget denies when worst utilization exceeds budget', () => {
    process.env.MOE_BUDGET_PCT = '80';
    const svc = new ResourceBrokerService();
    jest.spyOn(svc, 'sample').mockReturnValue({ cpuUsagePct: 90, memUsagePct: 10 });
    const verdict = svc.requestBudget(1);
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toMatch(/worst_util/);
  });

  it('requestBudget with higher weight tightens effective budget', () => {
    process.env.MOE_BUDGET_PCT = '80';
    const svc = new ResourceBrokerService();
    jest.spyOn(svc, 'sample').mockReturnValue({ cpuUsagePct: 50, memUsagePct: 10 });
    // weight=1 → effective budget 80, 50 < 80 → allowed
    expect(svc.requestBudget(1).allowed).toBe(true);
    // weight=2 → effective budget 40, 50 > 40 → denied
    expect(svc.requestBudget(2).allowed).toBe(false);
  });

  it('fails closed when sample throws', () => {
    process.env.MOE_BUDGET_PCT = '80';
    const svc = new ResourceBrokerService();
    jest.spyOn(svc, 'sample').mockImplementation(() => {
      throw new Error('boom');
    });
    const verdict = svc.requestBudget(1);
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toBe('sample_failed_fail_closed');
  });
});
