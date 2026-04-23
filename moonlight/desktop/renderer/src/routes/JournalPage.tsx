import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Filter, Loader2, RefreshCw } from 'lucide-react';

interface JournalItem {
  id: string;
  timestamp_utc: string;
  symbol: string;
  timeframe: string;
  direction: string;
  confidence_score: number;
  status: string;
  strategy_family: string;
  ai_verdict: string | null;
  ai_confidence: number | null;
  ai_reasoning: string | null;
  notes: string | null;
}

const verdictTone: Record<string, string> = {
  APPROVED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  REJECTED: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  UNKNOWN: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
};

export function JournalPage() {
  const [items, setItems] = useState<JournalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState({ symbol: '', strategy: '', verdict: '', status: '' });
  const [stats, setStats] = useState<any>(null);

  const base = import.meta.env.VITE_API_BASE_URL || '/api';

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const qs = new URLSearchParams();
      qs.append('limit', '100');
      if (filters.symbol) qs.append('symbol', filters.symbol);
      if (filters.strategy) qs.append('strategy', filters.strategy);
      if (filters.verdict) qs.append('verdict', filters.verdict);
      if (filters.status) qs.append('status', filters.status);

      const [jres, sres] = await Promise.all([
        fetch(`${base}/journal?${qs.toString()}`).then((r) => r.json()),
        fetch(`${base}/journal/stats?hours=24`).then((r) => r.json()),
      ]);
      setItems(jres.items || []);
      setStats(sres);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [base, filters]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div data-testid="journal-page" className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-600" />
            Trade Journal
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Sinyal + AI muhakeme zaman tablosu. Kaynak: son 24 saat canlı sinyal akışı.
          </p>
        </div>
        <button
          onClick={load}
          disabled={refreshing}
          data-testid="journal-refresh-btn"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50"
        >
          {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Yenile
        </button>
      </div>

      {/* Stats summary */}
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Toplam" value={stats.total ?? 0} tone="blue" />
          <StatCard label="AI Onay" value={stats.by_verdict?.APPROVED ?? 0} tone="emerald" />
          <StatCard label="AI Red" value={stats.by_verdict?.REJECTED ?? 0} tone="rose" />
          <StatCard label="AI Bekleyen" value={(stats.by_verdict?.UNKNOWN ?? 0) + (stats.by_verdict?.PENDING ?? 0)} tone="slate" />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex flex-wrap gap-2 items-center">
        <Filter className="w-3.5 h-3.5 text-slate-400" />
        <input
          data-testid="journal-filter-symbol"
          value={filters.symbol}
          onChange={(e) => setFilters({ ...filters, symbol: e.target.value.toUpperCase() })}
          placeholder="Sembol (ör. BTCUSDT)"
          className="text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-transparent outline-none focus:border-blue-500"
        />
        <input
          data-testid="journal-filter-strategy"
          value={filters.strategy}
          onChange={(e) => setFilters({ ...filters, strategy: e.target.value })}
          placeholder="Strateji (substring)"
          className="text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-transparent outline-none focus:border-blue-500"
        />
        <select
          data-testid="journal-filter-verdict"
          value={filters.verdict}
          onChange={(e) => setFilters({ ...filters, verdict: e.target.value })}
          className="text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-transparent outline-none focus:border-blue-500"
        >
          <option value="">Verdict: hepsi</option>
          <option value="APPROVED">Onay</option>
          <option value="REJECTED">Red</option>
          <option value="UNKNOWN">Bekleyen</option>
        </select>
        <select
          data-testid="journal-filter-status"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-transparent outline-none focus:border-blue-500"
        >
          <option value="">Durum: hepsi</option>
          <option value="NEW">NEW</option>
          <option value="MARKED_EXECUTED">EXECUTED</option>
          <option value="SKIPPED">SKIPPED</option>
          <option value="EXPIRED">EXPIRED</option>
        </select>
      </div>

      {/* Timeline */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Yükleniyor…</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">Filtreyle eşleşen kayıt yok.</div>
        ) : (
          <ul data-testid="journal-timeline" className="divide-y divide-slate-200 dark:divide-slate-800">
            {items.map((it) => {
              const verdict = it.ai_verdict || 'UNKNOWN';
              let reasoningText = '';
              if (it.ai_reasoning) {
                try {
                  const p = JSON.parse(it.ai_reasoning);
                  reasoningText = p.reasoning || '';
                } catch {
                  reasoningText = it.ai_reasoning;
                }
              }
              return (
                <li
                  key={it.id}
                  data-testid={`journal-entry-${it.id}`}
                  className="px-5 py-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 bg-blue-500" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {it.symbol} · {it.timeframe}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                            it.direction === 'CALL' || it.direction === 'BUY'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'
                              : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800'
                          }`}
                        >
                          {it.direction}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">
                          güven {(it.confidence_score * 100).toFixed(1)}%
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-medium border ${verdictTone[verdict]}`}
                        >
                          {verdict}
                          {it.ai_confidence !== null && it.ai_confidence !== undefined && ` ${(it.ai_confidence * 100).toFixed(0)}%`}
                        </span>
                        <span className="ml-auto text-[10px] text-slate-400 font-mono">
                          {new Date(it.timestamp_utc).toLocaleString('tr-TR')}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                        <span className="font-mono">{it.strategy_family}</span>
                        {it.notes && <span className="ml-2">· {it.notes}</span>}
                      </div>
                      {reasoningText && (
                        <div className="mt-1.5 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded px-2.5 py-1.5 border border-slate-200 dark:border-slate-700">
                          🧠 {reasoningText}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'blue' | 'emerald' | 'rose' | 'slate';
}) {
  const tones: Record<string, string> = {
    blue: 'text-blue-700 dark:text-blue-300',
    emerald: 'text-emerald-700 dark:text-emerald-300',
    rose: 'text-rose-700 dark:text-rose-300',
    slate: 'text-slate-700 dark:text-slate-300',
  };
  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
      <div className={`text-2xl font-bold ${tones[tone]}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

export default JournalPage;
