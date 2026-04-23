import { ResourceBrokerService } from '../../../trinity-oversight/resource-broker.service';

/**
 * V2.5-5 Resource Broker tests — Ray-simulation token bucket.
 *
 * We isolate each test by constructing a fresh service so the constructor
 * reads env cleanly. `__reset()` is exposed purely for defensive cleanup.
 */
describe('ResourceBrokerService (V2.5-5)', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('tryAcquire respects %80 budget cap on CPU tokens', () => {
    process.env.RESOURCE_CPU_TOKENS = '10';
    process.env.MOE_BUDGET_PCT = '80';
    const rb = new ResourceBrokerService();
    // cap = floor(10 * 0.80) = 8. Eight acquires succeed, ninth fails.
    const leases = [];
    for (let i = 0; i < 8; i++) {
      const l = rb.tryAcquire({ cpu: 1, ownerId: `job_${i}` });
      expect(l).not.toBeNull();
      leases.push(l!);
    }
    expect(rb.tryAcquire({ cpu: 1 })).toBeNull();

    // Release one and we can acquire again.
    rb.release(leases[0].leaseId);
    const l9 = rb.tryAcquire({ cpu: 1, ownerId: 'job_9' });
    expect(l9).not.toBeNull();
  });

  it('acquire() queues when over-budget and resolves on release', async () => {
    process.env.RESOURCE_CPU_TOKENS = '4';
    process.env.MOE_BUDGET_PCT = '80';
    const rb = new ResourceBrokerService();
    // cap = 3. Hold 3, enqueue one more, release → queued request resolves.
    const held = [
      rb.tryAcquire({ cpu: 1, ownerId: 'A' })!,
      rb.tryAcquire({ cpu: 1, ownerId: 'B' })!,
      rb.tryAcquire({ cpu: 1, ownerId: 'C' })!,
    ];
    expect(held.every((x) => x)).toBe(true);
    const queued = rb.acquire({ cpu: 1, ownerId: 'D' }, 5_000);
    expect(rb.snapshot().queueDepth).toBe(1);

    rb.release(held[0].leaseId);
    const lease = await queued;
    expect(lease).not.toBeNull();
    expect(lease!.ownerId).toBe('D');
    expect(rb.snapshot().queueDepth).toBe(0);
  });

  it('acquire() resolves null on deadline', async () => {
    process.env.RESOURCE_CPU_TOKENS = '2';
    process.env.MOE_BUDGET_PCT = '50';
    const rb = new ResourceBrokerService();
    // cap = 1. Hold it, queue another with 40ms deadline.
    const held = rb.tryAcquire({ cpu: 1, ownerId: 'A' });
    expect(held).not.toBeNull();
    const lease = await rb.acquire({ cpu: 1, ownerId: 'B' }, 40);
    expect(lease).toBeNull();
    expect(rb.snapshot().sessionTotals.rejected).toBe(1);
  });

  it('rejects requests that can never fit within budget', () => {
    process.env.RESOURCE_CPU_TOKENS = '10';
    process.env.MOE_BUDGET_PCT = '80';
    const rb = new ResourceBrokerService();
    // cap = 8. Asking for 9 is impossible → immediate null.
    expect(rb.tryAcquire({ cpu: 9 })).toBeNull();
    expect(rb.snapshot().sessionTotals.rejected).toBe(1);
  });

  it('setSimulation(true) creates 4 virtual GPUs by default', () => {
    delete process.env.RESOURCE_GPU_TOKENS;
    delete process.env.RESOURCE_SIMULATION_ENABLED;
    const rb = new ResourceBrokerService();
    expect(rb.snapshot().gpu.total).toBe(0);
    rb.setSimulation(true);
    expect(rb.snapshot().gpu.total).toBe(4);
    expect(rb.snapshot().simulationEnabled).toBe(true);
  });

  it('GPU tokens enforce the same %budget cap', () => {
    process.env.RESOURCE_GPU_TOKENS = '10';
    process.env.MOE_BUDGET_PCT = '80';
    const rb = new ResourceBrokerService();
    rb.setSimulation(true);
    // gpuCap = floor(10 * 0.80) = 8.
    for (let i = 0; i < 8; i++) {
      expect(rb.tryAcquire({ cpu: 0, gpu: 1 })).not.toBeNull();
    }
    expect(rb.tryAcquire({ cpu: 0, gpu: 1 })).toBeNull();
  });

  it('high priority request jumps queue head', async () => {
    process.env.RESOURCE_CPU_TOKENS = '2';
    process.env.MOE_BUDGET_PCT = '50';
    const rb = new ResourceBrokerService();
    const held = rb.tryAcquire({ cpu: 1, ownerId: 'A' })!;

    const p_lo = rb.acquire({ cpu: 1, ownerId: 'LOW', priority: 0 }, 5_000);
    const p_hi = rb.acquire({ cpu: 1, ownerId: 'HIGH', priority: 2 }, 5_000);

    rb.release(held.leaseId);
    const winner = await p_hi;
    expect(winner).not.toBeNull();
    expect(winner!.ownerId).toBe('HIGH');

    // Release the high-priority lease so the low-priority one can resolve.
    rb.release(winner!.leaseId);
    const nextWinner = await p_lo;
    expect(nextWinner).not.toBeNull();
    expect(nextWinner!.ownerId).toBe('LOW');
  });

  it('snapshot is self-consistent (used + free = cap)', () => {
    process.env.RESOURCE_CPU_TOKENS = '10';
    process.env.MOE_BUDGET_PCT = '80';
    const rb = new ResourceBrokerService();
    rb.tryAcquire({ cpu: 3 });
    const s = rb.snapshot();
    expect(s.cpu.used + s.cpu.free).toBe(Math.floor((10 * 80) / 100));
  });

  it('release of unknown leaseId is a no-op (never throws)', () => {
    const rb = new ResourceBrokerService();
    expect(() => rb.release('does_not_exist')).not.toThrow();
    expect(rb.release('does_not_exist')).toBe(false);
  });

  it('requestBudget() remains backward-compatible', () => {
    const rb = new ResourceBrokerService();
    // Call sample() first so we have a delta baseline.
    rb.sample();
    const verdict = rb.requestBudget(1);
    expect(typeof verdict.allowed).toBe('boolean');
    expect(verdict.budgetPct).toBeGreaterThanOrEqual(10);
    expect(verdict.budgetPct).toBeLessThanOrEqual(95);
  });
});
