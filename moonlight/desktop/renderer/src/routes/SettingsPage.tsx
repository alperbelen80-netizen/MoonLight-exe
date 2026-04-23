import { RiskProfilePanel } from '../components/settings/RiskProfilePanel';
import { AlertsWebhookPanel } from '../components/settings/AlertsWebhookPanel';
import { CredentialsVaultPanel } from '../components/settings/CredentialsVaultPanel';
import { LiveFlagsPanel } from '../components/settings/LiveFlagsPanel';
import { AboutPanel } from '../components/settings/AboutPanel';

export function SettingsPage() {
  return (
    <div data-testid="settings-page" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Risk profili, alert kanalları, credentials vault, canlı ticaret bayrakları ve güncellemeler.
        </p>
      </div>

      <CredentialsVaultPanel />
      <LiveFlagsPanel />
      <RiskProfilePanel />
      <AlertsWebhookPanel />
      <AboutPanel />

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Sistem</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <Item label="Backend" value={import.meta.env.VITE_API_BASE_URL || '/api'} />
          <Item label="Version" value="2.6.7 (Ready-to-Ship)" />
          <Item label="Theme" value="Auto (system / manual toggle)" />
          <Item label="Shortcut" value="Cmd/Ctrl + K — Komut Paleti" />
        </div>
      </div>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-3 py-2">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-mono text-slate-800 dark:text-slate-200">{value}</span>
    </div>
  );
}

export default SettingsPage;
