import { useCallback, useEffect, useState } from 'react';
import { Activity, Bot, Zap } from 'lucide-react';
import { getApiBase } from '../../services/api-client';

interface Status {
  available: boolean;
  model: string;
  reasoning_enabled: boolean;
  strict_guard: boolean;
  rate_limit?: { remaining: number; perMinute: number; circuitOpen: boolean };
}
interface Providers {
  active: string;
  providers: Array<{ name: string; connected: boolean }>;
}

export function StatusBar() {
  const [status, setStatus] = useState<Status | null>(null);
  const [providers, setProviders] = useState<Providers | null>(null);

  const base = getApiBase();

  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([
        fetch(`${base}/ai-coach/status`).then((r) => (r.ok ? r.json() : null)),
        fetch(`${base}/data/providers/health`).then((r) => (r.ok ? r.json() : null)),
      ]);
      if (s) setStatus(s);
      if (p) setProviders(p);
    } catch {
      // ignore
    }
  }, [base]);

  useEffect(() => {
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [load]);

  const aiOk = status?.available;
  const connectedCount = providers?.providers?.filter((p) => p.connected).length ?? 0;
  const totalProviders = providers?.providers?.length ?? 0;

  return (
    <div
      data-testid="status-bar"
      className="border-t bg-white px-4 py-1.5 flex items-center justify-between text-[11px] text-gray-500 font-mono"
    >
      <div className="flex items-center gap-4">
        <span className="inline-flex items-center gap-1">
          <span
            className={`w-1.5 h-1.5 rounded-full ${aiOk ? 'bg-emerald-500' : 'bg-gray-300'}`}
          />
          <Bot className="w-3 h-3" />
          {status?.model || 'no ai'}{' '}
          {status?.reasoning_enabled && <span className="text-violet-600">+reason</span>}
          {status?.strict_guard && <span className="text-rose-600">+guard</span>}
        </span>
        <span className="inline-flex items-center gap-1">
          <Activity className="w-3 h-3" />
          feed=<b>{providers?.active ?? '?'}</b>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          providers: {connectedCount}/{totalProviders} UP
        </span>
      </div>
      <div className="flex items-center gap-4">
        {status?.rate_limit && (
          <span className="inline-flex items-center gap-1">
            <Zap className="w-3 h-3" />
            rate: {Math.floor(status.rate_limit.remaining)}/{status.rate_limit.perMinute}/min
            {status.rate_limit.circuitOpen && (
              <span className="text-rose-600 ml-1">circuit OPEN</span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
