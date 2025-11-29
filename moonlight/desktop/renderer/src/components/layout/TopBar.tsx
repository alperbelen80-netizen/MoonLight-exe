import React, { useEffect } from 'react';
import { useDashboardStore } from '../../store/dashboard.store';
import { ExecutionModeBadge } from '../owner/ExecutionModeBadge';
import { KillSwitchIndicator } from '../owner/KillSwitchIndicator';
import { HealthScoreBadge } from '../owner/HealthScoreBadge';

export function TopBar() {
  const { summary, fetchSummary } = useDashboardStore();

  useEffect(() => {
    fetchSummary();
  }, []);

  return (
    <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
      <div className="text-xl font-semibold text-gray-900">
        MoonLight Owner Console
      </div>
      <div className="flex items-center gap-4">
        {summary && (
          <>
            <HealthScoreBadge
              score={summary.global_health_score}
              color={summary.global_health_color}
            />
            <ExecutionModeBadge mode={summary.execution_mode} />
            <KillSwitchIndicator
              active={summary.circuit_breaker_level === 'L3_GLOBAL'}
            />
          </>
        )}
      </div>
    </header>
  );
}
