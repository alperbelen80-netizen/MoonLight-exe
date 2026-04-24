import { useEffect, useState } from 'react';
import { Bell, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getApiBase } from '../../services/api-client';

interface Channel {
  channel: string;
  urlPreview: string;
}

export function AlertsWebhookPanel() {
  const [configured, setConfigured] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [sending, setSending] = useState(false);
  const [testUrl, setTestUrl] = useState('');
  const [testChannel, setTestChannel] = useState<'discord' | 'slack' | 'telegram' | 'generic'>('generic');

  const base = getApiBase();

  const load = async () => {
    try {
      const d = await fetch(`${base}/alerts/webhooks`).then((r) => r.json());
      setConfigured(Boolean(d.configured));
      setChannels(d.channels || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    load();
  }, []);

  const testDispatch = async () => {
    setSending(true);
    try {
      const body: any = {
        title: 'MoonLight Test',
        message: 'Bu bir test uyarısıdır.',
        severity: 'info',
      };
      if (testUrl.trim()) {
        body.url = testUrl.trim();
        body.channel = testChannel;
      }
      const r = await fetch(`${base}/alerts/test-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json());
      if (r.total === 0) {
        toast('Webhook yapılandırılmamış', {
          description: 'ALERT_WEBHOOKS env variable ekleyin veya test URL girin.',
        });
      } else if (r.ok === r.total) {
        toast.success(`${r.ok} kanal başarılı`);
      } else {
        toast.error(`${r.failed}/${r.total} kanal başarısız`, {
          description: JSON.stringify(r.details).slice(0, 200),
        });
      }
    } catch (e: any) {
      toast.error('Test başarısız', { description: e?.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div data-testid="alerts-webhook-panel" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Bell className="w-5 h-5 text-amber-500" />
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Outgoing Webhooks</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Discord / Slack / Telegram / Generic JSON kanalları. `ALERT_WEBHOOKS` env ile yapılandırın.
          </p>
        </div>
      </div>

      <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
        <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
          Yapılandırılmış Kanallar ({channels.length})
        </div>
        {channels.length === 0 ? (
          <div className="text-xs text-slate-500">
            Kanal yok. Örnek: <code className="font-mono">ALERT_WEBHOOKS=discord:https://...,slack:https://...</code>
          </div>
        ) : (
          <ul className="space-y-1">
            {channels.map((c, i) => (
              <li
                key={i}
                className="flex items-center justify-between text-xs font-mono bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-700"
              >
                <span className="font-semibold text-slate-700 dark:text-slate-200">{c.channel}</span>
                <span className="text-slate-500">{c.urlPreview}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">Test Webhook</div>
        <div className="flex gap-2">
          <input
            data-testid="webhook-test-url"
            value={testUrl}
            onChange={(e) => setTestUrl(e.target.value)}
            placeholder="Test URL (opsiyonel)"
            className="flex-1 text-xs px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent outline-none focus:border-amber-500"
          />
          <select
            data-testid="webhook-test-channel"
            value={testChannel}
            onChange={(e) => setTestChannel(e.target.value as any)}
            className="text-xs px-2 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent"
          >
            <option value="generic">Generic</option>
            <option value="discord">Discord</option>
            <option value="slack">Slack</option>
            <option value="telegram">Telegram</option>
          </select>
          <button
            data-testid="webhook-test-btn"
            onClick={testDispatch}
            disabled={sending}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Test
          </button>
        </div>
      </div>

      <div className="text-xs text-slate-500 dark:text-slate-400">
        Durum:{' '}
        <span className={configured ? 'text-emerald-600' : 'text-amber-600'}>
          {configured ? 'yapılandırılmış' : 'yapılandırılmamış'}
        </span>
      </div>
    </div>
  );
}
