import React, { useEffect, useMemo } from 'react';
import { usePnlHistoryStore } from '../../store/pnlHistory.store';
import { PnlRange, EnvironmentFilter } from '../../services/pnl-history-api';

export function PnlHistoryChart() {
  const { history, loading, error, range, environmentFilter, loadHistory, setRange, setEnvironmentFilter } =
    usePnlHistoryStore();

  useEffect(() => {
    loadHistory();
  }, []);

  const metrics = useMemo(() => {
    if (!history || history.points.length === 0) {
      return {
        totalPnl: 0,
        bestDay: null as { date: string; pnl: number } | null,
        worstDay: null as { date: string; pnl: number } | null,
        totalTrades: 0,
      };
    }

    let totalPnl = 0;
    let bestDay = history.points[0];
    let worstDay = history.points[0];
    let totalTrades = 0;

    history.points.forEach((point) => {
      totalPnl += point.net_pnl;
      totalTrades += point.trades;

      if (point.net_pnl > bestDay.net_pnl) {
        bestDay = point;
      }
      if (point.net_pnl < worstDay.net_pnl) {
        worstDay = point;
      }
    });

    return {
      totalPnl,
      bestDay: { date: bestDay.date, pnl: bestDay.net_pnl },
      worstDay: { date: worstDay.date, pnl: worstDay.net_pnl },
      totalTrades,
    };
  }, [history]);

  const chartData = useMemo(() => {
    if (!history) return [];

    let cumulative = 0;
    return history.points.map((point) => {
      cumulative += point.net_pnl;
      return {
        date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        dailyPnl: point.net_pnl,
        cumulativePnl: cumulative,
        environment: point.environment,
      };
    });
  }, [history]);

  if (loading && !history) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="text-red-600">PNL verisi yüklenemedi: {error}</div>
        <button
          onClick={() => loadHistory()}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Tekrar Dene
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">PNL History</h3>
        <div className="flex gap-2">
          <div className="flex gap-1">
            {(['7d', '30d', '90d'] as PnlRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  range === r
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {(['ALL', 'LIVE', 'SANDBOX'] as EnvironmentFilter[]).map((env) => (
              <button
                key={env}
                onClick={() => setEnvironmentFilter(env)}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  environmentFilter === env
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {env}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div>
          <div className="text-sm font-medium text-gray-500">Total PnL</div>
          <div
            className={`text-2xl font-bold ${
              metrics.totalPnl > 0 ? 'text-green-600' : metrics.totalPnl < 0 ? 'text-red-600' : 'text-gray-600'
            }`}
          >
            ${metrics.totalPnl.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-sm font-medium text-gray-500">Best Day</div>
          <div className="text-sm font-semibold text-green-600">
            {metrics.bestDay ? `$${metrics.bestDay.pnl.toFixed(2)}` : 'N/A'}
          </div>
          {metrics.bestDay && (
            <div className="text-xs text-gray-500">{new Date(metrics.bestDay.date).toLocaleDateString()}</div>
          )}
        </div>
        <div>
          <div className="text-sm font-medium text-gray-500">Worst Day</div>
          <div className="text-sm font-semibold text-red-600">
            {metrics.worstDay ? `$${metrics.worstDay.pnl.toFixed(2)}` : 'N/A'}
          </div>
          {metrics.worstDay && (
            <div className="text-xs text-gray-500">{new Date(metrics.worstDay.date).toLocaleDateString()}</div>
          )}
        </div>
        <div>
          <div className="text-sm font-medium text-gray-500">Total Trades</div>
          <div className="text-2xl font-bold text-gray-900">{metrics.totalTrades}</div>
        </div>
      </div>

      <div className="h-64 relative">
        <svg className="w-full h-full" viewBox="0 0 800 250">
          <defs>
            <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
          </defs>

          {chartData.length > 0 && (
            <>
              <line x1="50" y1="0" x2="50" y2="250" stroke="#e5e7eb" strokeWidth="1" />
              <line x1="50" y1="200" x2="800" y2="200" stroke="#e5e7eb" strokeWidth="1" />

              {(() => {
                const maxPnl = Math.max(...chartData.map((d) => d.cumulativePnl), 0);
                const minPnl = Math.min(...chartData.map((d) => d.cumulativePnl), 0);
                const pnlRange = maxPnl - minPnl || 1;

                const xStep = 750 / (chartData.length - 1 || 1);

                const pathData = chartData
                  .map((d, i) => {
                    const x = 50 + i * xStep;
                    const y = 200 - ((d.cumulativePnl - minPnl) / pnlRange) * 180;
                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                  })
                  .join(' ');

                return (
                  <>
                    <path d={pathData} fill="none" stroke="#3b82f6" strokeWidth="2" />
                    {chartData.map((d, i) => {
                      const x = 50 + i * xStep;
                      const y = 200 - ((d.cumulativePnl - minPnl) / pnlRange) * 180;
                      return (
                        <circle
                          key={i}
                          cx={x}
                          cy={y}
                          r="3"
                          fill="#3b82f6"
                          className="hover:r-5"
                        >
                          <title>{`${d.date}: $${d.cumulativePnl.toFixed(2)}`}</title>
                        </circle>
                      );
                    })}
                  </>
                );
              })()}
            </>
          )}

          {chartData.length === 0 && (
            <text x="400" y="125" textAnchor="middle" fill="#9ca3af" fontSize="14">
              Bu aralık için PnL verisi yok
            </text>
          )}
        </svg>
      </div>
    </div>
  );
}
