import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * V2.6-4 About / Updates / Crash History Panel.
 *
 * Three sub-sections stacked in a single card:
 *   1. App + backend version info.
 *   2. Auto-update controls (check / download / install) backed by
 *      `window.moonlight.updater` IPC bridge (electron-updater).
 *   3. Crash history — both local desktop events and backend-reported
 *      events from /api/crash/reports.
 *
 * All methods are no-ops outside Electron; in a plain-browser dev run
 * the panel renders informational placeholders and disables actions.
 */

interface UpdateStatus {
  available: boolean;
  reason: string | null;
  state:
    | 'idle'
    | 'checking'
    | 'not-available'
    | 'available'
    | 'downloading'
    | 'downloaded'
    | 'error'
    | 'disabled';
  currentVersion: string;
  latestVersion: string | null;
  downloadPercent: number;
  lastError: string | null;
  lastCheckedAtMs: number | null;
  updateChannel: string;
  feedUrl: string | null;
}

interface CrashEvent {
  id: string;
  at: string;
  kind: string;
  message: string;
  context: Record<string, unknown>;
}

interface BackendCrashReport extends CrashEvent {
  source: 'desktop' | 'backend' | 'renderer';
  receivedAtUtc: string;
}

function hasWindowBridge(): boolean {
  return typeof window !== 'undefined' && Boolean(
    (window as unknown as { moonlight?: unknown }).moonlight,
  );
}

function getBridge() {
  return (window as unknown as {
    moonlight?: {
      updater?: {
        status: () => Promise<UpdateStatus>;
        check: () => Promise<UpdateStatus>;
        download: () => Promise<UpdateStatus>;
        install: () => Promise<UpdateStatus>;
        onStatus: (cb: (s: UpdateStatus) => void) => () => void;
      };
      crash?: {
        status: () => Promise<{
          enabled: boolean;
          uploadUrl: string | null;
          historyFile: string | null;
          historyCount: number;
        }>;
        history: (limit?: number) => Promise<CrashEvent[]>;
        backendReports: (limit?: number) => Promise<{
          status?: number;
          [k: string]: unknown;
        } | BackendCrashReport[]>;
        onEvent: (cb: (e: CrashEvent) => void) => () => void;
      };
    };
  }).moonlight;
}

const STATE_LABEL: Record<UpdateStatus['state'], string> = {
  idle: 'Hazır',
  checking: 'Kontrol ediliyor…',
  'not-available': 'Güncel',
  available: 'Güncelleme mevcut',
  downloading: 'İndiriliyor…',
  downloaded: 'İndirildi — kurulum hazır',
  error: 'Hata',
  disabled: 'Devre dışı (dev / flag)',
};

const STATE_COLOR: Record<UpdateStatus['state'], string> = {
  idle: 'text-slate-500',
  checking: 'text-blue-500',
  'not-available': 'text-emerald-500',
  available: 'text-amber-500',
  downloading: 'text-blue-500',
  downloaded: 'text-emerald-500',
  error: 'text-red-500',
  disabled: 'text-slate-400',
};

