import { useEffect, useState, useCallback } from 'react';
import { Power, PowerOff, Loader2, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';
import { getApiBase } from '../services/api-client';

interface BrokerSnapshot {
  brokerId: string;
  health: 'UP' | 'DEGRADED' | 'RECONNECTING' | 'COOLDOWN' | 'DOWN';
  latencyMs: number | null;
}
interface CredSummary {
  brokerId: string;
  hasCredentials: boolean;
  fields: Record<string, boolean>;
}
interface StatusResponse {
  adapters: BrokerSnapshot[];
  credentials: CredSummary[];
  mock_mode: boolean;
  generated_at_utc: string;
}

const healthTone: Record<BrokerSnapshot['health'], string> = {
  UP: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DEGRADED: 'bg-amber-50 text-amber-700 border-amber-200',
  RECONNECTING: 'bg-blue-50 text-blue-700 border-blue-200',
  COOLDOWN: 'bg-orange-50 text-orange-700 border-orange-200',
  DOWN: 'bg-slate-100 text-slate-600 border-slate-200',
};

const brokerLabel: Record<string, string> = {
  FAKE: 'FakeBroker (Sandbox)',
  IQ_OPTION: 'IQ Option',
  OLYMP_TRADE: 'Olymp Trade',
  BINOMO: 'Binomo',
  EXPERT_OPTION: 'Expert Option',
};

export function SessionManagerPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const base = getApiBase();

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${base}/broker/session/status`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStatus(data);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'fetch failed');
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [load]);

  const act = async (brokerId: string, action: 'connect' | 'disconnect') => {
    setBusy(`${brokerId}:${action}`);
    setMessage(null);
    try {
      const res = await fetch(`${base}/broker/session/${brokerId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: 'default' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({
          kind: 'err',
          text: `${brokerLabel[brokerId] ?? brokerId}: ${data.error ?? 'action failed'}`,
        });
      } else {
        setMessage({
          kind: 'ok',
          text: `${brokerLabel[brokerId] ?? brokerId}: ${action.toUpperCase()} (health=${data.health})`,
        });
      }
      await load();
    } catch (e: any) {
      setMessage({ kind: 'err', text: `${brokerId}: ${e?.message || 'fetch failed'}` });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div data-testid="session-manager-page" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Session Manager</h1>
          <p className="text-sm text-gray-500 mt-1">
            Per-broker bağlantı kontrolü, credential durumu ve canlı health takibi.
          </p>
        </div>
        {status?.mock_mode && (
          <span
            data-testid="session-mock-badge"
            className="px-3 py-1 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded"
          >
            MOCK MODE aktif
          </span>
        )}
      </div>

      {message && (
        <div
          data-testid="session-message"
          className={`rounded-lg px-4 py-3 text-sm border ${
            message.kind === 'ok'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {error && !status && (
        <div className="bg-amber-50 text-amber-700 border border-amber-200 rounded-lg px-4 py-3 text-sm">
          Status yüklenemedi: {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-5 py-3 font-semibold text-gray-700">Broker</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-700">Health</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-700">Latency</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-700">Credentials</th>
              <th className="text-right px-5 py-3 font-semibold text-gray-700">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && !status
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-5 py-4">
                      <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-4 w-20 bg-slate-100 rounded animate-pulse" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-4 w-14 bg-slate-100 rounded animate-pulse" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="h-8 w-24 bg-slate-100 rounded animate-pulse ml-auto" />
                    </td>
                  </tr>
                ))
              : status?.adapters.map((a) => {
                  const cred = status.credentials.find((c) => c.brokerId === a.brokerId);
                  const isUp = a.health === 'UP' || a.health === 'DEGRADED';
                  return (
                    <tr
                      key={a.brokerId}
                      data-testid={`session-row-${a.brokerId}`}
                      className="border-b last:border-0 hover:bg-slate-50/50"
                    >
                      <td className="px-5 py-4 font-medium text-gray-900">
                        {brokerLabel[a.brokerId] ?? a.brokerId}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium border rounded ${healthTone[a.health]}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isUp ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {a.health}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-gray-600 font-mono text-xs">
                        {a.latencyMs !== null ? `${a.latencyMs}ms` : '—'}
                      </td>
                      <td className="px-5 py-4">
                        {cred?.hasCredentials ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            configured
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                            <KeyRound className="w-3.5 h-3.5" />
                            missing
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {isUp ? (
                          <button
                            data-testid={`session-disconnect-${a.brokerId}`}
                            onClick={() => act(a.brokerId, 'disconnect')}
                            disabled={busy === `${a.brokerId}:disconnect`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white text-rose-700 border border-rose-200 rounded hover:bg-rose-50 transition-colors disabled:opacity-50"
                          >
                            {busy === `${a.brokerId}:disconnect` ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <PowerOff className="w-3.5 h-3.5" />
                            )}
                            Disconnect
                          </button>
                        ) : (
                          <button
                            data-testid={`session-connect-${a.brokerId}`}
                            onClick={() => act(a.brokerId, 'connect')}
                            disabled={busy === `${a.brokerId}:connect`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors disabled:opacity-50"
                          >
                            {busy === `${a.brokerId}:connect` ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Power className="w-3.5 h-3.5" />
                            )}
                            Connect
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium text-slate-700 mb-1">Nasıl çalışır?</p>
          <p>
            Credentials eksikse <code className="bg-slate-200 px-1 rounded text-slate-700">NOT_CONFIGURED</code> dönebilir. Kimlik bilgileri için <code>backend/.env</code>'yi güncelleyin ve backend'i restart edin. Olymp Trade için ayrıca <code>yarn add playwright</code> gerekir.
          </p>
        </div>
      </div>
    </div>
  );
}

export default SessionManagerPage;
