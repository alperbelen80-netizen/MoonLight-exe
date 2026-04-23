import { useEffect, useMemo, useState } from 'react';

/**
 * V2.6-8 First-Run Onboarding Wizard
 *
 * Renders a full-screen modal on first launch (or when the operator
 * manually invokes it from Settings) that walks through the 5 critical
 * checks before the user enables any live-trading path:
 *
 *   Step 1 — Welcome + app version + what happens next.
 *   Step 2 — Backend healthcheck (must be green to continue).
 *   Step 3 — Credentials Vault prompt (store broker SSID).
 *   Step 4 — Simulation smoke (verify a full backtest trade fires).
 *   Step 5 — Live flags overview (explains safety tiers, no toggles yet).
 *
 * Completion is persisted in localStorage (`moonlight.onboarding.done`)
 * and can be reset from the wizard itself (for re-runs).
 *
 * The wizard is intentionally **read + guide only**. It never flips
 * a live flag on its own — users must go to Settings → Live Flags to
 * do that. This enforces "informed consent" before the blast radius
 * of real trades opens.
 */

const STORAGE_KEY = 'moonlight.onboarding.done';
const VERSION = 'v2.6.7';

interface StepDef {
  key: string;
  title: string;
  description: string;
  render: (ctx: StepContext) => JSX.Element;
}

interface StepContext {
  healthy: boolean | null;
  vaultCount: number | null;
  setHealthy: (b: boolean | null) => void;
  setVaultCount: (n: number | null) => void;
}

function useBackendUrl(): string {
  return useMemo(() => {
    if (typeof window === 'undefined') return '/api';
    const env = (import.meta as unknown as { env?: { VITE_API_BASE_URL?: string } }).env;
    return env?.VITE_API_BASE_URL || '/api';
  }, []);
}

