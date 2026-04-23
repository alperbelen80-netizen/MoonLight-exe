import { Eye2DecisionAuditorService } from '../../../trinity-oversight/eye2-decision-auditor.service';
import { Eye3TopologyGovernorService } from '../../../trinity-oversight/eye3-topology-governor.service';
import { ResourceBrokerService } from '../../../trinity-oversight/resource-broker.service';
import { TrainingMode, OversightVerdict } from '../../../trinity-oversight/shared/trinity.enums';

describe('Eye2DecisionAuditorService', () => {
  it('records and reports reason codes', () => {
    const svc = new Eye2DecisionAuditorService();
    svc.record('sig-1', ['OK', 'TREND_UP']);
    svc.record('sig-2', ['OK', 'VOL_HIGH']);
    const r = svc.report();
    expect(r.auditedCount).toBe(2);
    expect(r.recentReasonCodes).toEqual(expect.arrayContaining(['OK']));
  });

  it('caps ring buffer to maxRecords', () => {
    const svc = new Eye2DecisionAuditorService();
    for (let i = 0; i < 700; i++) svc.record(`s${i}`, ['X']);
    // maxRecords is 500 internally
    expect(svc.report().auditedCount).toBe(500);
  });

  it('produces OK verdict when diverse reason codes', () => {
    const svc = new Eye2DecisionAuditorService();
    for (let i = 0; i < 20; i++) svc.record(`s${i}`, [`CODE_${i}`]);
    expect(svc.report().verdict).toBe(OversightVerdict.OK);
  });
});

describe('Eye3TopologyGovernorService', () => {
  function makeEye3(allowed: boolean) {
    const broker = new ResourceBrokerService();
    jest.spyOn(broker, 'requestBudget').mockReturnValue({
      allowed,
      cpuUsagePct: allowed ? 20 : 90,
      memUsagePct: 20,
      budgetPct: 80,
    });
    return { broker, eye3: new Eye3TopologyGovernorService(broker) };
  }

  it('starts with training OFF', () => {
    const { eye3 } = makeEye3(true);
    expect(eye3.getTrainingMode()).toBe(TrainingMode.OFF);
  });

  it('enables training when resource broker allows', () => {
    const { eye3 } = makeEye3(true);
    const mode = eye3.setTrainingMode(true);
    expect(mode).toBe(TrainingMode.ON);
  });

  it('pauses training when budget denies', () => {
    const { eye3 } = makeEye3(false);
    const mode = eye3.setTrainingMode(true);
    expect(mode).toBe(TrainingMode.PAUSED_BY_BUDGET);
    expect(eye3.report().verdict).toBe(OversightVerdict.WARN);
  });

  it('turns training OFF without consulting broker', () => {
    const { eye3 } = makeEye3(false);
    const mode = eye3.setTrainingMode(false);
    expect(mode).toBe(TrainingMode.OFF);
  });

  it('clamps synaptic health into [0,1]', () => {
    const { eye3 } = makeEye3(true);
    eye3.setSynapticHealth(-5);
    expect(eye3.report().synapticHealth).toBe(0);
    eye3.setSynapticHealth(99);
    expect(eye3.report().synapticHealth).toBe(1);
  });
});
