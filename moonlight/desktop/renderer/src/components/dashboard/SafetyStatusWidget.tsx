import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * V2.6-9 Dashboard Safety Widget
 *
 * At-a-glance operator awareness panel rendered on the main dashboard.
 * Shows — in one compact card — the three truths every live operator
 * must see every time they open the app:
 *
 *   1. **Safety tier** — are we fully simulation, dry-run-with-real-data,
 *      or live-clicks-with-real-money? Derived from the actual flag
 *      matrix at the moment of render.
 *   2. **Capability matrix** — a one-line-per-flag truth table so the
 *      operator can confirm "yes, this is what I intended".
 *   3. **Quick links** — open Settings → Live Flags, re-run onboarding.
 *
 * This widget is intentionally **read-only**. All toggles happen in the
 * Settings panel with confirmation dialogs. The dashboard view is a
 * truthful mirror, not a control surface.
 */

interface FlagValue {
  name: string;
  value: string;
  isDefault: boolean;
  definition: {
    label: string;
    dangerous?: boolean;
  };
}

type SafetyTier = 'FULL_SIMULATION' | 'LIVE_DATA_DRY_RUN' | 'LIVE_TRADES_DEMO' | 'LIVE_TRADES_REAL_MONEY';

const TIER_META: Record<
  SafetyTier,
  {
    label: string;
    color: string;
    description: string;
  }
> = {
  FULL_SIMULATION: {
    label: 'Full Simulation',
    color: 'emerald',
    description:
      "Hiçbir canlı bağlantı yok. PRNG simülatörleri aktif, backtest + mock live signal güvenli.",
  },
  LIVE_DATA_DRY_RUN: {
    label: 'Live Data, Dry Run',
    color: 'blue',
    description:
      'Gerçek broker verisi akıyor ama tıklama yok. Sistem canlı fiyatları okuyor, order vermiyor.',
  },
  LIVE_TRADES_DEMO: {
    label: 'Live Trades — DEMO Account',
    color: 'amber',
    description:
      'DOM brokerları gerçekten tıklıyor ama demo hesabında. Para riski yok.',
  },
  LIVE_TRADES_REAL_MONEY: {
    label: 'LIVE — REAL MONEY ⚠',
    color: 'red',
    description:
      'Gerçek hesaba gerçek tıklama. Pre-flight güvenlikler aktif ama her trade GERÇEK PARA.',
  },
};

function getBridge() {
  return (window as unknown as {
    moonlight?: {
      flags?: {
        list: () => Promise<FlagValue[] | { status: number; body?: unknown }>;
      };
    };
  }).moonlight?.flags;
}

function unwrapList(raw: unknown): FlagValue[] {
  if (Array.isArray(raw)) return raw as FlagValue[];
  if (raw && typeof raw === 'object') {
    const body = (raw as { body?: unknown }).body;
    if (Array.isArray(body)) return body as FlagValue[];
  }
  return [];
}

function classifyTier(flags: FlagValue[]): SafetyTier {
  const get = (n: string) =>
    flags.find((f) => f.name === n)?.value ?? '';
  const iq = get('BROKER_IQOPTION_REAL_ENABLED') === 'true';
  const dom = get('BROKER_DOM_AUTOMATION_ENABLED') === 'true';
  const live = get('BROKER_DOM_LIVE_ORDERS') === 'true';
  const realMoney = get('BROKER_DOM_ALLOW_LIVE_REAL') === 'true';
  const sigLive = get('LIVE_SIGNAL_ENABLED') === 'true';

  if (live && realMoney) return 'LIVE_TRADES_REAL_MONEY';
  if (live) return 'LIVE_TRADES_DEMO';
  if (iq || dom || sigLive) return 'LIVE_DATA_DRY_RUN';
  return 'FULL_SIMULATION';
}

