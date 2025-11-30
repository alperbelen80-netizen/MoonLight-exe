import React, { useEffect, useState } from 'react';

interface AccountBalance {
  total: number;
  available: number;
  margin: number;
  currency: string;
}

export function AccountBalanceWidget() {
  const [balance, setBalance] = useState<AccountBalance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBalance = async () => {
      try {
        const mockBalance: AccountBalance = {
          total: 10000,
          available: 9750,
          margin: 250,
          currency: 'USD',
        };
        setBalance(mockBalance);
      } catch (error) {
        console.error('Failed to load balance:', error);
      } finally {
        setLoading(false);
      }
    };

    loadBalance();

    const interval = setInterval(loadBalance, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-8 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!balance) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Hesap Bakiyesi</h3>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Toplam:</span>
          <span className="text-lg font-bold text-gray-900">
            {balance.total.toLocaleString()} {balance.currency}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Kullanılabilir:</span>
          <span className="text-sm font-medium text-green-600">
            {balance.available.toLocaleString()} {balance.currency}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Margin:</span>
          <span className="text-sm font-medium text-orange-600">
            {balance.margin.toLocaleString()} {balance.currency}
          </span>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Son güncelleme:</span>
          <span>{new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
}
