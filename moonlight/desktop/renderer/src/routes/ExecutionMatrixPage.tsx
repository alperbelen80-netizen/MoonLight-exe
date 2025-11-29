import React, { useEffect } from 'react';
import { useMatrixStore } from '../store/matrix.store';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { ProductMatrixTable } from '../components/owner/ProductMatrixTable';

export function ExecutionMatrixPage() {
  const { rows, isLoading, error, fetchMatrix } = useMatrixStore();

  useEffect(() => {
    fetchMatrix();
  }, []);

  if (isLoading && rows.length === 0) {
    return <LoadingState message="Execution Matrix yükleniyor..." />;
  }

  if (error && rows.length === 0) {
    return <ErrorState message={error} onRetry={fetchMatrix} />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Product Execution Matrix</h1>
      <ProductMatrixTable rows={rows} />
    </div>
  );
}