const DISPLAY_FLAGS = [
  'BROKER_IQOPTION_REAL_ENABLED',
  'BROKER_DOM_AUTOMATION_ENABLED',
  'BROKER_DOM_LIVE_ORDERS',
  'BROKER_DOM_ALLOW_LIVE_REAL',
  'BROKER_DOM_MAX_STAKE',
  'LIVE_SIGNAL_ENABLED',
  'PAYOUT_PROVIDER',
];

export function SafetyStatusWidget(): JSX.Element | null {
  const [flags, setFlags] = useState<FlagValue[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const bridge = useMemo(getBridge, []);

  const refresh = useCallback(async () => {
    if (!bridge) return;
    try {
      const r = await bridge.list();
      const list = unwrapList(r);
      if (list.length) setFlags(list);
      else if (!Array.isArray(r)) {
        const body = (r as { body?: { message?: string } }).body;
        setErr(body?.message ?? 'failed to load flags');
      }
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [bridge]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(t);
  }, [refresh]);

  // Dev-browser (no IPC): hide the widget to avoid misleading "simulation"
  // status. Operator can see the panel once inside the packaged app.
  if (!bridge) return null;

  if (!flags) {
    return (
      <div
        data-testid="safety-status-widget-loading"
        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4"
      >
        <p className="text-xs text-slate-500">Safety status yükleniyor…</p>
      </div>
    );
  }

  const tier = classifyTier(flags);
  const meta = TIER_META[tier];
  const displayFlags = DISPLAY_FLAGS.map((n) => flags.find((f) => f.name === n)).filter(
    (f): f is FlagValue => Boolean(f),
  );

  const colorCls: Record<string, string> = {
    emerald:
      'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200',
    blue: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200',
    amber:
      'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200',
    red: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-900 dark:text-red-200',
  };

  return (
    <div
      data-testid="safety-status-widget"
      className={`border rounded-xl p-4 ${colorCls[meta.color]}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider opacity-70">
            Safety Tier
          </p>
          <h3
            className="text-lg font-bold"
            data-testid="safety-tier-label"
          >
            {meta.label}
          </h3>
          <p className="text-xs opacity-80 mt-1 max-w-xl">{meta.description}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <a
            href="#/settings"
            data-testid="safety-open-settings"
            className="text-xs underline opacity-80 hover:opacity-100"
          >
            Live Flags →
          </a>
          <button
            type="button"
            data-testid="safety-rerun-onboarding"
            className="text-xs underline opacity-80 hover:opacity-100"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.localStorage.removeItem('moonlight.onboarding.done');
                window.location.reload();
              }
            }}
          >
            Onboarding'i tekrar aç
          </button>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-current/20 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        {displayFlags.map((f) => (
          <div
            key={f.name}
            className="flex items-center justify-between font-mono"
            data-testid={`safety-row-${f.name}`}
          >
            <span className="truncate opacity-80">{f.definition.label}</span>
            <FlagBadge value={f.value} dangerous={f.definition.dangerous} />
          </div>
        ))}
      </div>

      {err ? (
        <p className="text-xs mt-2 opacity-80">Error: {err}</p>
      ) : null}
    </div>
  );
}

function FlagBadge({
  value,
  dangerous,
}: {
  value: string;
  dangerous?: boolean;
}): JSX.Element {
  const isTrue = value === 'true';
  const isFalse = value === 'false' || value === '';
  if (isTrue && dangerous) {
    return (
      <span className="px-2 py-0.5 bg-red-600 text-white rounded text-[10px] uppercase">
        ON
      </span>
    );
  }
  if (isTrue) {
    return (
      <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] uppercase">
        ON
      </span>
    );
  }
  if (isFalse) {
    return (
      <span className="px-2 py-0.5 bg-slate-400 text-white rounded text-[10px] uppercase">
        OFF
      </span>
    );
  }
  // enum / number / csv — show value itself.
  return (
    <span className="px-2 py-0.5 bg-slate-700 text-white rounded text-[10px]">
      {value}
    </span>
  );
}

export default SafetyStatusWidget;
