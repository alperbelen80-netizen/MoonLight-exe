import { useEffect, useState } from 'react';
import { Shield, Save } from 'lucide-react';
import { toast } from 'sonner';

interface RiskProfile {
  id: string;
  label: string;
  description: string;
  r_per_trade_pct: number;
  max_concurrent: number;
  max_daily_loss_pct: number;
  confidence_floor: number;
  require_ai_approval: boolean;
}

export function RiskProfilePanel() {
  const [presets, setPresets] = useState<RiskProfile[]>([]);
  const [current, setCurrent] = useState<RiskProfile | null>(null);
  const [saving, setSaving] = useState(false);

  const base = import.meta.env.VITE_API_BASE_URL || '/api';

  useEffect(() => {
    (async () => {
      try {
        const [p, c] = await Promise.all([
          fetch(`${base}/risk/profile/presets`).then((r) => r.json()),
          fetch(`${base}/risk/profile`).then((r) => r.json()),
        ]);
        setPresets(p.presets || []);
        setCurrent(c.current || null);
      } catch (e: any) {
        toast.error('Risk profil yüklenemedi', { description: e?.message });
      }
    })();
  }, [base]);

  const apply = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`${base}/risk/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const d = await res.json();
      setCurrent(d.current);
      toast.success(`Risk profili: ${d.current.label}`, {
        description: `R ${d.current.r_per_trade_pct}% · concurrent ${d.current.max_concurrent} · AI ${d.current.require_ai_approval ? 'zorunlu' : 'opsiyonel'}`,
      });
    } catch (e: any) {
      toast.error('Risk profili ayarlanamadı', { description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="risk-profile-panel" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="w-5 h-5 text-indigo-500" />
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Risk Profili</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Ana çalışma modunu tek tıkla ayarlayın.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {presets.map((p) => {
          const active = current?.id === p.id;
          return (
            <button
              data-testid={`risk-preset-${p.id}`}
              key={p.id}
              onClick={() => apply(p.id)}
              disabled={saving}
              className={`text-left rounded-xl border p-3 transition-all ${
                active
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-sm ring-1 ring-indigo-500/30'
                  : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              } disabled:opacity-50 cursor-pointer`}
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">{p.label}</div>
                {active && (
                  <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
                    AKTİF
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{p.description}</div>
              <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                <div>R/trade: <b>{p.r_per_trade_pct}%</b></div>
                <div>Concurrent: <b>{p.max_concurrent}</b></div>
                <div>Daily cap: <b>{p.max_daily_loss_pct}%</b></div>
                <div>AI floor: <b>{(p.confidence_floor * 100).toFixed(0)}%</b></div>
              </div>
              <div className="mt-2 text-[10px] text-slate-500">
                {p.require_ai_approval ? '🔒 AI onayı zorunlu' : '🔓 AI onayı opsiyonel'}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
