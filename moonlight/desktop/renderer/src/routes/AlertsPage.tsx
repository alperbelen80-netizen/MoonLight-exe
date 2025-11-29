import React, { useEffect, useState } from 'react';
import { useAlertsStore } from '../store/alerts.store';
import { AlertsTable } from '../components/owner/AlertsTable';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { AlertSeverity, AlertStatus } from '../lib/types';

export function AlertsPage() {
  const { alerts, isLoading, error, filters, setFilters, fetchAlerts } =
    useAlertsStore();

  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<AlertStatus | 'ALL'>('ALL');

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleFilterChange = () => {
    setFilters({
      severity: severityFilter === 'ALL' ? undefined : severityFilter,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
    });
  };

  if (isLoading && alerts.length === 0) {
    return <LoadingState message="Alerts yükleniyor..." />;
  }

  if (error && alerts.length === 0) {
    return <ErrorState message={error} onRetry={fetchAlerts} />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Alerts & Health Center</h1>

      <div className="flex gap-4 items-center">
        <div>
          <label className="text-sm font-medium text-gray-700 mr-2">Severity:</label>
          <select
            value={severityFilter}
            onChange={(e) => {
              setSeverityFilter(e.target.value as any);
              setTimeout(handleFilterChange, 0);
            }}
            className="px-3 py-1 border rounded"
          >
            <option value="ALL">All</option>
            <option value="CRITICAL">Critical</option>
            <option value="WARNING">Warning</option>
            <option value="INFO">Info</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mr-2">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setTimeout(handleFilterChange, 0);
            }}
            className="px-3 py-1 border rounded"
          >
            <option value="ALL">All</option>
            <option value="OPEN">Open</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>
      </div>

      <AlertsTable alerts={alerts} />
    </div>
  );
}
