import React from 'react';
import { ExecutionMatrixRowDTO } from '../../lib/types';
import { useMatrixStore } from '../../store/matrix.store';

interface ProductMatrixTableProps {
  rows: ExecutionMatrixRowDTO[];
}

export function ProductMatrixTable({ rows }: ProductMatrixTableProps) {
  const { toggleFlag, isUpdatingRowId } = useMatrixStore();

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Symbol</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">TF</th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Data</th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Signal</th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Auto-Trade</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 text-sm font-medium text-gray-900">
                {row.symbol}
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">{row.tf}</td>
              <td className="px-6 py-4 text-center">
                <input
                  type="checkbox"
                  checked={row.data_enabled}
                  onChange={() => toggleFlag(row.id, 'data_enabled')}
                  disabled={isUpdatingRowId === row.id}
                  className="w-4 h-4 text-blue-600 rounded disabled:opacity-50"
                />
              </td>
              <td className="px-6 py-4 text-center">
                <input
                  type="checkbox"
                  checked={row.signal_enabled}
                  onChange={() => toggleFlag(row.id, 'signal_enabled')}
                  disabled={isUpdatingRowId === row.id}
                  className="w-4 h-4 text-blue-600 rounded disabled:opacity-50"
                />
              </td>
              <td className="px-6 py-4 text-center">
                <input
                  type="checkbox"
                  checked={row.auto_trade_enabled}
                  onChange={() => toggleFlag(row.id, 'auto_trade_enabled')}
                  disabled={isUpdatingRowId === row.id}
                  className="w-4 h-4 text-blue-600 rounded disabled:opacity-50"
                />
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {new Date(row.updated_at_utc).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
