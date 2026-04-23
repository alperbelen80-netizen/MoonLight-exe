/**
 * MoonLight POC Core-Flow Script
 *
 * Proves the full trading pipeline works end-to-end in SANDBOX mode without
 * any real broker credentials:
 *
 *   Canonical Signal
 *        ↓
 *   EVVetoSlot Selection  (slot picking, EV calculation, payout lookup)
 *        ↓
 *   IdempotentOrderService (retry + dedupe)
 *        ↓
 *   BrokerAdapterRegistry → FakeBrokerAdapter (sandbox)
 *        ↓
 *   Broker ACK + Health Snapshot
 *        ↓
 *   JSON Output → poc-output.json
 *
 * Usage:
 *   cd backend && yarn poc:core-flow
 *
 * Exits with code 0 on success, 1 on any failure.
 */
import * as fs from 'fs';
import * as path from 'path';
import { PayoutMatrixService } from '../src/broker/payout/payout-matrix.service';
import { EVVetoSlotEngine } from '../src/strategy/evvetoslot/evvetoslot-engine.service';
import { FakeBrokerAdapter } from '../src/broker/adapters/fake-broker.adapter';
import { IdempotentOrderService } from '../src/broker/order/idempotent-order.service';
import { buildOrderKey } from '../src/broker/order/order-key.util';
import { BrokerCredentialsService } from '../src/broker/adapters/broker-credentials.service';
import { IQOptionRealAdapter } from '../src/broker/adapters/iq-option-real.adapter';
import { OlympTradePGSAdapter } from '../src/broker/adapters/olymp-trade-pgs.adapter';
import { BinomoProtocolAdapter } from '../src/broker/adapters/binomo-protocol.adapter';
import { ExpertOptionHighFreqAdapter } from '../src/broker/adapters/expert-option-highfreq.adapter';
import {
  CanonicalSignalDTO,
  SignalDirection,
  Environment,
} from '../src/shared/dto/canonical-signal.dto';
import { BrokerOrderStatus } from '../src/shared/dto/broker-order.dto';
import { SlotDecision } from '../src/strategy/evvetoslot/evvetoslot.types';

const LINE = '='.repeat(70);

function section(title: string): void {
  console.log('\n' + LINE);
  console.log(`  ${title}`);
  console.log(LINE);
}

