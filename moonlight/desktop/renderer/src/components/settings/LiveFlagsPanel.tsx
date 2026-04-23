import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * V2.6-7 Live Trading Flags Panel
 *
 * Replaces the `.env` editing workflow with in-app toggles that persist
 * to the backend vault and hot-reload without a restart.
 *
 * UX principles:
 *   - Every toggle is labeled with its real impact + safety tier.
 *   - Dangerous flags (red border) require explicit confirmation.
 *   - The "real money" flag requires typing a confirmation phrase.
 *   - An audit log of recent changes is always visible.
 *   - When the IPC bridge is absent (dev-browser) the panel degrades to
 *     read-only and shows an informational banner.
 */

interface FlagDefinition {
  name: string;
  label: string;
  description: string;
  type: 'bool' | 'number' | 'enum' | 'csv';
  default: string;
  allowedValues?: string[];
  requiresAcknowledge?: boolean;
  dangerous?: boolean;
}

interface FlagValue {
  name: string;
  value: string;
  isDefault: boolean;
  definition: FlagDefinition;
}

interface FlagAuditEntry {
  name: string;
  oldValue: string;
  newValue: string;
  actor: string;
  at: string;
}

interface BridgeFlags {
  list: () => Promise<FlagValue[] | { status: number }>;
  set: (
    name: string,
    value: string,
    actor: string,
    acknowledgeRealMoney?: boolean,
  ) => Promise<FlagValue | { status: number; body?: unknown }>;
  reset: (actor: string) => Promise<{ reset: number } | { status: number }>;
  audit: () => Promise<FlagAuditEntry[] | { status: number }>;
}

function getBridge(): BridgeFlags | null {
  const bridge = (window as unknown as { moonlight?: { flags?: BridgeFlags } })
    .moonlight?.flags;
  return bridge ?? null;
}

function unwrap<T>(raw: unknown): T | null {
  if (raw === null || raw === undefined) return null;
  if (Array.isArray(raw)) return raw as unknown as T;
  if (typeof raw === 'object') {
    const o = raw as { status?: number; body?: unknown } & Record<string, unknown>;
    if (typeof o.status === 'number' && o.status >= 200 && o.status < 300) {
      return (o.body ?? o) as T;
    }
    if (Object.prototype.hasOwnProperty.call(o, 'name') && Object.prototype.hasOwnProperty.call(o, 'value')) {
      return raw as T;
    }
  }
  return null;
}

