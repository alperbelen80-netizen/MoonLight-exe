import React, { useEffect } from 'react';
import { useDashboardStore } from '../../store/dashboard.store';
import { ExecutionModeBadge } from '../owner/ExecutionModeBadge';
import { KillSwitchIndicator } from '../owner/KillSwitchIndicator';
import { HealthScoreBadge } from '../owner/HealthScoreBadge';
import { ThemeToggle } from './ThemeToggle';

export function TopBar() {
  const { summary, fetchSummary } = useDashboardStore();

  useEffect(() => {
    fetchSummary();
  }, []);

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between">
      <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
        MoonLight Owner Console
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
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