async function main(): Promise<void> {
  const startedAt = new Date();
  const output: Record<string, any> = {
    started_at_utc: startedAt.toISOString(),
    mode: 'SANDBOX',
    steps: [],
  };

  section('MoonLight POC Core-Flow — Sandbox Sanity Run');

  // ---- Step 1: Build a canonical signal ------------------------------------
  const signal: CanonicalSignalDTO = {
    signal_id: `POC_${Date.now()}`,
    idempotency_key: `POC_KEY_${Date.now()}`,
    source: 'poc',
    symbol: 'XAUUSD',
    tf: '1m',
    ts: new Date().toISOString(),
    direction: SignalDirection.CALL,
    ev: 0.08,
    confidence_score: 0.72,
    valid_until: new Date(Date.now() + 60_000).toISOString(),
    latency_budget_ms: 200,
    schema_version: 1,
    environment: Environment.BACKTEST,
  };
  console.log('\n🔹 Step 1 — Canonical Signal:');
  console.log(`   symbol=${signal.symbol}  tf=${signal.tf}  direction=${signal.direction}`);
  console.log(`   ev=${signal.ev}  confidence=${signal.confidence_score}`);
  output.steps.push({ step: 'canonical_signal', signal });

  // ---- Step 2: EVVetoSlot selection ----------------------------------------
  const payoutMatrix = new PayoutMatrixService();
  const evEngine = new EVVetoSlotEngine(payoutMatrix);
  const slotResult = await evEngine.selectSlotForSignal(signal);

  console.log('\n🔹 Step 2 — EVVetoSlot Decision:');
  console.log(`   decision=${slotResult.decision}`);
  console.log(`   selected_expiry_minutes=${slotResult.selected_expiry_minutes}`);
  console.log(`   expected_ev=${slotResult.expected_ev.toFixed(4)}`);
  console.log(`   reason_codes=[${slotResult.reason_codes.join(', ') || '—'}]`);
  output.steps.push({ step: 'evvetoslot', result: slotResult });

  if (slotResult.decision !== SlotDecision.ACCEPT) {
    console.log('\n⚠️  Slot rejected — halting before broker dispatch (expected in some runs).');
    output.finished_at_utc = new Date().toISOString();
    output.status = 'HALTED_AT_SLOT_REJECT';
    writeOutput(output);
    process.exit(0);
  }

  // ---- Step 3: Broker registry snapshot (fake + 4 real adapters) -----------
  const creds = new BrokerCredentialsService();
  const fake = new FakeBrokerAdapter();
  const iq = new IQOptionRealAdapter(creds);
  const olymp = new OlympTradePGSAdapter(creds);
  const binomo = new BinomoProtocolAdapter(creds);
  const expert = new ExpertOptionHighFreqAdapter(creds);

  const adapters = [fake, iq, olymp, binomo, expert];

  const healthSnapshot = adapters.map((a) => ({
    brokerId: a.getBrokerId(),
    health: a.getSessionHealth(),
    lastLatencyMs: a.getLastLatencyMs ? a.getLastLatencyMs() : null,
  }));

  console.log('\n🔹 Step 3 — Broker Adapter Registry Snapshot:');
  healthSnapshot.forEach((h) => {
    console.log(`   ${h.brokerId.padEnd(16)} health=${h.health}  lastLatencyMs=${h.lastLatencyMs ?? '—'}`);
  });
  output.steps.push({ step: 'broker_health_snapshot', snapshot: healthSnapshot });

  const credentialSummary = creds.summary();
  console.log('\n🔐 Credential Vault:');
  credentialSummary.forEach((c) => {
    console.log(`   ${c.brokerId.padEnd(16)} hasCredentials=${c.hasCredentials}`);
  });
  output.steps.push({ step: 'credential_vault', summary: credentialSummary });

  // ---- Step 4: Connect to FakeBroker & send idempotent order ---------------
  await fake.connectSession('ACC_SANDBOX');

  const orderKey = buildOrderKey({
    signalId: signal.signal_id,
    accountId: 'ACC_SANDBOX',
    symbol: signal.symbol,
    expiryMinutes: slotResult.selected_expiry_minutes || 5,
  });

  const orderRequest = {
    broker_request_id: `BRQ_${Date.now()}`,
    order_key: orderKey,
    symbol: signal.symbol,
    direction: signal.direction,
    stake_amount: 25,
    expiry_minutes: slotResult.selected_expiry_minutes || 5,
    art_id: `ART_${Date.now()}`,
    account_id: 'ACC_SANDBOX',
    request_ts_utc: new Date().toISOString(),
  };

  const idempotentOrder = new IdempotentOrderService(fake);

  console.log('\n🔹 Step 4 — Sending Idempotent Order (FakeBroker):');
  const ack1 = await idempotentOrder.sendOrderIdempotent(orderRequest);
  console.log(`   [first call]  status=${ack1.status} order_id=${ack1.broker_order_id} latency=${ack1.latency_ms.toFixed(0)}ms`);
  output.steps.push({ step: 'order_first_call', ack: ack1 });

  // Re-send with same order_key → should hit the cache
  const ack2 = await idempotentOrder.sendOrderIdempotent(orderRequest);
  console.log(`   [second call] status=${ack2.status} order_id=${ack2.broker_order_id} (cached)`);
  output.steps.push({ step: 'order_second_call', ack: ack2 });

  const idempotencyOK = ack1.broker_order_id === ack2.broker_order_id;
  console.log(`   idempotent: ${idempotencyOK ? '✅ PASS' : '❌ FAIL'}`);
  output.steps.push({ step: 'idempotency_check', ok: idempotencyOK });

  // ---- Step 5: Open positions (reconciliation sanity) ----------------------
  const positions = await fake.getOpenPositions('ACC_SANDBOX');
  console.log(`\n🔹 Step 5 — Open Positions: ${positions.length}`);
  positions.forEach((p) =>
    console.log(`   pos=${p.position_id} symbol=${p.symbol} dir=${p.direction} stake=${p.stake_amount}`),
  );
  output.steps.push({ step: 'open_positions', positions });

  // ---- Step 6: Clean up ----------------------------------------------------
  await fake.disconnectSession('ACC_SANDBOX');

  // ---- Result --------------------------------------------------------------
  const allOK =
    ack1.status === BrokerOrderStatus.ACK &&
    ack2.status === BrokerOrderStatus.ACK &&
    idempotencyOK;

  output.finished_at_utc = new Date().toISOString();
  output.total_duration_ms = Date.now() - startedAt.getTime();
  output.status = allOK ? 'OK' : 'FAIL';

  writeOutput(output);

  section(allOK ? '✅ POC CORE-FLOW OK' : '❌ POC CORE-FLOW FAILED');
  console.log(`   total_duration_ms=${output.total_duration_ms}`);
  console.log(`   report: ${path.resolve('poc-output.json')}\n`);

  process.exit(allOK ? 0 : 1);
}

function writeOutput(data: any): void {
  const out = path.resolve(process.cwd(), 'poc-output.json');
  fs.writeFileSync(out, JSON.stringify(data, null, 2));
}

main().catch((err) => {
  console.error('\n❌ POC threw an unexpected error:', err);
  writeOutput({ status: 'EXCEPTION', error: String(err) });
  process.exit(1);
});
