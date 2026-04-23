import { Command } from 'cmdk';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Database,
  Gauge,
  Layout,
  Moon,
  PlayCircle,
  Radio,
  Settings,
  ShieldAlert,
  Sparkles,
  Sun,
  Terminal,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const base = import.meta.env.VITE_API_BASE_URL || '/api';

  const go = useCallback(
    (path: string) => {
      onOpenChange(false);
      setSearch('');
      navigate(path);
    },
    [navigate, onOpenChange],
  );

  const toggleTheme = () => {
    const html = document.documentElement;
    const next = html.classList.contains('dark') ? 'light' : 'dark';
    if (next === 'dark') html.classList.add('dark');
    else html.classList.remove('dark');
    localStorage.setItem('moonlight_theme', next);
    onOpenChange(false);
  };

  const runAction = async (label: string, fn: () => Promise<any>, successMsg?: string) => {
    onOpenChange(false);
    try {
      const r = await fn();
      toast.success(successMsg || label, {
        description: typeof r === 'string' ? r : undefined,
      });
    } catch (err: any) {
      toast.error(`${label} başarısız`, { description: err?.message || 'Bilinmeyen hata' });
    }
  };

  const autoSelectFeed = () =>
    fetch(`${base}/data/providers/auto-select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requireAIValidation: true, apply: true }),
    })
      .then((r) => r.json())
      .then((d) => (d.switchedTo ? `→ ${d.switchedTo}` : d.reason));

  const reasonBatch = () =>
    fetch(`${base}/ai-coach/reason-signal/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 10 }),
    })
      .then((r) => r.json())
      .then((d) => `${d.processed} sinyal analiz edildi`);

  const refreshInsights = () =>
    fetch(`${base}/ai-coach/daily-insights?force=1`).then((r) => r.json()).then(() => 'Cache temizlendi');

  const testHealth = () =>
    fetch(`${base}/healthz`)
      .then((r) => r.json())
      .then((d) => `${d.status} / DB ${d.checks?.database?.latencyMs}ms`);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      data-testid="command-palette"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center pt-32 p-4"
      onClick={() => onOpenChange(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
      >
        <Command label="Komut Paleti">
          <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-slate-400" />
            <Command.Input
              data-testid="command-palette-input"
              autoFocus
              value={search}
              onValueChange={setSearch}
              placeholder="Komut ara veya sayfa seç… (Cmd+K / Ctrl+K)"
              className="flex-1 bg-transparent outline-none text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
            />
            <span className="text-[10px] font-mono px-1.5 py-0.5 border border-slate-200 dark:border-slate-700 rounded text-gray-400">
              ESC
            </span>
          </div>
          <Command.List className="max-h-[420px] overflow-y-auto p-2">
            <Command.Empty className="p-4 text-center text-sm text-gray-400">
              Sonuç yok
            </Command.Empty>

            <Command.Group heading="Gezinti" className="text-[10px] uppercase tracking-wider text-gray-400 px-2 py-1">
              {[
                { icon: Layout, label: 'Dashboard', path: '/dashboard', shortcut: 'g d' },
                { icon: Radio, label: 'Live Signals', path: '/live/signals', shortcut: 'g l' },
                { icon: Activity, label: 'Market Intel', path: '/intel', shortcut: 'g i' },
                { icon: Sparkles, label: 'AI Coach', path: '/ai-coach', shortcut: 'g a' },
                { icon: BookOpen, label: 'Journal', path: '/journal' },
                { icon: Database, label: 'Data Sources', path: '/data-sources', shortcut: 'g s' },
                { icon: PlayCircle, label: 'Backtests', path: '/backtests', shortcut: 'g b' },
                { icon: Bell, label: 'Alerts', path: '/alerts' },
                { icon: Gauge, label: 'Data Health', path: '/data-health', shortcut: 'g h' },
                { icon: Settings, label: 'Settings', path: '/settings' },
              ].map((i) => (
                <Command.Item
                  key={i.path}
                  data-testid={`cmd-goto-${i.path.replace(/\//g, '_')}`}
                  onSelect={() => go(i.path)}
                  className="flex items-center gap-2 px-2 py-2 text-sm text-gray-700 dark:text-gray-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800 aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800 cursor-pointer"
                >
                  <i.icon className="w-4 h-4 text-slate-400" />
                  <span className="flex-1">{i.label}</span>
                  {i.shortcut && (
                    <span className="text-[10px] font-mono text-gray-400">{i.shortcut}</span>
                  )}
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Hızlı Aksiyonlar">
              <Command.Item
                data-testid="cmd-toggle-theme"
                onSelect={toggleTheme}
                className="flex items-center gap-2 px-2 py-2 text-sm text-gray-700 dark:text-gray-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800 aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800 cursor-pointer"
              >
                <Moon className="w-4 h-4 text-slate-400 dark:hidden" />
                <Sun className="w-4 h-4 text-slate-400 hidden dark:inline" />
                <span>Tema değiştir (light/dark)</span>
              </Command.Item>
              <Command.Item
                data-testid="cmd-auto-select-feed"
                onSelect={() => runAction('AI Auto-Select feed', autoSelectFeed)}
                className="flex items-center gap-2 px-2 py-2 text-sm text-gray-700 dark:text-gray-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800 aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800 cursor-pointer"
              >
                <Zap className="w-4 h-4 text-violet-500" />
                AI Auto-Select Feed
              </Command.Item>
              <Command.Item
                data-testid="cmd-reason-batch"
                onSelect={() => runAction('AI batch reasoning', reasonBatch)}
                className="flex items-center gap-2 px-2 py-2 text-sm text-gray-700 dark:text-gray-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800 aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-violet-500" />
                AI Reasoning Batch (10 sinyal)
              </Command.Item>
              <Command.Item
                data-testid="cmd-refresh-insights"
                onSelect={() => runAction('Insights cache yenile', refreshInsights)}
                className="flex items-center gap-2 px-2 py-2 text-sm text-gray-700 dark:text-gray-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800 aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800 cursor-pointer"
              >
                <BarChart3 className="w-4 h-4 text-blue-500" />
                AI Insights cache'i yenile
              </Command.Item>
              <Command.Item
                data-testid="cmd-health"
                onSelect={() => runAction('Health check', testHealth)}
                className="flex items-center gap-2 px-2 py-2 text-sm text-gray-700 dark:text-gray-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800 aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800 cursor-pointer"
              >
                <ShieldAlert className="w-4 h-4 text-emerald-500" />
                Sağlık kontrolü
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
