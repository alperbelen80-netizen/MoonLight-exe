import React, { useCallback, useEffect, useState } from 'react';
import { TrinityApi, MoEApi, TrinityStatus, EnsembleWeights, BrainRoster, SynapticApi, SynapticConfigDto, LearningApi, LearningSnapshot, StrategyTemplatesApi, TemplateStats, IndicatorsApi, IndicatorStats } from '../services/trinity-api';

type LoadState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

function useAutoLoader<T>(fn: () => Promise<T>, intervalMs = 5000) {
  const [state, setState] = useState<LoadState<T>>({ data: null, loading: true, error: null });

  const load = useCallback(async () => {
    try {
      const data = await fn();
      setState({ data, loading: false, error: null });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: (err as Error).message }));
    }
  }, [fn]);

  useEffect(() => {
    let mounted = true;
    void load();
    const id = setInterval(() => {
      if (mounted) void load();
    }, intervalMs);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [load, intervalMs]);

  return { ...state, refresh: load };
}

function verdictBadge(v: string | undefined): string {
  switch (v) {
    case 'OK':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    case 'WARN':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    case 'HALT':
      return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    default:
      return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
  }
}

function trainingBadge(mode: string | undefined): string {
  switch (mode) {
    case 'ON':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    case 'OFF':
      return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
    case 'PAUSED_BY_BUDGET':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    default:
      return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
  }
}

