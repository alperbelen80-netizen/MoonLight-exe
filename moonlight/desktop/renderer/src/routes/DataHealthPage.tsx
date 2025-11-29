import React, { useEffect } from 'react';
import { useDataHealthStore } from '../store/dataHealth.store';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';

const qualityColors: Record<string, string> = {
  A: 'bg-green-100 text-green-800',
  B: 'bg-yellow-100 text-yellow-800',
  C: 'bg-orange-100 text-orange-800',
  REJECTED: 'bg-red-100 text-red-800',
};

export function DataHealthPage() {
  const { matrix, isLoading, error, fetchMatrix } = useDataHealthStore();

  useEffect(() => {
    fetchMatrix();
  }, []);

  if (isLoading && !matrix) {
    return <LoadingState message="Data Health yükleniyor..." />;
  }

  if (error && !matrix) {
    return <ErrorState message={error} onRetry={fetchMatrix} />;
  }

  if (!matrix) {
    return <ErrorState message="Data health matrix alınamadı" onRetry={fetchMatrix} />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Data Health Matrix</h1>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Symbol
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                TF
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Coverage %
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Gap %
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Quality Grade
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {matrix.items.map((item, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  {item.symbol}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{item.tf}</td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {item.coverage_pct.toFixed(2)}%
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {item.gap_pct.toFixed(2)}%
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      qualityColors[item.quality_grade] || 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {item.quality_grade}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-500">
        Last updated: {new Date(matrix.generated_at_utc).toLocaleString()}
      </div>
    </div>
  );
}
