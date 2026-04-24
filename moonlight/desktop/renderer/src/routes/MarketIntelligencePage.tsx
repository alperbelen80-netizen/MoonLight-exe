import { useCallback, useEffect, useState } from 'react';
import { Activity, Loader2, RefreshCw } from 'lucide-react';
import { getApiBase } from '../services/api-client';

interface HeatmapCell {
  symbol: string;
  timeframe: string;
  regime: string | null;
  adx: number | null;
}
interface HeatmapData {
  generated_at_utc: string;
  cells: HeatmapCell[];
  symbols: string[];
  timeframes: string[];
}
interface LeaderboardEntry {
  strategy_family: string;
  live_signal_count: number;
  ai_approved_count: number;
  ai_approval_rate: number;
  avg_confidence: number;
  last_seen_utc: string | null;
}

const regimeColor: Record<string, string> = {
  TREND: 'bg-emerald-500 text-white',
  RANGE: 'bg-blue-400 text-white',
  SHOCK: 'bg-rose-500 text-white',
  BREAKOUT: 'bg-violet-500 text-white',
  REVERSAL: 'bg-amber-500 text-white',
};

export function MarketIntelligencePage() {
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [board, setBoard] = useState<LeaderboardEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tuneFor, setTuneFor] = useState<string | null>(null);
  const [tuneResult, setTuneResult] = useState<string | null>(null);
  const [tuning, setTuning] = useState(false);

  const base = getApiBase();

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [h, l] = await Promise.all([
        fetch(`${base}/ai-coach/regime-heatmap`).then((r) => r.json()),
        fetch(`${base}/ai-coach/strategy-leaderboard`).then((r) => r.json()),
      ]);
      setHeatmap(h);
      setBoard(l.items || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [base]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const tune = async (strategyId: string) => {
    setTuneFor(strategyId);
    setTuneResult(null);
    setTuning(true);
    try {
      const r = await fetch(`${base}/ai-coach/tune-strategy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategyId }),
      }).then((r) => r.json());
      setTuneResult(r?.advice || r?.error || 'AI cevabı boş.');
    } catch (e: any) {
      setTuneResult(`Hata: ${e?.message || 'unknown'}`);
    } finally {
      setTuning(false);
    }
  };

  return (
    <div data-testid="market-intelligence-page" className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-violet-600" />
            Market Intelligence
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Piyasa rejim ısı haritası ve canlı strateji liderlik tablosu — son 2 saat / 24 saat.
          </p>
        </div>
        <button
          onClick={load}
          disabled={refreshing}
          data-testid="intel-refresh-btn"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Yenile
        </button>
      </div>

      {/* Heatmap */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b bg-slate-50">
          <div className="text-sm font-semibold text-gray-800">Rejim Heatmap (son 2 saat)</div>
        </div>
        {loading && !heatmap ? (
          <div className="p-10 text-center text-sm text-gray-400">Yükleniyor…</div>
        ) : !heatmap || heatmap.cells.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">Son 2 saatte yeterli sinyal yok.</div>
        ) : (
          <div className="overflow-x-auto p-4">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left p-2 font-semibold text-gray-600">Sembol \\ TF</th>
                  {heatmap.timeframes.map((tf) => (
                    <th key={tf} className="text-center p-2 font-mono font-semibold text-gray-600">
                      {tf}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.symbols.map((sym) => (
                  <tr key={sym}>
                    <td className="p-2 font-semibold text-gray-800">{sym}</td>
                    {heatmap.timeframes.map((tf) => {
                      const c = heatmap.cells.find((x) => x.symbol === sym && x.timeframe === tf);
                      const reg = c?.regime || null;
                      const colour = reg ? regimeColor[reg] || 'bg-slate-300 text-slate-700' : 'bg-slate-100 text-slate-400';
                      return (
                        <td key={tf} className="p-1 text-center">
                          <div
                            data-testid={`heatmap-cell-${sym}-${tf}`}
                            className={`${colour} rounded font-medium py-1.5 px-1 text-[11px] leading-tight`}
                            title={reg ? `${reg} / ADX ${c?.adx?.toFixed(1) ?? '?'}` : 'veri yok'}
                          >
                            {reg ?? '—'}
                            {c?.adx !== null && c?.adx !== undefined && (
                              <div className="text-[9px] opacity-80">ADX {c.adx.toFixed(0)}</div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b bg-slate-50">
          <div className="text-sm font-semibold text-gray-800">Strategy Leaderboard (son 24 saat)</div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-gray-600">
            <tr>
              <th className="text-left px-4 py-2 font-semibold">Strateji</th>
              <th className="text-right px-4 py-2 font-semibold">Sinyal</th>
              <th className="text-right px-4 py-2 font-semibold">AI Onay</th>
              <th className="text-right px-4 py-2 font-semibold">Onay %</th>
              <th className="text-right px-4 py-2 font-semibold">Avg Güven</th>
              <th className="text-right px-4 py-2 font-semibold">Aksiyon</th>
            </tr>
          </thead>
          <tbody>
            {(board || []).slice(0, 20).map((e) => (
              <tr key={e.strategy_family} className="border-t hover:bg-slate-50/50">
                <td className="px-4 py-2 font-mono text-xs text-gray-800">{e.strategy_family}</td>
                <td className="px-4 py-2 text-right">{e.live_signal_count}</td>
                <td className="px-4 py-2 text-right">{e.ai_approved_count}</td>
                <td
                  className={`px-4 py-2 text-right font-semibold ${
                    e.ai_approval_rate > 0.6
                      ? 'text-emerald-700'
                      : e.ai_approval_rate > 0.3
                      ? 'text-amber-700'
                      : 'text-rose-700'
                  }`}
                >
                  {(e.ai_approval_rate * 100).toFixed(1)}%
                </td>
                <td className="px-4 py-2 text-right">{(e.avg_confidence * 100).toFixed(1)}%</td>
                <td className="px-4 py-2 text-right">
                  <button
                    data-testid={`tune-btn-${e.strategy_family}`}
                    onClick={() => tune(e.strategy_family)}
                    disabled={tuning && tuneFor === e.strategy_family}
                    className="text-xs text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded px-2 py-1 disabled:opacity-50"
                  >
                    {tuning && tuneFor === e.strategy_family ? 'Analiz ediliyor…' : 'AI Tune'}
                  </button>
                </td>
              </tr>
            ))}
            {board && board.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-400">
                  Son 24 saatte strateji verisi yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {tuneFor && tuneResult && (
        <div
          data-testid="tune-result"
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setTuneFor(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="font-semibold text-gray-900">AI Tune — {tuneFor}</div>
              <button onClick={() => setTuneFor(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
                ×
              </button>
            </div>
            <div className="bg-slate-50 rounded-lg border p-3 text-sm whitespace-pre-wrap text-gray-800 max-h-[50vh] overflow-auto">
              {tuneResult}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MarketIntelligencePage;
