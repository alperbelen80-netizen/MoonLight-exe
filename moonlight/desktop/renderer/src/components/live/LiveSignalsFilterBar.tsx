import React, { useState } from 'react';

interface LiveSignalsFilterBarProps {
  filters: any;
  onFilterChange: (partial: any) => void;
  onReset: () => void;
}

export function LiveSignalsFilterBar({
  filters,
  onFilterChange,
  onReset,
}: LiveSignalsFilterBarProps) {
  const [localFilters, setLocalFilters] = useState(filters);

  const handleApply = () => {
    onFilterChange(localFilters);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4 space-y-3">
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sembol</label>
          <select
            value={localFilters.symbol || ''}
            onChange={(e) => setLocalFilters({ ...localFilters, symbol: e.target.value })}
            className="w-full px-3 py-2 border rounded text-sm"
          >
            <option value="">Tümü</option>
            <option value="XAUUSD">XAUUSD</option>
            <option value="EURUSD">EURUSD</option>
            <option value="GBPUSD">GBPUSD</option>
            <option value="BTCUSD">BTCUSD</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Timeframe</label>
          <select
            value={localFilters.timeframe || ''}
            onChange={(e) => setLocalFilters({ ...localFilters, timeframe: e.target.value })}
            className="w-full px-3 py-2 border rounded text-sm"
          >
            <option value="">Tümü</option>
            <option value="1m">1m</option>
            <option value="5m">5m</option>
            <option value="15m">15m</option>
            <option value="1h">1h</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
          <select
            value={localFilters.status || 'ALL'}
            onChange={(e) => setLocalFilters({ ...localFilters, status: e.target.value })}
            className="w-full px-3 py-2 border rounded text-sm"
          >
            <option value="ALL">Tümü</option>
            <option value="NEW">Yeni</option>
            <option value="MARKED_EXECUTED">İşleme Girildi</option>
            <option value="SKIPPED">Atlandi</option>
            <option value="WATCHING">İzleniyor</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tarih Aralığı</label>
          <select
            value={localFilters.dateRange || 'last_24h'}
            onChange={(e) => setLocalFilters({ ...localFilters, dateRange: e.target.value })}
            className="w-full px-3 py-2 border rounded text-sm"
          >
            <option value="last_1h">Son 1 Saat</option>
            <option value="last_4h">Son 4 Saat</option>
            <option value="last_24h">Son 24 Saat</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleApply}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          Filtrele
        </button>
        <button
          onClick={onReset}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
        >
          Sıfırla
        </button>
      </div>
    </div>
  );
}