export function LiveFlagsPanel() {
  const [flags, setFlags] = useState<FlagValue[]>([]);
  const [audit, setAudit] = useState<FlagAuditEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    flag: FlagValue;
    newValue: string;
  } | null>(null);
  const [confirmText, setConfirmText] = useState('');

  const bridge = useMemo(getBridge, []);
  const hasBridge = !!bridge;

  const refresh = useCallback(async () => {
    if (!bridge) return;
    try {
      const [f, a] = await Promise.all([bridge.list(), bridge.audit()]);
      const fv = unwrap<FlagValue[]>(f);
      const av = unwrap<FlagAuditEntry[]>(a);
      if (fv) setFlags(fv);
      if (av) setAudit(av);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [bridge]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(t);
  }, [refresh]);

  const performSet = useCallback(
    async (flag: FlagValue, newValue: string, ack = false) => {
      if (!bridge) return;
      setErr(null);
      setBusy(flag.name);
      try {
        const r = await bridge.set(flag.name, newValue, 'settings-ui', ack);
        const rv = unwrap<FlagValue>(r);
        if (!rv) {
          const raw = r as { status?: number; body?: { message?: string } };
          throw new Error(
            raw.body?.message ?? `HTTP ${raw.status ?? 'error'}`,
          );
        }
        await refresh();
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [bridge, refresh],
  );

  const onToggle = (flag: FlagValue, newValue: string) => {
    const def = flag.definition;
    const isEnablingDangerous =
      def.dangerous && newValue === 'true' && flag.value !== 'true';
    if (isEnablingDangerous) {
      setConfirmModal({ flag, newValue });
      setConfirmText('');
    } else {
      void performSet(flag, newValue, false);
    }
  };

  const confirmAndApply = () => {
    if (!confirmModal) return;
    const def = confirmModal.flag.definition;
    const ack = def.requiresAcknowledge;
    const requiredPhrase = ack ? 'ENABLE REAL MONEY' : 'CONFIRM';
    if (confirmText.trim().toUpperCase() !== requiredPhrase) {
      setErr(`Type "${requiredPhrase}" exactly to confirm.`);
      return;
    }
    const target = confirmModal;
    setConfirmModal(null);
    setConfirmText('');
    void performSet(target.flag, target.newValue, ack ?? false);
  };

  const resetAll = async () => {
    if (!bridge) return;
    if (!window.confirm('Reset all live-trading flags to safe defaults?')) return;
    setBusy('__reset__');
    try {
      await bridge.reset('settings-ui');
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      data-testid="live-flags-panel"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            Live Trading Flags
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Simülasyon → canlı işlem geçişlerini güvenli şekilde yönet. Her
            bir bayrak, vault'a şifreli olarak yazılır ve uygulamayı yeniden
            başlatmadan anında uygulanır.
          </p>
        </div>
        <button
          data-testid="flags-reset-all"
          type="button"
          onClick={resetAll}
          disabled={!hasBridge || busy !== null}
          className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap"
        >
          Reset Tümü
        </button>
      </div>

      {!hasBridge ? (
        <div className="text-xs bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 rounded p-3">
          Bu panel .exe paketinde tam çalışır. Dev tarayıcıda read-only.
        </div>
      ) : null}

      {err ? (
        <div
          data-testid="flags-error"
          className="text-xs bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-300 rounded p-3"
        >
          {err}
        </div>
      ) : null}

      <div className="space-y-3">
        {flags.map((f) => (
          <FlagRow
            key={f.name}
            flag={f}
            disabled={!hasBridge || busy !== null}
            busy={busy === f.name}
            onToggle={onToggle}
          />
        ))}
        {flags.length === 0 && hasBridge ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Flag listesi yüklenemedi. Backend ayağa kalkmış olmalı.
          </p>
        ) : null}
      </div>

      {/* Audit */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Son Değişiklikler
        </h4>
        {audit.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Henüz bir değişiklik kaydedilmedi.
          </p>
        ) : (
          <ul
            className="divide-y divide-slate-100 dark:divide-slate-800 max-h-48 overflow-auto"
            data-testid="flags-audit"
          >
            {audit.slice(0, 20).map((e, i) => (
              <li key={`${e.at}-${e.name}-${i}`} className="py-1.5 text-xs">
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {e.name}
                </span>
                <span className="ml-2 text-slate-500">{e.oldValue || '∅'}</span>
                <span className="mx-1">→</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {e.newValue || '∅'}
                </span>
                <span className="ml-2 text-slate-400">
                  by {e.actor} · {new Date(e.at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Confirm modal */}
      {confirmModal ? (
        <div
          data-testid="flags-confirm-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-md w-full p-5 space-y-4">
            <div>
              <h4 className="font-semibold text-red-600 dark:text-red-400">
                ⚠ Dangerous Flag
              </h4>
              <p className="text-sm text-slate-700 dark:text-slate-300 mt-2">
                {confirmModal.flag.definition.label} →{' '}
                <strong>{confirmModal.newValue.toUpperCase()}</strong>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {confirmModal.flag.definition.description}
              </p>
              {confirmModal.flag.definition.requiresAcknowledge ? (
                <p className="text-xs text-red-600 dark:text-red-400 mt-3 font-semibold">
                  Bu bayrak gerçek para riski taşır. Onaylamak için{' '}
                  <code className="bg-red-100 dark:bg-red-900/50 px-1 rounded">
                    ENABLE REAL MONEY
                  </code>{' '}
                  yazın.
                </p>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                  Onaylamak için{' '}
                  <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">
                    CONFIRM
                  </code>{' '}
                  yazın.
                </p>
              )}
            </div>
            <input
              data-testid="flags-confirm-input"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-sm font-mono"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={
                confirmModal.flag.definition.requiresAcknowledge
                  ? 'ENABLE REAL MONEY'
                  : 'CONFIRM'
              }
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                data-testid="flags-confirm-cancel"
                onClick={() => {
                  setConfirmModal(null);
                  setConfirmText('');
                }}
                className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 text-xs"
              >
                İptal
              </button>
              <button
                type="button"
                data-testid="flags-confirm-apply"
                onClick={confirmAndApply}
                className="px-3 py-1.5 rounded bg-red-600 text-white text-xs hover:bg-red-700"
              >
                Uygula
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FlagRow({
  flag,
  disabled,
  busy,
  onToggle,
}: {
  flag: FlagValue;
  disabled: boolean;
  busy: boolean;
  onToggle: (f: FlagValue, next: string) => void;
}) {
  const def = flag.definition;
  const dangerous = def.dangerous;

  const rowCls = dangerous
    ? 'border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20'
    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30';

  return (
    <div
      data-testid={`flag-row-${flag.name}`}
      className={`border ${rowCls} rounded p-3 flex items-start justify-between gap-4`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
            {def.label}
          </span>
          {dangerous ? (
            <span className="text-[10px] uppercase bg-red-600 text-white px-1.5 rounded">
              Danger
            </span>
          ) : null}
          {!flag.isDefault ? (
            <span className="text-[10px] uppercase bg-blue-600 text-white px-1.5 rounded">
              Custom
            </span>
          ) : null}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {def.description}
        </p>
        <p className="text-[11px] font-mono text-slate-400 mt-1">
          {def.name} = {flag.value || '∅'}
          <span className="ml-2 text-slate-500">(default: {def.default || '∅'})</span>
        </p>
      </div>
      <div className="shrink-0">
        <FlagControl
          flag={flag}
          disabled={disabled || busy}
          onChange={(v) => onToggle(flag, v)}
        />
      </div>
    </div>
  );
}

function FlagControl({
  flag,
  disabled,
  onChange,
}: {
  flag: FlagValue;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  const def = flag.definition;

  if (def.type === 'bool') {
    const on = flag.value === 'true';
    return (
      <button
        type="button"
        data-testid={`flag-toggle-${flag.name}`}
        disabled={disabled}
        onClick={() => onChange(on ? 'false' : 'true')}
        aria-pressed={on}
        className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors disabled:opacity-40 ${
          on ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform bg-white rounded-full shadow transition-transform ${
            on ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    );
  }
  if (def.type === 'enum') {
    return (
      <select
        data-testid={`flag-select-${flag.name}`}
        className="px-2 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 font-mono"
        value={flag.value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {def.allowedValues?.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    );
  }
  // number or csv — plain input with commit on blur
  return (
    <input
      data-testid={`flag-input-${flag.name}`}
      className="px-2 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 font-mono w-32"
      defaultValue={flag.value}
      onBlur={(e) => {
        if (e.target.value !== flag.value) onChange(e.target.value);
      }}
      disabled={disabled}
      placeholder={def.default || '∅'}
    />
  );
}

export default LiveFlagsPanel;
