import { useEffect, useMemo, useState } from 'react';

/**
 * V2.6-2 Credentials Vault Panel.
 *
 * Renders the list of known credential keys with:
 *   - a filled/empty indicator (from `/api/secrets` masked list)
 *   - a masked preview ("****1234") when set
 *   - a form to set / overwrite / delete the value
 *
 * Talks to the backend via the `window.moonlight.vault` IPC bridge when
 * running inside Electron, and falls back to plain `fetch('/api/...')`
 * in a dev browser (no Electron). In both cases the HTTP endpoint is
 * localhost-only (enforced server-side).
 */

interface SecretItem {
  key: string;
  preview: string;
  length: number;
  backend: 'keytar' | 'file';
  updatedAtUtc: string;
}

interface VaultHealth {
  backend: 'keytar' | 'file';
  hardened: boolean;
}

// Canonical list of credential keys we expose in the Settings UI. New
// integrations append here; the backend vault itself stores arbitrary
// uppercase keys.
const KNOWN_KEYS: Array<{ key: string; label: string; group: string }> = [
  { key: 'IQ_OPTION_SSID', label: 'IQ Option SSID', group: 'IQ Option' },
  { key: 'IQ_OPTION_BALANCE_ID', label: 'IQ Option Balance ID', group: 'IQ Option' },
  { key: 'OLYMP_TRADE_EMAIL', label: 'Olymp Trade Email', group: 'Olymp Trade' },
  { key: 'OLYMP_TRADE_PASSWORD', label: 'Olymp Trade Password', group: 'Olymp Trade' },
  { key: 'BINOMO_AUTH_TOKEN', label: 'Binomo Auth Token', group: 'Binomo' },
  { key: 'BINOMO_DEVICE_ID', label: 'Binomo Device ID', group: 'Binomo' },
  { key: 'EXPERT_OPTION_TOKEN', label: 'Expert Option Token', group: 'Expert Option' },
];

// ---- Transport layer -----------------------------------------------------