function Panel({
  title,
  subtitle,
  verdict,
  children,
  testId,
}: {
  title: string;
  subtitle?: string;
  verdict?: string;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <section
      data-testid={testId}
      className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-5 shadow-sm"
    >
      <header className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {verdict && (
          <span
            data-testid={`${testId}-verdict`}
            className={`text-xs px-2 py-1 rounded border ${verdictBadge(verdict)}`}
          >
            {verdict}
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

function Bar({ label, value, max = 100, unit = '%', warnAt = 70, haltAt = 80 }: {
  label: string;
  value: number;
  max?: number;
  unit?: string;
  warnAt?: number;
  haltAt?: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color =
    pct >= haltAt ? 'bg-rose-500' : pct >= warnAt ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs text-slate-300 mb-1">
        <span>{label}</span>
        <span className="tabular-nums">
          {value.toFixed(1)}
          {unit}
        </span>
      </div>
      <div className="h-2 w-full rounded bg-slate-800 overflow-hidden">
        <div className={`h-full ${color} transition-all duration-300`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function TrinityPage() {
  const status = useAutoLoader<TrinityStatus>(() => TrinityApi.status(), 4000);
  const weights = useAutoLoader<EnsembleWeights>(() => MoEApi.weights(), 30000);
  const roster = useAutoLoader<BrainRoster>(() => MoEApi.roster(), 60000);
  const [busy, setBusy] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const toggleTraining = async (enabled: boolean) => {
    try {
      setBusy(true);
      const r = await TrinityApi.setTraining(enabled);
      setLastAction(`training → ${r.trainingMode}`);
      await status.refresh();
    } catch (err) {
      setLastAction(`HATA: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const applySeed = async () => {
    try {
      setBusy(true);
      const r = await MoEApi.seedApply();
      setLastAction(`seed apply: +${r.inserted} (mevcut ${r.existing}/${r.expected})`);
    } catch (err) {
      setLastAction(`HATA: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const data = status.data;
  const eye1 = data?.eye1;
  const eye2 = data?.eye2;
  const eye3 = data?.eye3;

  return (
    <div data-testid="trinity-page" className="p-6 space-y-6 text-slate-100">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trinity Oversight · MoE Konsolu</h1>
          <p className="text-sm text-slate-400">
            V2.0 evrimsel AI mimarisi — GÖZ-1 sistem, GÖZ-2 denetim, GÖZ-3 topoloji.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            data-testid="trinity-consensus-badge"
            className={`text-xs px-3 py-1.5 rounded border ${verdictBadge(data?.consensus)}`}
          >
            Consensus: {data?.consensus ?? '—'}
          </span>
          <button
            data-testid="trinity-refresh-btn"
            onClick={() => status.refresh()}
            className="text-xs px-3 py-1.5 rounded border border-slate-700/60 hover:bg-slate-800"
          >
            Yenile
          </button>
        </div>
      </header>

      {status.error && (
        <div
          data-testid="trinity-error"
          className="rounded border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200"
        >
          Trinity durumu alınamadı: {status.error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* GÖZ-1 */}
        <Panel
          title="GÖZ-1 · System Observer"
          subtitle={`Bütçe: %${eye1?.budgetPct ?? '—'} max`}
          verdict={eye1?.verdict}
          testId="eye1-panel"
        >
          {eye1 ? (
            <>
              <Bar
                label="CPU"
                value={eye1.snapshot.cpuUsagePct}
                warnAt={eye1.budgetPct * 0.85}
                haltAt={eye1.budgetPct}
              />
              <Bar
                label="Bellek"
                value={eye1.snapshot.memUsagePct}
                warnAt={eye1.budgetPct * 0.85}
                haltAt={eye1.budgetPct}
              />
              <Bar
                label="Event Loop Lag"
                value={eye1.snapshot.eventLoopLagMs}
                max={500}
                unit="ms"
                warnAt={100}
                haltAt={250}
              />
              {eye1.notes.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-slate-400">
                  {eye1.notes.map((n, i) => (
                    <li key={i} className="before:content-['•'] before:mr-2 before:text-slate-600">
                      {n}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-400">Yükleniyor…</p>
          )}
        </Panel>

        {/* GÖZ-2 */}
        <Panel
          title="GÖZ-2 · Decision Auditor"
          subtitle={`Ring buffer · ${eye2?.auditedCount ?? 0} kayıt`}
          verdict={eye2?.verdict}
          testId="eye2-panel"
        >
          {eye2 ? (
            <>
              <div className="mb-4 text-xs text-slate-300">
                Drift skoru:{' '}
                <span
                  data-testid="eye2-drift-score"
                  className={`font-mono ${eye2.driftScore >= 0.7 ? 'text-amber-300' : 'text-emerald-300'}`}
                >
                  {eye2.driftScore.toFixed(3)}
                </span>
              </div>
              <div className="text-xs text-slate-400 mb-1">Son reason code'ları:</div>
              <div className="flex flex-wrap gap-1">
                {eye2.recentReasonCodes.length === 0 && (
                  <span className="text-xs text-slate-500">Henüz veri yok.</span>
                )}
                {eye2.recentReasonCodes.map((c) => (
                  <span
                    key={c}
                    className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400">Yükleniyor…</p>
          )}
        </Panel>

        {/* GÖZ-3 */}
        <Panel
          title="GÖZ-3 · Topology Governor"
          subtitle={`Training modu ${eye3?.trainingMode ?? '—'}`}
          verdict={eye3?.verdict}
          testId="eye3-panel"
        >
          {eye3 ? (
            <>
              <div className="flex items-center gap-2 mb-4">
                <span
                  data-testid="eye3-training-mode"
                  className={`text-xs px-2 py-1 rounded border ${trainingBadge(eye3.trainingMode)}`}
                >
                  {eye3.trainingMode}
                </span>
                <span className="text-xs text-slate-400">
                  Sinaptik sağlık:{' '}
                  <span className="font-mono text-slate-200">{eye3.synapticHealth.toFixed(3)}</span>
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  data-testid="training-enable-btn"
                  onClick={() => toggleTraining(true)}
                  disabled={busy}
                  className="text-xs px-3 py-1.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  Training Aç
                </button>
                <button
                  data-testid="training-disable-btn"
                  onClick={() => toggleTraining(false)}
                  disabled={busy}
                  className="text-xs px-3 py-1.5 rounded border border-slate-500/40 bg-slate-500/10 text-slate-200 hover:bg-slate-500/20 disabled:opacity-50"
                >
                  Training Kapat
                </button>
              </div>
              {eye3.notes.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-slate-400">
                  {eye3.notes.map((n, i) => (
                    <li key={i} className="before:content-['•'] before:mr-2 before:text-slate-600">
                      {n}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-400">Yükleniyor…</p>
          )}
        </Panel>
      </div>

      {/* Global Ensemble Weights + Roster + Seed Apply */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel
          title="Global MoE · Ensemble Ağırlıkları"
          subtitle="CEO / TRADE / TEST — consensus hard veto TEST’tedir"
          testId="ensemble-weights-panel"
        >
          {weights.data ? (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>CEO-MoE</span>
                  <span className="font-mono">{(weights.data.ceo * 100).toFixed(1)}%</span>
                </div>
                <div className="h-2 w-full rounded bg-slate-800">
                  <div
                    className="h-full bg-indigo-500"
                    style={{ width: `${weights.data.ceo * 100}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>TRADE-MoE</span>
                  <span className="font-mono">{(weights.data.trade * 100).toFixed(1)}%</span>
                </div>
                <div className="h-2 w-full rounded bg-slate-800">
                  <div
                    className="h-full bg-cyan-500"
                    style={{ width: `${weights.data.trade * 100}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>TEST-MoE</span>
                  <span className="font-mono">{(weights.data.test * 100).toFixed(1)}%</span>
                </div>
                <div className="h-2 w-full rounded bg-slate-800">
                  <div
                    className="h-full bg-rose-500"
                    style={{ width: `${weights.data.test * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Ağırlıklar yükleniyor…</p>
          )}
        </Panel>

        <Panel
          title="Roster · 3×5 Uzman Kadrosu"
          subtitle="CEO/TRADE = Gemini + deterministik fallback · TEST = saf deterministik"
          testId="roster-panel"
        >
          {roster.data ? (
            <div className="grid grid-cols-3 gap-4 text-xs">
              {(['CEO', 'TRADE', 'TEST'] as const).map((b) => (
                <div key={b}>
                  <div className="text-slate-400 uppercase tracking-wider mb-1">{b}</div>
                  <ul className="space-y-1">
                    {roster.data![b].map((r) => (
                      <li
                        key={r}
                        className="text-slate-200 bg-slate-800/60 px-2 py-1 rounded border border-slate-700/60"
                      >
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">Roster yükleniyor…</p>
          )}
          <div className="mt-4 flex gap-2 items-center">
            <button
              data-testid="seed-apply-btn"
              onClick={applySeed}
              disabled={busy}
              className="text-xs px-3 py-1.5 rounded border border-slate-500/40 bg-slate-500/10 text-slate-100 hover:bg-slate-500/20 disabled:opacity-50"
            >
              38×7 Ürün Seed Uygula
            </button>
            {lastAction && (
              <span data-testid="trinity-last-action" className="text-xs text-slate-400">
                {lastAction}
              </span>
            )}
          </div>
        </Panel>
      </div>

      {/* V2.1 — Learning + Synaptic + Template Stats */}
      <LearningAndTemplatesSection />
    </div>
  );
}

function LearningAndTemplatesSection() {
  const snap = useAutoLoader<LearningSnapshot[]>(() => LearningApi.snapshot(), 15000);
  const cfg = useAutoLoader<SynapticConfigDto>(() => SynapticApi.getConfig(), 30000);
  const tpl = useAutoLoader<TemplateStats>(() => StrategyTemplatesApi.stats(), 30000);
  const indStats = useAutoLoader<IndicatorStats>(() => IndicatorsApi.stats(), 60000);
  const [runMsg, setRunMsg] = React.useState<string | null>(null);
  const [running, setRunning] = React.useState(false);

  const runStep = async () => {
    try {
      setRunning(true);
      const r = await LearningApi.step();
      setRunMsg(r.ran ? `OK: ${r.snapshots?.length ?? 0} beyin güncellendi` : `beklemede: ${r.reason}`);
      await snap.refresh();
    } catch (err) {
      setRunMsg(`HATA: ${(err as Error).message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Closed-loop learning */}
      <section
        data-testid="learning-snapshot-panel"
        className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-5"
      >
        <header className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Closed-Loop Learning</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              GÖZ-2 audit → Hebbian / Anti-Hebbian → beyin prior'ları
            </p>
          </div>
          <button
            data-testid="learning-step-btn"
            onClick={runStep}
            disabled={running}
            className="text-xs px-3 py-1.5 rounded border border-indigo-500/40 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20 disabled:opacity-50"
          >
            Öğrenme Adımı Çalıştır
          </button>
        </header>
        {runMsg && (
          <div
            data-testid="learning-step-message"
            className="text-xs text-slate-300 mb-3 font-mono"
          >
            {runMsg}
          </div>
        )}
        {snap.data ? (
          <div className="space-y-3">
            {snap.data.map((s) => (
              <div
                key={s.brain}
                data-testid={`learning-brain-${s.brain}`}
                className="rounded border border-slate-700/60 p-3 bg-slate-800/30"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-100">{s.brain}-MoE</span>
                  <span className="text-xs text-slate-400 font-mono">
                    sağlık: {s.health.toFixed(3)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(s.priors).map(([role, w]) => (
                    <span
                      key={role}
                      className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700 font-mono"
                    >
                      {role}: {Number(w).toFixed(2)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Yükleniyor…</p>
        )}
      </section>

      {/* Synaptic config */}
      <section
        data-testid="synaptic-config-panel"
        className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-5"
      >
        <header className="mb-3">
          <h2 className="text-lg font-semibold text-slate-100">Synaptic Kurallar</h2>
          <p className="text-xs text-slate-400 mt-0.5">6 kural · guardrail'li öğrenme parametreleri</p>
        </header>
        {cfg.data ? (
          <dl className="grid grid-cols-2 gap-2 text-xs">
            {Object.entries(cfg.data).map(([k, v]) => (
              <div
                key={k}
                className="flex justify-between rounded px-2 py-1 bg-slate-800/40 border border-slate-700/50"
              >
                <dt className="text-slate-400">{k}</dt>
                <dd className="font-mono text-slate-100">
                  {typeof v === 'number' ? v.toFixed(3) : String(v)}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-slate-400">Yükleniyor…</p>
        )}
      </section>

      {/* Template + indicator stats */}
      <section
        data-testid="templates-stats-panel"
        className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-5"
      >
        <header className="mb-3">
          <h2 className="text-lg font-semibold text-slate-100">Strategy Templates</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            100 indikatör + 100 şablon · Strategy Factory'ye enjekte
          </p>
        </header>
        {tpl.data ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Toplam kayıtlı strateji:</span>
              <span className="font-mono text-slate-100">{tpl.data.registeredTotal}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Implemented şablon:</span>
              <span className="font-mono text-emerald-300">{tpl.data.implemented}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Dormant şablon:</span>
              <span className="font-mono text-slate-400">{tpl.data.dormant}</span>
            </div>
            <div className="h-2 w-full rounded bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${(tpl.data.implemented / Math.max(1, tpl.data.total)) * 100}%` }}
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Yükleniyor…</p>
        )}

        {indStats.data && (
          <div className="mt-4 pt-3 border-t border-slate-700/50">
            <div className="text-xs text-slate-400 mb-2">İndikatör aile dağılımı (top 5):</div>
            <div className="flex flex-wrap gap-1" data-testid="indicator-family-counts">
              {Object.entries(indStats.data.familyCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([f, c]) => (
                  <span
                    key={f}
                    className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
                  >
                    {f}: {c}
                  </span>
                ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default TrinityPage;
