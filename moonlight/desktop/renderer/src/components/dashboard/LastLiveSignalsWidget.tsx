import React, { useEffect, useState } from 'react';
import { fetchLiveSignals, LiveSignalDTO } from '../../services/live-signal-api';

export function LastLiveSignalsWidget() {
  const [signals, setSignals] = useState<LiveSignalDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLastSignals = async () => {
      try {
        const response = await fetchLiveSignals({
          page: 1,
          pageSize: 5,
          status: 'NEW',
        });
        setSignals(response.items);
      } catch (error) {
        console.error('Failed to load last live signals:', error);
      } finally {
        setLoading(false);
      }
    };

    loadLastSignals();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Son Canlı Sinyaller</h3>
        <a href="/live/signals" className="text-xs text-blue-600 hover:text-blue-800">
          Tümünü gör →
        </a>
      </div>

      {signals.length === 0 ? (
        <div className="text-sm text-gray-500">Hiç yeni sinyal yok</div>
      ) : (
        <div className="space-y-2">
          {signals.map((signal) => (
            <div key={signal.id} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
              <div className="flex items-center gap-2">
                <span className="font-medium">{signal.symbol}</span>
                <span className="text-gray-500">{signal.timeframe}</span>
                <span
                  className={`px-1.5 py-0.5 rounded ${
                    signal.direction.includes('CALL') || signal.direction.includes('BUY')
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {signal.direction}
                </span>
              </div>
              <div className="text-gray-600">{(signal.confidence_score * 100).toFixed(0)}%</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
