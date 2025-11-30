import React, { useEffect, useState } from 'react';

interface OpenPosition {
  id: string;
  symbol: string;
  direction: string;
  entry_price: number;
  current_price: number;
  pnl: number;
  opened_at: string;
}

export function OpenPositionsWidget() {
  const [positions, setPositions] = useState<OpenPosition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPositions = async () => {
      try {
        const mockPositions: OpenPosition[] = [];
        setPositions(mockPositions);
      } catch (error) {
        console.error('Failed to load positions:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPositions();

    const interval = setInterval(loadPositions, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Açık Pozisyonlar</h3>

      {positions.length === 0 ? (
        <div className="text-sm text-gray-500 py-4 text-center">Hiç açık pozisyon yok</div>
      ) : (
        <div className="space-y-2">
          {positions.map((pos) => (
            <div key={pos.id} className="p-3 bg-gray-50 rounded border">
              <div className="flex items-center justify-between mb-1">
                <div className="font-medium text-sm">{pos.symbol}</div>
                <span
                  className={`px-2 py-0.5 rounded text-xs ${
                    pos.direction === 'CALL' || pos.direction === 'BUY'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {pos.direction}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Entry: {pos.entry_price.toFixed(2)}</span>
                <span
                  className={`font-medium ${
                    pos.pnl > 0 ? 'text-green-600' : pos.pnl < 0 ? 'text-red-600' : 'text-gray-600'
                  }`}
                >
                  {pos.pnl > 0 ? '+' : ''}
                  {pos.pnl.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
