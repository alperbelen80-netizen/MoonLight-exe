import { ClosedLoopLearnerService } from '../../../moe-brain/learning/closed-loop-learner.service';
import { Eye2DecisionAuditorService } from '../../../trinity-oversight/eye2-decision-auditor.service';
import { Eye3TopologyGovernorService } from '../../../trinity-oversight/eye3-topology-governor.service';
import { ResourceBrokerService } from '../../../trinity-oversight/resource-broker.service';
import { SynapticRulesService } from '../../../moe-brain/synaptic/synaptic-rules.service';
import { BrainType, ExpertRole } from '../../../moe-brain/shared/moe.enums';

describe('ClosedLoopLearnerService', () => {
  let eye2: Eye2DecisionAuditorService;
  let eye3: Eye3TopologyGovernorService;
  let synaptic: SynapticRulesService;
  let learner: ClosedLoopLearnerService;

  beforeEach(() => {
    const broker = new ResourceBrokerService();
    jest.spyOn(broker, 'requestBudget').mockReturnValue({
      allowed: true,
      cpuUsagePct: 10,
      memUsagePct: 10,
      budgetPct: 80,
    });
    eye2 = new Eye2DecisionAuditorService();
    eye3 = new Eye3TopologyGovernorService(broker);
    synaptic = new SynapticRulesService();
    learner = new ClosedLoopLearnerService(eye2, eye3, synaptic);
  });

  it('refuses to run when training mode is OFF', () => {
    const r = learner.step();
    expect(r.ran).toBe(false);
    expect(r.reason).toMatch(/TRAINING_MODE_OFF/);
  });

  it('refuses to run when no audit data yet', () => {
    eye3.setTrainingMode(true);
    const r = learner.step();
    expect(r.ran).toBe(false);
    expect(r.reason).toBe('NO_AUDIT_DATA');
  });

  it('runs a learning step when training ON and audit non-empty', () => {
    eye3.setTrainingMode(true);
    eye2.record('sig-1', ['CEO_APPROVE_0.90', 'TRADE_APPROVE_0.85', 'TEST_NEUTRAL_0.40']);
    eye2.record('sig-2', ['CEO_REJECT_0.70', 'TRADE_APPROVE_0.60', 'TEST_REJECT_0.80']);
    const r = learner.step();
    expect(r.ran).toBe(true);
    expect(r.snapshots!.length).toBe(3);
    // Each snapshot has brain + priors + health ∈ [0,1]
    for (const s of r.snapshots!) {
      expect([BrainType.CEO, BrainType.TRADE, BrainType.TEST]).toContain(s.brain);
      expect(s.health).toBeGreaterThanOrEqual(0);
      expect(s.health).toBeLessThanOrEqual(1);
    }
  });

  it('updates GÖZ-3 synaptic health after step', () => {
    eye3.setTrainingMode(true);
    eye2.record('sig-1', ['CEO_APPROVE_0.90', 'TRADE_APPROVE_0.85']);
    learner.step();
    const report = eye3.report();
    expect(report.synapticHealth).toBeGreaterThan(0);
    expect(report.synapticHealth).toBeLessThanOrEqual(1);
  });

  it('honors CLOSED_LOOP_DISABLED kill switch', () => {
    process.env.CLOSED_LOOP_DISABLED = 'true';
    const local = new ClosedLoopLearnerService(eye2, eye3, synaptic);
    const r = local.step();
    expect(r.ran).toBe(false);
    expect(r.reason).toBe('CLOSED_LOOP_DISABLED');
    delete process.env.CLOSED_LOOP_DISABLED;
  });

  it('snapshot() returns priors for all 3 brains', () => {
    const snap = learner.snapshot();
    expect(snap.length).toBe(3);
    const brains = snap.map((s) => s.brain);
    expect(brains).toContain(BrainType.CEO);
    expect(brains).toContain(BrainType.TRADE);
    expect(brains).toContain(BrainType.TEST);
  });

  it('setPriors patches only specified roles', () => {
    learner.setPriors(BrainType.CEO, { [ExpertRole.TREND]: 0.9 });
    const priors = learner.getPriors(BrainType.CEO);
    expect(priors[ExpertRole.TREND]).toBe(0.9);
    expect(priors[ExpertRole.VOLATILITY]).toBeDefined(); // unchanged
  });
});
