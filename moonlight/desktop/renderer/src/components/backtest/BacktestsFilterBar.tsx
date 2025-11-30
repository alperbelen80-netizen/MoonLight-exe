import React, { useState } from 'react';

interface BacktestsFilterBarProps {
  filters: any;
  onFilterChange: (partial: any) => void;
  onReset: () => void;
}

export function BacktestsFilterBar({
  filters,
  onFilterChange,
  onReset,
}: BacktestsFilterBarProps) {
  const [localFilters, setLocalFilters] = useState(filters);

  const handleApply = () => {
    onFilterChange(localFilters);
  };

  const handleReset = () => {
    setLocalFilters({});
    onReset();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4 space-y-3">
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Symbol
          </label>
          <input
            type="text"
            value={localFilters.symbol || ''}
            onChange={(e) => setLocalFilters({ ...localFilters, symbol: e.target.value })}
            placeholder="XAUUSD"
            className="w-full px-3 py-2 border rounded text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Timeframe
          </label>
          <select
            value={localFilters.timeframe || ''}
            onChange={(e) => setLocalFilters({ ...localFilters, timeframe: e.target.value })}
            className="w-full px-3 py-2 border rounded text-sm"
          >
            <option value="">All</option>
            <option value="1m">1m</option>
            <option value="5m">5m</option>
            <option value="15m">15m</option>
            <option value="1h">1h</option>
            <option value="4h">4h</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Environment
          </label>
          <select
            value={localFilters.environment || ''}
            onChange={(e) => setLocalFilters({ ...localFilters, environment: e.target.value })}
            className="w-full px-3 py-2 border rounded text-sm"
          >
            <option value="">All</option>
            <option value="LIVE">LIVE</option>
            <option value="SANDBOX">SANDBOX</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Hardware Profile
          </label>
          <select
            value={localFilters.hardwareProfile || ''}
            onChange={(e) => setLocalFilters({ ...localFilters, hardwareProfile: e.target.value })}
            className="w-full px-3 py-2 border rounded text-sm"
          >
            <option value="">All</option>
            <option value="SAFE">SAFE</option>
            <option value="BALANCED">BALANCED</option>
            <option value="MAXPOWER">MAXPOWER</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={localFilters.isFavorite || false}
            onChange={(e) => setLocalFilters({ ...localFilters, isFavorite: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded"
          />
          Favorites only
        </label>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleApply}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          Apply Filters
        </button>
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
