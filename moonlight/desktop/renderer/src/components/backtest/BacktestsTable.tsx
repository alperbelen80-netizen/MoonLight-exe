import React from 'react';
import { BacktestRunSummaryDTO } from '../../services/backtest-api';
import { useBacktestsStore } from '../../store/backtests.store';

interface BacktestsTableProps {
  runs: BacktestRunSummaryDTO[];
  onSelectRun: (id: string) => void;
  selectedRunId?: string;
}

const envColors: Record<string, string> = {
  LIVE: 'bg-red-100 text-red-800',
  SANDBOX: 'bg-blue-100 text-blue-800',
};

const profileColors: Record<string, string> = {
  SAFE: 'bg-green-100 text-green-800',
  BALANCED: 'bg-yellow-100 text-yellow-800',
  MAXPOWER: 'bg-orange-100 text-orange-800',
};

export function BacktestsTable({
  runs,
  onSelectRun,
  selectedRunId,
}: BacktestsTableProps) {
  const { toggleFavorite } = useBacktestsStore();

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Fav
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Created
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Symbol
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              TF
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Strategy
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Env
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Profile
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              WR%
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              Net PnL
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              Sharpe
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Tags
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {runs.map((run) => (
            <tr
              key={run.run_id}
              className={`hover:bg-gray-50 cursor-pointer ${
                selectedRunId === run.run_id ? 'bg-blue-50' : ''
              }`}
              onClick={() => onSelectRun(run.run_id)}
            >
              <td className="px-4 py-3 text-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(run.run_id);
                  }}
                  className="text-xl"
                >
                  {run.is_favorite ? '⭐' : '☆'}
                </button>
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {new Date(run.created_at_utc).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                {run.symbols.join(', ')}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {run.timeframes.join(', ')}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {run.strategy_ids[0]}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    envColors[run.environment] || 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {run.environment}
                </span>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    profileColors[run.hardware_profile] || 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {run.hardware_profile}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-right font-medium">
                {(run.win_rate * 100).toFixed(1)}%
              </td>
              <td
                className={`px-4 py-3 text-sm text-right font-medium ${
                  run.net_pnl > 0 ? 'text-green-600' : run.net_pnl < 0 ? 'text-red-600' : 'text-gray-600'
                }`}
              >
                ${run.net_pnl.toFixed(2)}
              </td>
              <td className="px-4 py-3 text-sm text-right">
                {run.sharpe ? run.sharpe.toFixed(2) : '-'}
              </td>
              <td className="px-4 py-3 text-sm">
                <div className="flex gap-1 flex-wrap">
                  {run.tags && run.tags.length > 0 ? (
                    run.tags.slice(0, 2).map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs"
                      >
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-400 text-xs">-</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {runs.length === 0 && (
        <div className="p-8 text-center text-gray-500">
          No backtest runs found. Adjust filters or run a new backtest.
        </div>
      )}
    </div>
  );
}