interface VaultTransport {
  health(): Promise<VaultHealth>;
  list(): Promise<SecretItem[]>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

function electronTransport(): VaultTransport | null {
  const bridge = (window as unknown as { moonlight?: { vault?: unknown } })
    .moonlight?.vault as
    | {
        health: () => Promise<unknown>;
        list: () => Promise<unknown>;
        set: (k: string, v: string) => Promise<unknown>;
        delete: (k: string) => Promise<unknown>;
      }
    | undefined;
  if (!bridge) return null;
  return {
    async health() {
      const r = (await bridge.health()) as VaultHealth;
      return r;
    },
    async list() {
      const r = (await bridge.list()) as { items?: SecretItem[] };
      return r.items ?? [];
    },
    async set(key, value) {
      const r = (await bridge.set(key, value)) as { status?: number; ok?: boolean; metadata?: unknown };
      if (r && typeof r.status === 'number' && r.status >= 400) {
        throw new Error(`vault set failed (status ${r.status})`);
      }
      if (r && 'ok' in r && r.ok === false) {
        throw new Error('vault set failed');
      }
    },
    async delete(key) {
      const r = (await bridge.delete(key)) as { status?: number };
      if (r && typeof r.status === 'number' && r.status >= 400) {
        throw new Error(`vault delete failed (status ${r.status})`);
      }
    },
  };
}

function fetchTransport(): VaultTransport {
  const base =
    (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:8001';
  const headers = {
    'Content-Type': 'application/json',
    'X-Moonlight-Actor': 'desktop-ui',
  };
  return {
    async health() {
      const r = await fetch(`${base}/api/secrets/health`, { headers });
      return (await r.json()) as VaultHealth;
    },
    async list() {
      const r = await fetch(`${base}/api/secrets`, { headers });
      const j = (await r.json()) as { items: SecretItem[] };
      return j.items;
    },
    async set(key, value) {
      const r = await fetch(`${base}/api/secrets/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ value }),
      });
      if (!r.ok) throw new Error(`vault set failed (${r.status})`);
    },
    async delete(key) {
      const r = await fetch(`${base}/api/secrets/${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers,
      });
      if (!r.ok) throw new Error(`vault delete failed (${r.status})`);
    },
  };
}

// ---- Component -----------------------------------------------------------

export function CredentialsVaultPanel() {
  const transport = useMemo(() => electronTransport() ?? fetchTransport(), []);
  const [health, setHealth] = useState<VaultHealth | null>(null);
  const [items, setItems] = useState<SecretItem[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  async function refresh(): Promise<void> {
    setError(null);
    try {
      const [h, list] = await Promise.all([transport.health(), transport.list()]);
      setHealth(h);
      setItems(list);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleSave(key: string): Promise<void> {
    const value = drafts[key] ?? '';
    if (!value) {
      setError(`değer boş bırakılamaz: ${key}`);
      return;
    }
    setBusyKey(key);
    setError(null);
    try {
      await transport.set(key, value);
      setDrafts((d) => ({ ...d, [key]: '' }));
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDelete(key: string): Promise<void> {
    setBusyKey(key);
    setError(null);
    try {
      await transport.delete(key);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  const itemMap = useMemo(() => {
    const m: Record<string, SecretItem> = {};
    for (const i of items) m[i.key] = i;
    return m;
  }, [items]);

  const grouped = useMemo(() => {
    const g: Record<string, typeof KNOWN_KEYS> = {};
    for (const k of KNOWN_KEYS) {
      (g[k.group] ||= []).push(k);
    }
    return g;
  }, []);

  return (
    <div
      data-testid="credentials-vault-panel"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            Credentials Vault
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Broker ve entegrasyon gizli anahtarlarını OS keychain veya AES-256-GCM
            dosyada güvenli biçimde saklar. Değerler UI'a asla dönmez — sadece
            maskelenmiş önizleme gösterilir.
          </p>
        </div>
        {health && (
          <div
            data-testid="vault-backend-badge"
            className={`text-xs px-2 py-1 rounded ${
              health.hardened
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
            }`}
          >
            backend: {health.backend}
            {health.hardened ? ' (hardened)' : ' (file fallback)'}
          </div>
        )}
      </div>

      {error && (
        <div
          data-testid="vault-error"
          className="text-xs text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2"
        >
          {error}
        </div>
      )}

      {Object.entries(grouped).map(([group, keys]) => (
        <div key={group} className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {group}
          </h4>
          <div className="space-y-2">
            {keys.map(({ key, label }) => {
              const existing = itemMap[key];
              const busy = busyKey === key;
              return (
                <div
                  key={key}
                  data-testid={`vault-row-${key}`}
                  className="grid grid-cols-12 gap-2 items-center text-xs"
                >
                  <div className="col-span-4">
                    <div className="font-mono text-gray-900 dark:text-gray-100">
                      {key}
                    </div>
                    <div className="text-[11px] text-gray-500">{label}</div>
                  </div>
                  <div className="col-span-3 font-mono">
                    {existing ? (
                      <span
                        data-testid={`vault-preview-${key}`}
                        className="text-emerald-600 dark:text-emerald-400"
                      >
                        {existing.preview}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </div>
                  <input
                    data-testid={`vault-input-${key}`}
                    type="password"
                    className="col-span-3 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-gray-900 dark:text-gray-100"
                    placeholder={existing ? 'yeni değer' : 'değer'}
                    value={drafts[key] ?? ''}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [key]: e.target.value }))
                    }
                  />
                  <button
                    data-testid={`vault-save-${key}`}
                    disabled={busy || !(drafts[key] ?? '').length}
                    onClick={() => handleSave(key)}
                    className="col-span-1 rounded bg-blue-600 text-white px-2 py-1 disabled:opacity-40"
                  >
                    Kaydet
                  </button>
                  <button
                    data-testid={`vault-delete-${key}`}
                    disabled={busy || !existing}
                    onClick={() => handleDelete(key)}
                    className="col-span-1 rounded bg-red-600 text-white px-2 py-1 disabled:opacity-40"
                  >
                    Sil
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="text-[11px] text-gray-500 dark:text-gray-400 border-t border-slate-200 dark:border-slate-800 pt-3">
        <b>Güvenlik notları:</b> Packaged modda (
        <code>MOONLIGHT_PACKAGED=true</code>) <code>.env</code> plaintext
        değerler <b>kabul edilmez</b>. Secrets REST API yalnızca
        <code> 127.0.0.1</code>/<code>::1</code> üzerinden yanıt verir. Tüm
        işlemler audit trail'e kaydedilir (
        <code>/api/secrets/audit/trail</code>).
      </div>
    </div>
  );
}
