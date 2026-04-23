import React, { useState } from 'react';
import { LiveSignalDTO } from '../../services/live-signal-api';
import { Bot, Brain, CheckCircle2, Loader2, ShieldAlert, XCircle } from 'lucide-react';

interface LiveSignalsTableProps {
  signals: LiveSignalDTO[];
  onSelectSignal: (id: string) => void;
  selectedSignalId?: string;
}

const directionColors: Record<string, string> = {
  CALL: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  BUY: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PUT: 'bg-rose-50 text-rose-700 border-rose-200',
  SELL: 'bg-rose-50 text-rose-700 border-rose-200',
};

const statusColors: Record<string, string> = {
  NEW: 'bg-blue-50 text-blue-700 border-blue-200',
  MARKED_EXECUTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SKIPPED: 'bg-gray-100 text-gray-600 border-gray-200',
  EXPIRED: 'bg-orange-50 text-orange-700 border-orange-200',
  WATCHING: 'bg-yellow-50 text-yellow-700 border-yellow-200',
};

const verdictBadge: Record<string, { cls: string; label: string; icon: JSX.Element }> = {
  APPROVED: {
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    label: 'AI ONAY',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  REJECTED: {
    cls: 'bg-rose-50 text-rose-700 border-rose-200',
    label: 'AI RED',
    icon: <XCircle className="w-3 h-3" />,
  },
  UNKNOWN: {
    cls: 'bg-gray-100 text-gray-600 border-gray-200',
    label: 'PENDING',
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
};

export function LiveSignalsTable({
  signals,
  onSelectSignal,
  selectedSignalId,
}: LiveSignalsTableProps) {
  const [reasoningModal, setReasoningModal] = useState<LiveSignalDTO | null>(null);
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<any>(null);

  const base = import.meta.env.VITE_API_BASE_URL || '/api';

  const askReasoning = async (signal: LiveSignalDTO) => {
    setReasoningModal(signal);
    setResult(null);
    // If already reasoned, display cached reasoning
    const existingVerdict = (signal as any).ai_verdict;
    const existingReasoning = (signal as any).ai_reasoning;
    if (existingVerdict && existingVerdict !== 'UNKNOWN' && existingReasoning) {
      try {
        const parsed = JSON.parse(existingReasoning);
        setResult({
          verdict: existingVerdict,
          confidence: (signal as any).ai_confidence ?? 0,
          reasoning: parsed.reasoning,
          riskFactors: parsed.riskFactors || [],
          expectedWR: parsed.expectedWR,
          fromCache: true,
        });
        return;
      } catch {
        /* fall through to fresh */
      }
    }
    setAsking(true);
    try {
      const res = await fetch(`${base}/ai-coach/reason-signal/${signal.id}`, { method: 'POST' });
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setResult({ error: e?.message || 'reason failed' });
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden" data-testid="live-signals-table">
      <table className="w-full">
        <thead className="bg-slate-50 border-b">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Zaman</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Sembol</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">TF</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Yön</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Güven</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">AI</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Durum</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Not</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Açıklama</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {signals.map((signal) => {
            const verdict = ((signal as any).ai_verdict || 'UNKNOWN') as keyof typeof verdictBadge;
            const vb = verdictBadge[verdict] || verdictBadge.UNKNOWN;
            return (
              <tr
                key={signal.id}
                data-testid={`live-signal-row-${signal.id}`}
                onClick={() => onSelectSignal(signal.id)}
                className={`hover:bg-slate-50/60 cursor-pointer transition-colors ${
                  selectedSignalId === signal.id ? 'bg-blue-50' : ''
                }`}
              >
                <td className="px-4 py-3 text-sm text-gray-600 font-mono text-xs">
                  {new Date(signal.timestamp_utc).toLocaleString('tr-TR')}
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-gray-900">{signal.symbol}</td>
                <td className="px-4 py-3 text-sm text-gray-600 font-mono">{signal.timeframe}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                      directionColors[signal.direction] || 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {signal.direction}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-right font-semibold">
                  {(signal.confidence_score * 100).toFixed(1)}%
                </td>
                <td className="px-4 py-3">
                  <span
                    data-testid={`verdict-badge-${verdict}`}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${vb.cls}`}
                  >
                    {vb.icon}
                    {vb.label}
                    {(signal as any).ai_confidence > 0 && (
                      <span className="opacity-60 text-[10px]">
                        {((signal as any).ai_confidence * 100).toFixed(0)}%
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                      statusColors[signal.status] || 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {signal.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {signal.notes
                    ? signal.notes.length > 28
                      ? `${signal.notes.substring(0, 28)}…`
                      : signal.notes
                    : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    data-testid={`reason-btn-${signal.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      askReasoning(signal);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded"
                  >
                    <Brain className="w-3.5 h-3.5" />
                    Muhakeme
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {signals.length === 0 && (
        <div className="p-8 text-center text-gray-500">
          Hiç sinyal bulunamadı. Filtreleri ayarlayın veya Live Signal Mode'ın aktif olduğundan emin olun.
        </div>
      )}

      {reasoningModal && (
        <div
          data-testid="reasoning-modal"
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setReasoningModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">AI Muhakeme</div>
                  <div className="text-xs text-gray-500 font-mono">{reasoningModal.symbol} · {reasoningModal.timeframe} · {reasoningModal.direction}</div>
                </div>
              </div>
              <button
                data-testid="reasoning-modal-close"
                onClick={() => setReasoningModal(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {asking && (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
                Gemini muhakeme yapıyor…
              </div>
            )}

            {result && !asking && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold border ${
                      verdictBadge[result.verdict]?.cls ?? verdictBadge.UNKNOWN.cls
                    }`}
                  >
                    {verdictBadge[result.verdict]?.icon ?? verdictBadge.UNKNOWN.icon}
                    {result.verdict}
                  </span>
                  {typeof result.confidence === 'number' && result.confidence > 0 && (
                    <span className="text-xs text-gray-500">
                      Güven: <b>{(result.confidence * 100).toFixed(1)}%</b>
                    </span>
                  )}
                  {typeof result.expectedWR === 'number' && (
                    <span className="text-xs text-gray-500">
                      Beklenen WR: <b>{(result.expectedWR * 100).toFixed(1)}%</b>
                    </span>
                  )}
                </div>
                <div
                  data-testid="reasoning-modal-body"
                  className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-gray-800 whitespace-pre-wrap"
                >
                  {result.error
                    ? `Hata: ${result.error}`
                    : result.reasoning || '(Muhakeme metni yok)'}
                </div>
                {Array.isArray(result.riskFactors) && result.riskFactors.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                      Risk Faktörleri
                    </div>
                    <ul className="text-xs text-gray-600 space-y-1">
                      {result.riskFactors.map((r: string, i: number) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-amber-500">•</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.fromCache && (
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">Cache</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