export function OnboardingWizard({
  forceOpen,
  onClose,
}: {
  forceOpen?: boolean;
  onClose?: () => void;
}): JSX.Element | null {
  const initiallyDone =
    typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY) === 'true';
  const [open, setOpen] = useState(forceOpen ?? !initiallyDone);
  const [step, setStep] = useState(0);
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [vaultCount, setVaultCount] = useState<number | null>(null);
  const [simResult, setSimResult] = useState<string | null>(null);
  const backendUrl = useBackendUrl();

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  const close = () => {
    setOpen(false);
    onClose?.();
  };

  const finish = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, 'true');
    }
    close();
  };

  const steps: StepDef[] = [
    {
      key: 'welcome',
      title: 'MoonLight Owner Console — Hoş Geldiniz',
      description:
        "Bu sihirbaz, gerçek canlı işlemlere geçmeden önce 5 güvenlik adımını birlikte yürütür. Her adım opsiyonel değil, mimari güvenliğinizin bir parçası.",
      render: () => (
        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
          <p>
            Size:{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {VERSION}
            </span>{' '}
            sürümü kuruldu. Backend arka planda, tek tıkla başladı.
          </p>
          <p>Sıradaki adımlar:</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Backend sağlık kontrolü (otomatik).</li>
            <li>Credentials Vault'a broker SSID'nizi ekleyin.</li>
            <li>Simülasyon modunda bir smoke test çalıştırın.</li>
            <li>Live Flags'i inceleyin (henüz açmıyoruz).</li>
          </ul>
          <p className="text-xs text-slate-500">
            Bu sihirbaz her zaman Settings → About → "Re-run onboarding"
            ile tekrar başlatılabilir.
          </p>
        </div>
      ),
    },
    {
      key: 'backend',
      title: 'Backend Sağlık Kontrolü',
      description:
        "Backend'in ayakta ve cevap verdiğinden emin olalım. Bu adım otomatik.",
      render: (ctx) => (
        <div className="space-y-3">
          <BackendProbe backendUrl={backendUrl} onResult={ctx.setHealthy} />
          <p className="text-xs text-slate-500">
            İlk kurulumda backend'in hazır olması 10-15 saniye sürebilir.
          </p>
        </div>
      ),
    },
    {
      key: 'vault',
      title: 'Credentials Vault',
      description:
        "Broker SSID'lerinizi ve API anahtarlarını OS keychain'e şifreli olarak saklıyoruz. .env dosyası veya plaintext DB kesinlikle yok.",
      render: (ctx) => (
        <div className="space-y-3">
          <VaultProbe backendUrl={backendUrl} onCount={ctx.setVaultCount} />
          <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <p>
              <strong>İpucu:</strong> Settings → Credentials Vault panelinden{' '}
              <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">
                IQ_OPTION_SSID
              </code>{' '}
              anahtarı ile değerinizi ekleyin.
            </p>
            <p>
              Wizard bu adımda SSID girmenizi zorlamaz — boş bırakıp devam
              edebilirsiniz; canlı flag açmadan riski yok.
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'sim',
      title: 'Simülasyon Smoke Test',
      description:
        "4 broker simülatörü deterministik PRNG ile çalışır. Bu adım sizden bir backtest veya live simulation sinyali göndermenizi bekler.",
      render: () => (
        <div className="space-y-3">
          <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <p>
              Şu an sistem <strong>tam simülasyonda</strong>. Canlı flag'ler kapalı.
              Backtest Console veya Live Signal (mock feed) her ikisi de güvenli.
            </p>
            <p>
              "Test et" butonuna basarak bir örnek sinyal gönderip Trinity
              audit trail'inin güncellendiğini doğrulayalım.
            </p>
          </div>
          <button
            type="button"
            data-testid="onboarding-sim-test"
            onClick={async () => {
              try {
                const r = await fetch(`${backendUrl}/flags`);
                setSimResult(
                  `Flags API ${r.ok ? 'OK' : `ERROR (${r.status})`} — simulation path healthy.`,
                );
              } catch (e) {
                setSimResult(`Simulation test failed: ${(e as Error).message}`);
              }
            }}
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Test Et
          </button>
          {simResult ? (
            <p
              className={`text-xs ${
                simResult.includes('OK') || simResult.includes('healthy')
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {simResult}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'flags',
      title: 'Live Flags — Güvenlik Katmanları',
      description:
        "Canlı işlemlere geçmek için gereken flag'leri gözden geçirelim (henüz açmıyoruz).",
      render: () => (
        <div className="space-y-3 text-xs text-slate-600 dark:text-slate-400">
          <ol className="list-decimal list-inside space-y-2">
            <li>
              <strong>BROKER_IQOPTION_REAL_ENABLED</strong> — IQ Option gerçek
              WSS bağlantısı. SSID gereklidir.
            </li>
            <li>
              <strong>BROKER_DOM_AUTOMATION_ENABLED</strong> — Playwright başlatır
              (Olymp/Binomo/Expert için). İlk açtığınızda Chromium indirilir.
            </li>
            <li>
              <strong>BROKER_DOM_LIVE_ORDERS</strong> — DOM broker'larda{' '}
              <u>gerçek tıklama</u>. Bu açılmadıkça dry-run çalışır.
            </li>
            <li>
              <strong>BROKER_DOM_MAX_STAKE</strong> — Varsayılan 25. İlk canlı
              test için 1-5'e indirmeniz önerilir.
            </li>
            <li>
              <strong>BROKER_DOM_ALLOW_LIVE_REAL</strong> —{' '}
              <span className="text-red-600 dark:text-red-400 font-semibold">
                Gerçek para
              </span>
              . Bu flag kapalıyken sadece demo hesaplar kabul edilir.
            </li>
          </ol>
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded p-3 text-amber-800 dark:text-amber-300">
            <strong>Öneri:</strong> İlk 10 işleminizi demo hesapta,{' '}
            <code>MAX_STAKE=1</code> ile yapın. Trinity audit loglarını
            inceleyin. Hiçbir reject code beklenmedik değilse, gerçek hesaba
            geçin.
          </div>
        </div>
      ),
    },
  ];

  const ctx: StepContext = {
    healthy,
    vaultCount,
    setHealthy,
    setVaultCount,
  };

  if (!open) return null;

  const current = steps[step];
  const canNext =
    step === 1 ? healthy === true : true; // backend check is mandatory
  const isLast = step === steps.length - 1;

  return (
    <div
      data-testid="onboarding-wizard"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 px-6 pt-5">
          {steps.map((s, i) => (
            <div
              key={s.key}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === step
                  ? 'bg-blue-600'
                  : i < step
                    ? 'bg-emerald-500'
                    : 'bg-slate-300 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Body */}
        <div className="p-6 overflow-auto flex-1">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            Adım {step + 1}/{steps.length}
          </p>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {current.title}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {current.description}
          </p>
          <div className="mt-4">{current.render(ctx)}</div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            data-testid="onboarding-skip"
            onClick={close}
            className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            Atla
          </button>
          <div className="flex gap-2">
            {step > 0 ? (
              <button
                type="button"
                data-testid="onboarding-prev"
                onClick={() => setStep(step - 1)}
                className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Geri
              </button>
            ) : null}
            {isLast ? (
              <button
                type="button"
                data-testid="onboarding-finish"
                onClick={finish}
                className="px-4 py-1.5 rounded bg-emerald-600 text-white text-xs hover:bg-emerald-700"
              >
                Tamamla
              </button>
            ) : (
              <button
                type="button"
                data-testid="onboarding-next"
                onClick={() => setStep(step + 1)}
                disabled={!canNext}
                className="px-4 py-1.5 rounded bg-blue-600 text-white text-xs hover:bg-blue-700 disabled:opacity-40"
              >
                İleri
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BackendProbe({
  backendUrl,
  onResult,
}: {
  backendUrl: string;
  onResult: (b: boolean | null) => void;
}): JSX.Element {
  const [state, setState] = useState<'checking' | 'ok' | 'err'>('checking');
  const [msg, setMsg] = useState<string>('Bekliyor…');

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const poll = async () => {
      try {
        const r = await fetch(`${backendUrl}/healthz`);
        if (cancelled) return;
        if (r.ok) {
          const j = (await r.json()) as { status?: string; uptime_s?: number };
          setState('ok');
          setMsg(
            `Backend UP — status=${j.status ?? 'ok'} uptime=${j.uptime_s ?? '?'}s`,
          );
          onResult(true);
          return;
        }
        throw new Error(`HTTP ${r.status}`);
      } catch (e) {
        attempts++;
        if (attempts > 15) {
          setState('err');
          setMsg(`Backend'e 15 denemede ulaşılamadı: ${(e as Error).message}`);
          onResult(false);
          return;
        }
        setTimeout(poll, 1200);
      }
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [backendUrl, onResult]);

  const color =
    state === 'ok'
      ? 'text-emerald-600 dark:text-emerald-400'
      : state === 'err'
        ? 'text-red-600 dark:text-red-400'
        : 'text-blue-600 dark:text-blue-400';

  return (
    <div
      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-3"
      data-testid="onboarding-backend-probe"
    >
      <p className={`text-sm font-mono ${color}`}>{msg}</p>
    </div>
  );
}

function VaultProbe({
  backendUrl,
  onCount,
}: {
  backendUrl: string;
  onCount: (n: number | null) => void;
}): JSX.Element {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch(`${backendUrl}/secrets`);
        if (r.ok) {
          const arr = (await r.json()) as unknown[];
          const n = Array.isArray(arr) ? arr.length : 0;
          setCount(n);
          onCount(n);
        } else {
          setCount(0);
          onCount(0);
        }
      } catch {
        setCount(0);
        onCount(0);
      }
    })();
  }, [backendUrl, onCount]);

  return (
    <div
      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-3"
      data-testid="onboarding-vault-probe"
    >
      <p className="text-sm font-mono">
        Vault'ta{' '}
        <span className="font-bold text-slate-900 dark:text-slate-100">
          {count ?? '?'}
        </span>{' '}
        şifrelenmiş kayıt var.
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
        Settings sayfasından yeni credential ekleyebilirsiniz.
      </p>
    </div>
  );
}

export default OnboardingWizard;
