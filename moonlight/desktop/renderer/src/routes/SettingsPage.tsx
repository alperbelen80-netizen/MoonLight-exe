import React from 'react';

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      <div className="bg-white rounded-xl shadow-sm p-6 border">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Backend Base URL
            </label>
            <input
              type="text"
              value={import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001'}
              readOnly
              className="w-full px-3 py-2 border rounded bg-gray-50 text-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Version
            </label>
            <input
              type="text"
              value="1.0.0"
              readOnly
              className="w-full px-3 py-2 border rounded bg-gray-50 text-gray-600"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
