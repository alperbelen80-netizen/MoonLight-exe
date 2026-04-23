import { useEffect, useState } from 'react';

interface BrokerHealth {
  brokerId: string;
  health: 'UP' | 'DEGRADED' | 'RECONNECTING' | 'COOLDOWN' | 'DOWN';
  latencyMs: number | null;
}

const healthColor: Record<BrokerHealth['health'], string> = {
  UP: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DEGRADED: 'bg-amber-50 text-amber-700 border-amber-200',
  RECONNECTING: 'bg-blue-50 text-blue-700 border-blue-200',
  COOLDOWN: 'bg-orange-50 text-orange-700 border-orange-200',
  DOWN: 'bg-slate-100 text-slate-600 border-slate-200',
};

const healthDot: Record<BrokerHealth['health'], string> = {
  UP: 'bg-emerald-500',
  DEGRADED: 'bg-amber-500',
  RECONNECTING: 'bg-blue-500 animate-pulse',
  COOLDOWN: 'bg-orange-500',
  DOWN: 'bg-slate-400',
};

const brokerLabel: Record<string, string> = {
  FAKE: 'FakeBroker (sandbox)',
  IQ_OPTION: 'IQ Option',
  OLYMP_TRADE: 'Olymp Trade',
  BINOMO: 'Binomo',
  EXPERT_OPTION: 'Expert Option',
};

export function BrokerHealthPanel() {
  const [rows, setRows] = useState<BrokerHealth[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';
        const res = await fetch(`${base}/broker/adapters/health`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setRows(data.adapters || data);
        setError(null);
      } catch (err: any) {
        // Endpoint henüz backend'e eklenmediyse mock ver — Sandbox UX için.
        setRows([
          { brokerId: 'FAKE', health: 'DOWN', latencyMs: null },
          { brokerId: 'IQ_OPTION', health: 'DOWN', latencyMs: null },
          { brokerId: 'OLYMP_TRADE', health: 'DOWN', latencyMs: null },
          { brokerId: 'BINOMO', health: 'DOWN', latencyMs: null },
          { brokerId: 'EXPERT_OPTION', health: 'DOWN', latencyMs: null },
        ]);
        setError(err?.message || 'backend unreachable');
      } finally {
        setIsLoading(false);
      }
    };

    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      data-testid="broker-health-panel"
      className="bg-white rounded-xl shadow-sm p-6 border"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Broker Health</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Quad-Core Adapter durumları · 15s'de bir otomatik yenilenir
          </p>
        </div>
        {error && (
          <span
            data-testid="broker-health-offline"
            className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1"
          >
            offline · {error}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {isLoading && rows.length === 0 ? (
          <div className="text-sm text-gray-500">Yükleniyor...</div>
        ) : (
          rows.map((r) => (
            <div
              key={r.brokerId}
              data-testid={`broker-row-${r.brokerId}`}
              className={`flex items-center justify-between px-3 py-2 rounded border ${healthColor[r.health]}`}
            >
              <div className="flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full ${healthDot[r.health]}`} />
                <span className="font-medium text-sm">
                  {brokerLabel[r.brokerId] ?? r.brokerId}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs font-mono">{r.health}</span>
                <span className="text-xs text-gray-500 min-w-[60px] text-right">
                  {r.latencyMs !== null ? `${r.latencyMs}ms` : '—'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
