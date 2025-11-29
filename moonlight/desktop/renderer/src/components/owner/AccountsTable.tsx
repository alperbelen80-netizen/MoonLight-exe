import React from 'react';
import { AccountDTO, SessionHealth } from '../../lib/types';

interface AccountsTableProps {
  accounts: AccountDTO[];
}

const sessionHealthColors: Record<SessionHealth, string> = {
  UP: 'bg-green-100 text-green-800',
  DEGRADED: 'bg-yellow-100 text-yellow-800',
  RECONNECTING: 'bg-blue-100 text-blue-800',
  COOLDOWN: 'bg-orange-100 text-orange-800',
  DOWN: 'bg-red-100 text-red-800',
};

export function AccountsTable({ accounts }: AccountsTableProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Alias</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Broker</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Session</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Balance</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {accounts.map((account) => (
            <tr key={account.account_id} className="hover:bg-gray-50">
              <td className="px-6 py-4 text-sm font-medium text-gray-900">
                {account.alias}
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">
                {account.broker_id}
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">
                {account.type}
              </td>
              <td className="px-6 py-4 text-sm">
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {account.status}
                </span>
              </td>
              <td className="px-6 py-4 text-sm">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    sessionHealthColors[account.session_health] || 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {account.session_health}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">
                {account.balance ? `$${account.balance.toFixed(2)}` : 'N/A'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
