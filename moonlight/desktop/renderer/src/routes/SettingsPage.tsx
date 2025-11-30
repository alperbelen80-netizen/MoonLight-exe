import React, { useEffect, useState } from 'react';
import { DataFeedOrchestrator } from '../../services/data-api';

export function SettingsPage() {
  const [providers, setProviders] = useState<any[]>([]);
  const [activeProvider, setActiveProvider] = useState<string>('MOCK_LIVE');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProviders = async () => {
      try {
        const response = await fetch('http://localhost:8001/data/providers');
        if (response.ok) {
          const data = await response.json();
          setProviders(data.providers || []);
          setActiveProvider(data.active || 'MOCK_LIVE');
        }
      } catch (error) {
        console.error('Failed to load providers:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProviders();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      <div className="bg-white rounded-xl shadow-sm p-6 border space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-4">Data Feed Provider</h2>
          <div className="space-y-3">
            {loading ? (
              <div className="text-sm text-gray-500">Yükleniyor...</div>
            ) : (
              providers.map((provider) => (
                <div
                  key={provider.name}
                  className={`p-4 border rounded ${
                    provider.name === activeProvider ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{provider.name}</div>
                      <div className="text-sm text-gray-500">
                        {provider.connected ? '🟢 Bağlı' : '🔴 Bağlı Değil'}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Desteklenen semboller: {provider.symbols.slice(0, 5).join(', ')}
                        {provider.symbols.length > 5 && ` +${provider.symbols.length - 5} more`}
                      </div>
                    </div>
                    {provider.name === activeProvider && (
                      <span className="px-3 py-1 bg-blue-600 text-white text-sm rounded">AKTİF</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Backend Base URL</label>
            <input
              type="text"
              value={import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001'}
              readOnly
              className="w-full px-3 py-2 border rounded bg-gray-50 text-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
            <input type="text" value="1.5.0" readOnly className="w-full px-3 py-2 border rounded bg-gray-50 text-gray-600" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Live Signal Mode</label>
            <input
              type="text"
              value="ENABLED (Multi-Provider + Semi-Auto)"
              readOnly
              className="w-full px-3 py-2 border rounded bg-green-50 text-green-800 font-medium"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
