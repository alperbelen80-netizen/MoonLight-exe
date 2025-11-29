import React from 'react';
import { AlertDTO, AlertSeverity, AlertStatus } from '../../lib/types';
import { useAlertsStore } from '../../store/alerts.store';

interface AlertsTableProps {
  alerts: AlertDTO[];
}

const severityColors: Record<AlertSeverity, string> = {
  CRITICAL: 'bg-red-100 text-red-800',
  WARNING: 'bg-yellow-100 text-yellow-800',
  INFO: 'bg-blue-100 text-blue-800',
};

const statusColors: Record<AlertStatus, string> = {
  OPEN: 'bg-gray-100 text-gray-800',
  ACKNOWLEDGED: 'bg-blue-100 text-blue-800',
  RESOLVED: 'bg-green-100 text-green-800',
};

export function AlertsTable({ alerts }: AlertsTableProps) {
  const { ackAlertById, resolveAlertById } = useAlertsStore();

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {alerts.map((alert) => (
            <tr key={alert.alert_id} className="hover:bg-gray-50">
              <td className="px-6 py-4">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    severityColors[alert.severity]
                  }`}
                >
                  {alert.severity}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">{alert.source}</td>
              <td className="px-6 py-4 text-sm text-gray-600">{alert.category}</td>
              <td className="px-6 py-4 text-sm text-gray-900">{alert.message}</td>
              <td className="px-6 py-4">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    statusColors[alert.status]
                  }`}
                >
                  {alert.status}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {new Date(alert.created_at_utc).toLocaleString()}
              </td>
              <td className="px-6 py-4 text-sm flex gap-2">
                {alert.status === 'OPEN' && (
                  <button
                    onClick={() => ackAlertById(alert.alert_id)}
                    className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                  >
                    ACK
                  </button>
                )}
                {alert.status !== 'RESOLVED' && (
                  <button
                    onClick={() => resolveAlertById(alert.alert_id)}
                    className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                  >
                    RESOLVE
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
