import React, { useEffect, useState } from 'react';
import { getStrategyDefinitions, StrategyDefinitionDTO } from '../services/strategy-api';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';

export function StrategiesPage() {
  const [strategies, setStrategies] = useState<StrategyDefinitionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  useEffect(() => {
    const loadStrategies = async () => {
      try {
        const data = await getStrategyDefinitions();
        setStrategies(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadStrategies();
  }, []);

  if (loading) {
    return <LoadingState message="Stratejiler yükleniyor..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  }

  const filteredStrategies = strategies.filter((s) => {
    const matchesSearch =
      filter === '' ||
      s.name.toLowerCase().includes(filter.toLowerCase()) ||
      s.id.toLowerCase().includes(filter.toLowerCase());

    const matchesCategory = categoryFilter === 'ALL' || s.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Strateji Fabrikası</h1>
        <div className="text-sm text-gray-500">{strategies.length} strateji yüklü</div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ara</label>
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Strateji adı veya ID..."
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
            >
              <option value="ALL">Tümü</option>
              <option value="scalping">Scalping</option>
              <option value="trend_follow">Trend Follow</option>
              <option value="mean_revert">Mean Revert</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStrategies.map((strategy) => (
          <div key={strategy.id} className="bg-white rounded-xl shadow-sm border p-4 hover:shadow-md transition">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{strategy.name}</h3>
                <div className="text-xs text-gray-500 mt-1">{strategy.id}</div>
              </div>
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${
                  strategy.category === 'scalping'
                    ? 'bg-blue-100 text-blue-800'
                    : strategy.category === 'trend_follow'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-purple-100 text-purple-800'
                }`}
              >
                {strategy.category}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-500">TF: </span>
                <span className="text-gray-900">{strategy.allowed_timeframes.join(', ')}</span>
              </div>
              {strategy.allowed_symbols && strategy.allowed_symbols.length > 0 && (
                <div>
                  <span className="text-gray-500">Semboller: </span>
                  <span className="text-gray-900">
                    {strategy.allowed_symbols.slice(0, 3).join(', ')}
                    {strategy.allowed_symbols.length > 3 && ` +${strategy.allowed_symbols.length - 3}`}
                  </span>
                </div>
              )}
              {strategy.tags && strategy.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {strategy.tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredStrategies.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          Filtre kriterleriyle eşleşen strateji bulunamadı.
        </div>
      )}
    </div>
  );
}
