import React from 'react';
import { LiveSignalDTO } from '../../services/live-signal-api';

interface LiveSignalsTableProps {
  signals: LiveSignalDTO[];
  onSelectSignal: (id: string) => void;
  selectedSignalId?: string;
}

const directionColors: Record<string, string> = {
  CALL: 'bg-green-100 text-green-800',
  BUY: 'bg-green-100 text-green-800',
  PUT: 'bg-red-100 text-red-800',
  SELL: 'bg-red-100 text-red-800',
};

const statusColors: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  MARKED_EXECUTED: 'bg-green-100 text-green-800',
  SKIPPED: 'bg-gray-100 text-gray-800',
  EXPIRED: 'bg-orange-100 text-orange-800',
  WATCHING: 'bg-yellow-100 text-yellow-800',
};

export function LiveSignalsTable({
  signals,
  onSelectSignal,
  selectedSignalId,
}: LiveSignalsTableProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Zaman
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Sembol
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              TF
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Yön
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              Güven %
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Durum
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Notlar
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {signals.map((signal) => (
            <tr
              key={signal.id}
              onClick={() => onSelectSignal(signal.id)}
              className={`hover:bg-gray-50 cursor-pointer ${
                selectedSignalId === signal.id ? 'bg-blue-50' : ''
              }`}
            >
              <td className="px-4 py-3 text-sm text-gray-600">
                {new Date(signal.timestamp_utc).toLocaleString()}
              </td>
              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                {signal.symbol}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">{signal.timeframe}</td>
              <td className="px-4 py-3">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    directionColors[signal.direction] || 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {signal.direction}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-right font-medium">
                {(signal.confidence_score * 100).toFixed(1)}%
              </td>
              <td className="px-4 py-3">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    statusColors[signal.status] || 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {signal.status}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {signal.notes ? (
                  signal.notes.length > 30 ? `${signal.notes.substring(0, 30)}...` : signal.notes
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {signals.length === 0 && (
        <div className="p-8 text-center text-gray-500">
          Hiç sinyal bulunamadı. Filtreleri ayarlayın veya Live Signal Mode'ın aktif olduğundan emin olun.
        </div>
      )}
    </div>
  );
}
