import { BrokerScoringService } from '../../../broker/metrics/broker-scoring.service';
import { BrokerLatencyTracker } from '../../../broker/metrics/broker-latency-tracker.service';
import { PayoutMatrixService } from '../../../broker/payout/payout-matrix.service';

/**
 * V2.6-6 Routing score tuning tests.
 *
 * Confirms:
 *   - routing_score is derived from priority (not a fixed 100)
 *   - operator override via BROKER_ROUTING_PRIORITY works
 *   - unknown brokers get neutral 50
 *   - score drop is 15 points per step, floor 25
 */
describe('BrokerScoringService — routing priority (v2.6-6)', () => {
  let tracker: BrokerLatencyTracker;
  let payout: PayoutMatrixService;
  let svc: BrokerScoringService;

  beforeEach(() => {
    tracker = new BrokerLatencyTracker();
    payout = new PayoutMatrixService();
    svc = new BrokerScoringService(tracker, payout);
    delete process.env.BROKER_ROUTING_PRIORITY;
  });

  it('default priority: IQ_OPTION=100, OLYMP_TRADE=85, BINOMO=70', async () => {
    const iq = await svc.calculateBrokerScore('IQ_OPTION', 'EURUSD', 5);
    const ot = await svc.calculateBrokerScore('OLYMP_TRADE', 'EURUSD', 5);
    const bn = await svc.calculateBrokerScore('BINOMO', 'EURUSD', 5);
    expect(iq.routing_score).toBe(100);
    expect(ot.routing_score).toBe(85);
    expect(bn.routing_score).toBe(70);
  });

  it('EXPERT_OPTION=55 then FAKE=40 in default order', async () => {
    const eo = await svc.calculateBrokerScore('EXPERT_OPTION', 'EURUSD', 5);
    const fake = await svc.calculateBrokerScore('FAKE', 'EURUSD', 5);
    expect(eo.routing_score).toBe(55);
    expect(fake.routing_score).toBe(40);
  });

  it('honors BROKER_ROUTING_PRIORITY override (FAKE first)', async () => {
    process.env.BROKER_ROUTING_PRIORITY = 'FAKE,IQ_OPTION,OLYMP_TRADE';
    const fake = await svc.calculateBrokerScore('FAKE', 'EURUSD', 5);
    const iq = await svc.calculateBrokerScore('IQ_OPTION', 'EURUSD', 5);
    expect(fake.routing_score).toBe(100);
    expect(iq.routing_score).toBe(85);
  });

  it('unknown broker ids get neutral routing 50', async () => {
    const unk = await svc.calculateBrokerScore('UNKNOWN_BROKER', 'EURUSD', 5);
    expect(unk.routing_score).toBe(50);
  });

  it('floors routing score at 25 even for deep priority lists', async () => {
    process.env.BROKER_ROUTING_PRIORITY =
      'A,B,C,D,E,F,G,H,I,J,IQ_OPTION';
    const iq = await svc.calculateBrokerScore('IQ_OPTION', 'EURUSD', 5);
    expect(iq.routing_score).toBe(25);
  });
});
