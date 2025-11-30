import React, { useEffect, useState } from 'react';
import { useBacktestsStore } from '../store/backtests.store';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { BacktestsTable } from '../components/backtest/BacktestsTable';
import { BacktestDetailDrawer } from '../components/backtest/BacktestDetailDrawer';
import { BacktestsFilterBar } from '../components/backtest/BacktestsFilterBar';

export function BacktestsPage() {
  const {
    items,
    page,
    pageSize,
    total,
    filters,
    loading,
    error,
    selectedRunId,
    loadRuns,
    setFilter,
    resetFilters,
    setPage,
    selectRun,
  } = useBacktestsStore();

  useEffect(() => {
    loadRuns();
  }, []);

  const selectedRun = items.find((r) => r.run_id === selectedRunId);

  if (loading && items.length === 0) {
    return <LoadingState message="Backtest runs yükleniyor..." />;
  }

  if (error && items.length === 0) {
    return <ErrorState message={error} onRetry={loadRuns} />;
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Backtest Console</h1>
        <div className="text-sm text-gray-500">
          {total} runs total
        </div>
      </div>

      <BacktestsFilterBar
        filters={filters}
        onFilterChange={setFilter}
        onReset={resetFilters}
      />

      <BacktestsTable
        runs={items}
        onSelectRun={selectRun}
        selectedRunId={selectedRunId}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}

      {selectedRun && (
        <BacktestDetailDrawer
          run={selectedRun}
          onClose={() => selectRun(undefined)}
        />
      )}
    </div>
  );
}
