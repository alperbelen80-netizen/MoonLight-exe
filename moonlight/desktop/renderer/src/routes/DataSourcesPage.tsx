import { useCallback, useEffect, useState } from 'react';
import { Activity, Bot, CheckCircle2, Loader2, RefreshCw, Wand2, XCircle, Zap } from 'lucide-react';
import { getApiBase } from '../services/api-client';

interface ProviderHealth {
  name: string;
  connected: boolean;
  latencyMs: number | null;
  lastError: string | null;
  score: number;
  kind: 'LIVE' | 'WEBHOOK' | 'MOCK';
}

interface HealthResponse {
  active: string;
  deterministicChoice: string;
  providers: ProviderHealth[];
  generated_at_utc: string;
}

interface AutoSelectResponse {
  active: string;
  previous: string;
  switchedTo: string | null;
  deterministicChoice: string;
  aiValidation: {
    approved: boolean;
    chosenProvider: string;
    confidence: number;
    reason: string;
  } | null;
  reason: string;
  health: ProviderHealth[];
  ai_available: boolean;
}

const providerLabel: Record<string, string> = {
  MOCK_LIVE: 'Mock Live Feed (Sandbox)',
  BINANCE_CCXT: 'Binance (CCXT)',
  BYBIT_CCXT: 'Bybit (CCXT)',
  TRADINGVIEW: 'TradingView Webhook',
  IQ_OPTION: 'IQ Option API',
};

const kindBadge: Record<ProviderHealth['kind'], string> = {
  LIVE: 'bg-blue-50 text-blue-700 border-blue-200',
  WEBHOOK: 'bg-purple-50 text-purple-700 border-purple-200',
  MOCK: 'bg-amber-50 text-amber-700 border-amber-200',
};

export function DataSourcesPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoSelecting, setAutoSelecting] = useState(false);
  const [lastResult, setLastResult] = useState<AutoSelectResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const base = getApiBase();

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`${base}/data/providers/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHealth(data);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'fetch failed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [base]);

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  const autoSelect = async (apply: boolean) => {
    setAutoSelecting(true);
    setLastResult(null);
    try {
      const res = await fetch(`${base}/data/providers/auto-select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requireAIValidation: true, apply }),
      });
      const data = await res.json();
      setLastResult(data);
      await load();
    } catch (e: any) {
      setError(e?.message || 'auto-select failed');
    } finally {
      setAutoSelecting(false);
    }
  };

  return (
    <div data-testid="data-sources-page" className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-600" />
            Data Sources
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Veri beslemelerinin paralel sağlık kontrolü, latency skorlaması ve AI-destekli otomatik seçim.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            data-testid="data-sources-refresh-btn"
            onClick={load}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Yenile
          </button>
          <button
            data-testid="data-sources-auto-select-dry-btn"
            onClick={() => autoSelect(false)}
            disabled={autoSelecting}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-50"
          >
            <Wand2 className="w-3.5 h-3.5" />
            AI Dry-Run
          </button>
          <button
            data-testid="data-sources-auto-select-apply-btn"
            onClick={() => autoSelect(true)}
            disabled={autoSelecting}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {autoSelecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            AI Auto-Select
          </button>
        </div>
      </div>

      {lastResult && (
        <div
          data-testid="data-sources-last-result"
          className={`rounded-lg border p-4 text-sm ${
            lastResult.switchedTo
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          <div className="flex items-start gap-2">
            <Bot className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <div className="font-semibold">
                {lastResult.switchedTo
                  ? `→ Aktif provider ${lastResult.switchedTo} olarak değiştirildi`
                  : `Karar: ${lastResult.reason}`}
              </div>
              {lastResult.aiValidation && (
                <div className="text-xs opacity-80">
                  <span className="font-medium">AI (Gemini):</span>{' '}
                  {lastResult.aiValidation.approved ? '✅ onayladı' : '⛔ fail-closed'} (conf={' '}
                  {lastResult.aiValidation.confidence.toFixed(2)}) — {lastResult.aiValidation.reason}
                </div>
              )}
              {!lastResult.ai_available && (
                <div className="text-xs opacity-80">
                  AI Coach devre dışı — deterministik skora göre karar verildi.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {error && !health && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="bg-slate-50 border-b px-5 py-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-700">Providers</div>
          {health && (
            <div className="text-xs text-gray-500">
              Aktif:{' '}
              <span data-testid="data-sources-active-provider" className="font-mono text-gray-800">
                {health.active}
              </span>
              {' · '}
              Deterministik seçim:{' '}
              <span className="font-mono text-gray-800">{health.deterministicChoice}</span>
            </div>
          )}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-gray-600 uppercase tracking-wide">
            <tr>
              <th className="text-left px-5 py-2 font-semibold">Provider</th>
              <th className="text-left px-5 py-2 font-semibold">Tür</th>
              <th className="text-left px-5 py-2 font-semibold">Durum</th>
              <th className="text-left px-5 py-2 font-semibold">Latency</th>
              <th className="text-left px-5 py-2 font-semibold">Skor</th>
              <th className="text-left px-5 py-2 font-semibold">Not</th>
            </tr>
          </thead>
          <tbody>
            {loading && !health
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-5 py-3">
                        <div className="h-3 bg-slate-100 rounded animate-pulse w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              : health?.providers.map((p) => {
                  const isActive = p.name === health.active;
                  return (
                    <tr
                      key={p.name}
                      data-testid={`data-sources-row-${p.name}`}
                      className={`border-b last:border-0 hover:bg-slate-50/50 ${
                        isActive ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-900">
                          {providerLabel[p.name] || p.name}
                        </div>
                        <div className="text-xs text-gray-500 font-mono">{p.name}</div>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded ${kindBadge[p.kind]}`}
                        >
                          {p.kind}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {p.connected ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            UP
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                            <XCircle className="w-3.5 h-3.5" />
                            DOWN
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-gray-700">
                        {p.latencyMs !== null ? `${p.latencyMs}ms` : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`font-mono text-xs font-semibold ${
                            p.score > 50
                              ? 'text-emerald-700'
                              : p.score > 0
                              ? 'text-amber-700'
                              : 'text-rose-700'
                          }`}
                        >
                          {p.score.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500 max-w-md truncate" title={p.lastError || ''}>
                        {p.lastError ?? 'OK'}
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600">
        <p className="font-semibold text-slate-700 mb-1">Nasıl çalışır?</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>
            <b>AI Auto-Select</b>: Paralel sağlık koşusu → deterministik skorlama → Gemini 2.5 Flash validasyonu (fail-closed: onay conf ≥ 0.60 gerekir).
          </li>
          <li>
            <b>AI Dry-Run</b>: Switch yapmaz, AI'nın vereceği kararı önceden gösterir.
          </li>
          <li>
            <b>MOCK_LIVE</b>: Her zaman ulaşılabilir baseline; canlı provider'ların hepsi düşerse fail-safe olarak kullanılır.
          </li>
        </ul>
      </div>
    </div>
  );
}

export default DataSourcesPage;
