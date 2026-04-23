import { ClosedLoopLearnerService } from '../../../moe-brain/learning/closed-loop-learner.service';
import { Eye2DecisionAuditorService } from '../../../trinity-oversight/eye2-decision-auditor.service';
import { Eye3TopologyGovernorService } from '../../../trinity-oversight/eye3-topology-governor.service';
import { ResourceBrokerService } from '../../../trinity-oversight/resource-broker.service';
import { SynapticRulesService } from '../../../moe-brain/synaptic/synaptic-rules.service';
import { ExpertPrior } from '../../../database/entities/expert-prior.entity';
import { BrainType, ExpertRole } from '../../../moe-brain/shared/moe.enums';

function makeRepo(rows: Partial<ExpertPrior>[] = []) {
  const state: Partial<ExpertPrior>[] = [...rows];
  return {
    find: jest.fn().mockImplementation(() => Promise.resolve([...state])),
    save: jest.fn().mockImplementation((newRows: ExpertPrior[]) => {
      for (const r of newRows) {
        const idx = state.findIndex((s) => s.id === r.id);
        if (idx >= 0) state[idx] = r;
        else state.push(r);
      }
      return Promise.resolve(newRows);
    }),
    _state: state,
  } as any;
}

function makeTrainingOn() {
  const broker = new ResourceBrokerService();
  jest.spyOn(broker, 'requestBudget').mockReturnValue({
    allowed: true,
    cpuUsagePct: 10,
    memUsagePct: 10,
    budgetPct: 80,
  });
  const eye2 = new Eye2DecisionAuditorService();
  const eye3 = new Eye3TopologyGovernorService(broker);
  eye3.setTrainingMode(true);
  return { eye2, eye3, synaptic: new SynapticRulesService() };
}

describe('ClosedLoopLearnerService · V2.4-A prior persistence', () => {
  it('onModuleInit() loads priors from DB when rows exist', async () => {
    const { eye2, eye3, synaptic } = makeTrainingOn();
    const repo = makeRepo([
      { id: 'CEO__TREND', brain: 'CEO', role: 'TREND', weight: 0.95, updated_at_utc: '' },
    ]);
    const learner = new ClosedLoopLearnerService(eye2, eye3, synaptic, repo);
    await learner.onModuleInit();
    const priors = learner.getPriors(BrainType.CEO);
    expect(priors[ExpertRole.TREND]).toBe(0.95);
  });

  it('onModuleInit() is a no-op when table empty', async () => {
    const { eye2, eye3, synaptic } = makeTrainingOn();
    const repo = makeRepo([]);
    const learner = new ClosedLoopLearnerService(eye2, eye3, synaptic, repo);
    await learner.onModuleInit();
    const priors = learner.getPriors(BrainType.CEO);
    // Default value still present
    expect(priors[ExpertRole.TREND]).toBeCloseTo(0.6);
  });

  it('step() triggers persistPriors() — upsert to DB', async () => {
    const { eye2, eye3, synaptic } = makeTrainingOn();
    const repo = makeRepo();
    const learner = new ClosedLoopLearnerService(eye2, eye3, synaptic, repo);
    eye2.record('s1', ['CEO_APPROVE_0.9', 'TREND_APPROVE']);
    const out = learner.step();
    expect(out.ran).toBe(true);
    // persist is fire-and-forget; await a tick.
    await new Promise((r) => setImmediate(r));
    expect(repo.save).toHaveBeenCalled();
    // 15 priors total (5 per brain × 3 brains)
    const savedRows = repo.save.mock.calls[0][0];
    expect(savedRows.length).toBe(15);
  });

  it('persistence disabled when CLOSED_LOOP_PERSIST=false', async () => {
    process.env.CLOSED_LOOP_PERSIST = 'false';
    const { eye2, eye3, synaptic } = makeTrainingOn();
    const repo = makeRepo();
    const learner = new ClosedLoopLearnerService(eye2, eye3, synaptic, repo);
    await learner.onModuleInit();
    eye2.record('s1', ['CODE']);
    learner.step();
    await new Promise((r) => setImmediate(r));
    expect(repo.save).not.toHaveBeenCalled();
    delete process.env.CLOSED_LOOP_PERSIST;
  });

  it('survives DB save errors without crashing', async () => {
    const { eye2, eye3, synaptic } = makeTrainingOn();
    const repo = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockRejectedValue(new Error('disk full')),
    } as any;
    const learner = new ClosedLoopLearnerService(eye2, eye3, synaptic, repo);
    eye2.record('s1', ['CODE']);
    const out = learner.step();
    expect(out.ran).toBe(true); // step still succeeds even though persist fails
    await new Promise((r) => setImmediate(r));
  });
});