export function AboutPanel() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [desktopCrashes, setDesktopCrashes] = useState<CrashEvent[]>([]);
  const [backendCrashes, setBackendCrashes] = useState<BackendCrashReport[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const bridge = useMemo(getBridge, []);
  const hasBridge = hasWindowBridge();

  const refresh = useCallback(async () => {
    if (!hasBridge || !bridge?.updater || !bridge?.crash) return;
    try {
      const [s, h, br] = await Promise.all([
        bridge.updater.status(),
        bridge.crash.history(50),
        bridge.crash.backendReports(50),
      ]);
      setStatus(s);
      setDesktopCrashes(Array.isArray(h) ? h : []);
      // Backend call may return {status, ...payload} shape from safeJson.
      if (Array.isArray(br)) {
        setBackendCrashes(br as BackendCrashReport[]);
      } else if (br && typeof br === 'object') {
        // Could be either wrapped result or list — try best-effort extract.
        const maybe = (br as { status?: number } & Record<string, unknown>).status;
        // If server returned an array in body, it'd be parsed — else ignore.
        const values = Object.values(br).find((v) => Array.isArray(v));
        if (values && Array.isArray(values)) {
          setBackendCrashes(values as BackendCrashReport[]);
        } else if (typeof maybe === 'number' && maybe >= 200 && maybe < 300) {
          setBackendCrashes([]);
        }
      }
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [bridge, hasBridge]);

  useEffect(() => {
    void refresh();
    if (!hasBridge || !bridge?.updater || !bridge?.crash) return;
    const off1 = bridge.updater.onStatus((s) => setStatus(s));
    const off2 = bridge.crash.onEvent(() => {
      void refresh();
    });
    const t = setInterval(() => void refresh(), 10_000);
    return () => {
      off1?.();
      off2?.();
      clearInterval(t);
    };
  }, [bridge, hasBridge, refresh]);

  const runAction = async (fn: () => Promise<UpdateStatus>) => {
    setErr(null);
    setWorking(true);
    try {
      const r = await fn();
      setStatus(r);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setWorking(false);
    }
  };

  const lastChecked = status?.lastCheckedAtMs
    ? new Date(status.lastCheckedAtMs).toLocaleString()
    : '—';

  return (
    <div
      data-testid="about-panel"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-6"
    >
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
          About &amp; Updates
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Sürüm bilgisi, otomatik güncelleme ve crash raporu geçmişi.
        </p>
      </div>

      {/* Version card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <Stat
          label="App Version"
          value={status?.currentVersion ?? '—'}
          testid="about-version"
        />
        <Stat
          label="Update Channel"
          value={status?.updateChannel ?? '—'}
          testid="about-channel"
        />
        <Stat
          label="Update State"
          value={status ? STATE_LABEL[status.state] : '—'}
          color={status ? STATE_COLOR[status.state] : undefined}
          testid="about-state"
        />
      </div>

      {/* Update controls */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Son kontrol: <span className="font-mono">{lastChecked}</span>
            {status?.latestVersion ? (
              <>
                {' · '}En son sürüm:{' '}
                <span className="font-mono">{status.latestVersion}</span>
              </>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              data-testid="about-check-btn"
              disabled={!hasBridge || working || status?.state === 'disabled'}
              onClick={() => bridge?.updater && runAction(bridge.updater.check)}
              className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
            >
              Check for Updates
            </button>
            <button
              type="button"
              data-testid="about-download-btn"
              disabled={
                !hasBridge || working || status?.state !== 'available'
              }
              onClick={() => bridge?.updater && runAction(bridge.updater.download)}
              className="px-3 py-1.5 rounded border border-blue-400 text-blue-700 dark:text-blue-300 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-40"
            >
              Download
            </button>
            <button
              type="button"
              data-testid="about-install-btn"
              disabled={
                !hasBridge || working || status?.state !== 'downloaded'
              }
              onClick={() => bridge?.updater && runAction(bridge.updater.install)}
              className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs hover:bg-emerald-700 disabled:opacity-40"
            >
              Install &amp; Restart
            </button>
          </div>
        </div>

        {status?.state === 'downloading' ? (
          <div
            className="h-2 bg-slate-100 dark:bg-slate-800 rounded overflow-hidden"
            data-testid="about-progress-bar"
          >
            <div
              className="h-full bg-blue-500 transition-[width] duration-200"
              style={{ width: `${Math.min(100, status.downloadPercent)}%` }}
            />
          </div>
        ) : null}

        {(status?.reason || status?.lastError || err) ? (
          <p
            className="text-xs text-red-600 dark:text-red-400"
            data-testid="about-error"
          >
            {err ?? status?.lastError ?? status?.reason}
          </p>
        ) : null}
      </div>

      {/* Crash history */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Crash History
          </h4>
          <span
            className="text-xs text-slate-500 dark:text-slate-400"
            data-testid="about-crash-count"
          >
            {desktopCrashes.length + backendCrashes.length} event
          </span>
        </div>
        {desktopCrashes.length === 0 && backendCrashes.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Hiç crash raporu yok — sistem temiz.
          </p>
        ) : (
          <ul
            className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-auto"
            data-testid="about-crash-list"
          >
            {[...desktopCrashes.slice(0, 25), ...backendCrashes.slice(0, 25)]
              .sort((a, b) => (a.at < b.at ? 1 : -1))
              .slice(0, 30)
              .map((e) => (
                <li
                  key={e.id}
                  className="py-2 text-xs"
                  data-testid={`crash-row-${e.id}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {e.kind}
                    </span>
                    <span className="text-slate-400">
                      {new Date(e.at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2">
                    {e.message}
                  </p>
                </li>
              ))}
          </ul>
        )}
      </div>

      {!hasBridge ? (
        <p className="text-[11px] text-slate-400 italic">
          Auto-update ve crash raporlama Electron paketi dışında çalışmaz.
          Bu panel yalnızca .exe kurulumunda tamamen aktif olur.
        </p>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  color,
  testid,
}: {
  label: string;
  value: string;
  color?: string;
  testid?: string;
}) {
  return (
    <div
      className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-3 py-2"
      data-testid={testid}
    >
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`font-mono ${color ?? 'text-slate-800 dark:text-slate-200'}`}>
        {value}
      </span>
    </div>
  );
}

export default AboutPanel;
