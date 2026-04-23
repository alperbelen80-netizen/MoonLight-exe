import { SelectorDriftGuard } from '../../../broker/adapters/dom-automation/dom-base';

/**
 * V2.6-5-B SelectorDriftGuard unit tests.
 *
 * Why these tests matter:
 *   - The DOM-automation layer is the blast radius for live broker trades.
 *     If selectors drift and we keep clicking, we could execute trades
 *     against wrong elements. The guard MUST soft-disable the broker
 *     after a bounded number of misses.
 *   - Hits should self-heal the counter so a *transient* broker outage
 *     doesn't permanently taint the broker.
 */
describe('SelectorDriftGuard (v2.6-5-B)', () => {
  it('soft-disables broker after auto-disable threshold misses', () => {
    const g = new SelectorDriftGuard(3);
    expect(g.isSoftDisabled('OLYMP_TRADE')).toBe(false);
    g.recordMiss('OLYMP_TRADE', 'stakeInput', '[data-test="amt"]', 'not found');
    g.recordMiss('OLYMP_TRADE', 'stakeInput', '[data-test="amt"]', 'not found');
    expect(g.isSoftDisabled('OLYMP_TRADE')).toBe(false);
    g.recordMiss('OLYMP_TRADE', 'stakeInput', '[data-test="amt"]', 'not found');
    expect(g.isSoftDisabled('OLYMP_TRADE')).toBe(true);
  });

  it('does not cross-taint other brokers', () => {
    const g = new SelectorDriftGuard(2);
    g.recordMiss('OLYMP_TRADE', 'callButton', 'x', 'gone');
    g.recordMiss('OLYMP_TRADE', 'callButton', 'x', 'gone');
    expect(g.isSoftDisabled('OLYMP_TRADE')).toBe(true);
    expect(g.isSoftDisabled('BINOMO')).toBe(false);
    expect(g.isSoftDisabled('EXPERT_OPTION')).toBe(false);
  });

  it('hits self-heal misses (halving)', () => {
    const g = new SelectorDriftGuard(10);
    for (let i = 0; i < 6; i++) {
      g.recordMiss('OLYMP_TRADE', 'stakeInput', 'x', 'miss');
    }
    const before = g.snapshot().counts['OLYMP_TRADE::stakeInput'];
    expect(before).toBe(6);
    g.recordHit('OLYMP_TRADE', 'stakeInput');
    const after = g.snapshot().counts['OLYMP_TRADE::stakeInput'];
    expect(after).toBe(3);
  });

  it('reset clears counters + soft-disable', () => {
    const g = new SelectorDriftGuard(2);
    g.recordMiss('OLYMP_TRADE', 'x', 'y', 'z');
    g.recordMiss('OLYMP_TRADE', 'x', 'y', 'z');
    expect(g.isSoftDisabled('OLYMP_TRADE')).toBe(true);
    g.reset('OLYMP_TRADE');
    expect(g.isSoftDisabled('OLYMP_TRADE')).toBe(false);
    expect(g.snapshot().counts['OLYMP_TRADE::x']).toBeUndefined();
  });

  it('snapshot emits last misses bounded at 200', () => {
    const g = new SelectorDriftGuard(999);
    for (let i = 0; i < 300; i++) {
      g.recordMiss('BINOMO', `s${i}`, 'sel', 'miss');
    }
    expect(g.snapshot().lastMisses.length).toBe(50);
  });
});
