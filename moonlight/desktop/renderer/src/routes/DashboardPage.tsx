import React, { useEffect } from 'react';
import { useDashboardStore } from '../store/dashboard.store';
import { useApprovalsStore } from '../store/approvals.store';
import { usePnlHistoryStore } from '../store/pnlHistory.store';
import { KPICard } from '../components/common/KPICard';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { ExecutionModeSwitch } from '../components/owner/ExecutionModeSwitch';
import { KillSwitchButton } from '../components/owner/KillSwitchButton';
import { ApprovalQueuePanel } from '../components/owner/ApprovalQueuePanel';
import { PnlHistoryChart } from '../components/dashboard/PnlHistoryChart';

export function DashboardPage() {
  const { summary, isLoading, error, fetchSummary } = useDashboardStore();
  const { pending, fetchPending } = useApprovalsStore();
  const { loadHistory } = usePnlHistoryStore();

  useEffect(() => {
    fetchSummary();
    fetchPending();
    loadHistory();
    const interval = setInterval(() => {
      fetchSummary();
      fetchPending();
      loadHistory();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading && !summary) {
    return <LoadingState message="Dashboard yükleniyor..." />;
  }

  if (error && !summary) {
    return <ErrorState message={error} onRetry={fetchSummary} />;
  }

  if (!summary) {
    return <ErrorState message="Dashboard verisi alınamadı" onRetry={fetchSummary} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex gap-4">
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              summary.environment === 'LIVE' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
            }`}
          >
            {summary.environment}
          </span>
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
            HW: {summary.hardware_profile}
          </span>
          <ExecutionModeSwitch mode={summary.execution_mode} onChange={() => fetchSummary()} />
          <KillSwitchButton
            active={summary.circuit_breaker_level === 'L3_GLOBAL'}
            onToggle={() => fetchSummary()}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <KPICard
          title="Win Rate (7d)"
          value={`${(summary.live_win_rate_7d * 100).toFixed(1)}%`}
          color={
            summary.live_win_rate_7d > 0.6 ? 'green' : summary.live_win_rate_7d > 0.5 ? 'gray' : 'red'
          }
        />
        <KPICard
          title="PnL Today"
          value={`$${summary.daily_net_pnl.toFixed(2)}`}
          color={summary.daily_net_pnl > 0 ? 'green' : 'red'}
        />
        <KPICard title="Trades Today" value={summary.daily_trade_count} color="blue" />
        <KPICard
          title="Global Health"
          value={`${summary.global_health_score}/100`}
          subtitle={summary.global_health_color}
          color={
            summary.global_health_color === 'GREEN'
              ? 'green'
              : summary.global_health_color === 'AMBER'
              ? 'gray'
              : 'red'
          }
        />
        <KPICard
          title="Pending Approvals"
          value={summary.approval_queue_pending_count}
          color={summary.approval_queue_pending_count > 0 ? 'red' : 'gray'}
        />
        <KPICard title="Trades (7d)" value={summary.live_trade_count_7d} color="gray" />
      </div>

      <PnlHistoryChart />

      {pending.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h2 className="text-lg font-semibold mb-4">Approval Queue</h2>
          <ApprovalQueuePanel items={pending.slice(0, 5)} />
        </div>
      )}
    </div>
  );
}
