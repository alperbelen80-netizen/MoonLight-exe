import React, { useEffect } from 'react';
import { useLiveSignalsStore } from '../store/liveSignals.store';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { LiveSignalsTable } from '../components/live/LiveSignalsTable';
import { LiveSignalDetailDrawer } from '../components/live/LiveSignalDetailDrawer';
import { LiveSignalsFilterBar } from '../components/live/LiveSignalsFilterBar';

export function LiveSignalsPage() {
  const {
    items,
    total,
    page,
    pageSize,
    loading,
    error,
    filters,
    selectedSignalId,
    loadSignals,
    setFilter,
    resetFilters,
    setPage,
    selectSignal,
  } = useLiveSignalsStore();

  useEffect(() => {
    loadSignals();

    const interval = setInterval(() => {
      loadSignals();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const selectedSignal = items.find((s) => s.id === selectedSignalId);
  const totalPages = Math.ceil(total / pageSize);

  if (loading && items.length === 0) {
    return <LoadingState message="Canlı sinyaller yükleniyor..." />;
  }

  if (error && items.length === 0) {
    return <ErrorState message={error} onRetry={loadSignals} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Canlı Sinyaller</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Otomatik yenileme: 5s</span>
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        </div>
      </div>

      <LiveSignalsFilterBar
        filters={filters}
        onFilterChange={setFilter}
        onReset={resetFilters}
      />

      <LiveSignalsTable
        signals={items}
        onSelectSignal={selectSignal}
        selectedSignalId={selectedSignalId}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Önceki
          </button>
          <span className="text-sm text-gray-600">
            Sayfa {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Sonraki
          </button>
        </div>
      )}

      {selectedSignal && (
        <LiveSignalDetailDrawer signal={selectedSignal} onClose={() => selectSignal(undefined)} />
      )}
    </div>
  );
}
