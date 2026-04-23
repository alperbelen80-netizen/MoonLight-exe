import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, Bot, Loader2, RefreshCw, Sparkles, TrendingUp } from 'lucide-react';

interface DailyInsights {
  generated_at_utc: string;
  window_hours: number;
  totals: {
    signals: number;
    approved: number;
    rejected: number;
    unknown: number;
    approval_rate: number;
  };
  top_symbols: Array<{ symbol: string; count: number }>;
  top_strategies: Array<{ strategy_family: string; count: number; avgConfidence: number }>;
  regime_distribution: Record<string, number>;
  ai_summary: string;
  recommendations: string[];
}

export function AIInsightsCard() {
  const [data, setData] = useState<DailyInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = import.meta.env.VITE_API_BASE_URL || '/api';

  const load = useCallback(
    async (force = false) => {
      force ? setRefreshing(true) : setLoading(true);
      try {
        const res = await fetch(`${base}/ai-coach/daily-insights${force ? '?force=1' : ''}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as DailyInsights;
        setData(json);
        setError(null);
      } catch (e: any) {
        setError(e?.message || 'fetch failed');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [base],
  );

  useEffect(() => {
    load(false);
    const id = setInterval(() => load(false), 5 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div
      data-testid="ai-insights-card"
      className="bg-gradient-to-br from-violet-50 via-white to-blue-50 rounded-2xl border border-violet-100 shadow-sm p-5 space-y-4"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">AI Günlük İçgörü</h3>
            <p className="text-xs text-gray-500">Son {data?.window_hours ?? 24} saatin özeti</p>
          </div>
        </div>
        <button
          data-testid="ai-insights-refresh"
          onClick={() => load(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-violet-700 hover:bg-violet-50 rounded-md border border-violet-200"
        >
          {refreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Yenile
        </button>
      </div>

      {loading && !data && (
        <div className="h-32 flex items-center justify-center text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          Yükleniyor…
        </div>
      )}

      {error && !data && (
        <div className="text-sm text-amber-700 bg-amber-50 rounded p-3">{error}</div>
      )}

      {data && (
        <>
          <div
            data-testid="ai-insights-summary"
            className="bg-white/70 backdrop-blur rounded-xl p-3 text-sm text-gray-800 leading-relaxed border border-white"
          >
            <div className="flex items-start gap-2">
              <Bot className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
              <span>{data.ai_summary}</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            <Mini label="Toplam" value={String(data.totals.signals)} />
            <Mini label="Onay" value={String(data.totals.approved)} tone="emerald" />
            <Mini label="Red" value={String(data.totals.rejected)} tone="rose" />
            <Mini
              label="Onay %"
              value={`${(data.totals.approval_rate * 100).toFixed(0)}%`}
              tone="violet"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-violet-500" />
                En Aktif Semboller
              </div>
              <ul className="text-xs space-y-1">
                {data.top_symbols.slice(0, 4).map((s) => (
                  <li key={s.symbol} className="flex items-center justify-between bg-white/50 rounded px-2 py-1">
                    <span className="font-mono">{s.symbol}</span>
                    <span className="text-gray-500">{s.count}</span>
                  </li>
                ))}
                {data.top_symbols.length === 0 && <li className="text-gray-400">veri yok</li>}
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-violet-500" />
                Rejim Dağılımı
              </div>
              <ul className="text-xs space-y-1">
                {Object.entries(data.regime_distribution)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 4)
                  .map(([r, c]) => (
                    <li key={r} className="flex items-center justify-between bg-white/50 rounded px-2 py-1">
                      <span>{r}</span>
                      <span className="text-gray-500">{c}</span>
                    </li>
                  ))}
                {Object.keys(data.regime_distribution).length === 0 && (
                  <li className="text-gray-400">veri yok</li>
                )}
              </ul>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              AI Önerileri
            </div>
            <ul data-testid="ai-insights-recommendations" className="text-xs space-y-1">
              {data.recommendations.map((r, i) => (
                <li key={i} className="flex gap-2 bg-white/50 rounded px-2 py-1.5">
                  <span className="text-violet-500">{i + 1}.</span>
                  <span className="text-gray-700">{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function Mini({
  label,
  value,
  tone = 'gray',
}: {
  label: string;
  value: string;
  tone?: 'gray' | 'emerald' | 'rose' | 'violet';
}) {
  const tones: Record<string, string> = {
    gray: 'text-gray-900 bg-white/70',
    emerald: 'text-emerald-700 bg-emerald-50',
    rose: 'text-rose-700 bg-rose-50',
    violet: 'text-violet-700 bg-violet-50',
  };
  return (
    <div className={`rounded-lg px-2 py-1.5 border border-white ${tones[tone]}`}>
      <div className="text-lg font-bold leading-none">{value}</div>
      <div className="text-[10px] uppercase tracking-wider opacity-70 mt-0.5">{label}</div>
    </div>
  );
}
