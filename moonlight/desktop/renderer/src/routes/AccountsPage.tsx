import React, { useEffect } from 'react';
import { useAccountsStore } from '../store/accounts.store';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { AccountsTable } from '../components/owner/AccountsTable';

export function AccountsPage() {
  const { accounts, isLoading, error, fetchAccounts } = useAccountsStore();

  useEffect(() => {
    fetchAccounts();
  }, []);

  if (isLoading && accounts.length === 0) {
    return <LoadingState message="Hesaplar yükleniyor..." />;
  }

  if (error && accounts.length === 0) {
    return <ErrorState message={error} onRetry={fetchAccounts} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Broker Accounts</h1>
        <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Add Account
        </button>
      </div>

      <AccountsTable accounts={accounts} />
    </div>
  );
}
