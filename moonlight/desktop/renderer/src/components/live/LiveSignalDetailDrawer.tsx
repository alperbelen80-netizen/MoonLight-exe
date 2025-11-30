import React, { useState } from 'react';
import { LiveSignalDTO } from '../../services/live-signal-api';
import { useLiveSignalsStore } from '../../store/liveSignals.store';
import { executeApprovedSignal } from '../../services/live-signal-api';

interface LiveSignalDetailDrawerProps {
  signal: LiveSignalDTO;
  onClose: () => void;
}

export function LiveSignalDetailDrawer({ signal, onClose }: LiveSignalDetailDrawerProps) {
  const { updateStatus } = useLiveSignalsStore();
  const [notes, setNotes] = useState(signal.notes || '');
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executeResult, setExecuteResult] = useState<string | null>(null);

  const handleStatusUpdate = async (newStatus: string) => {
    setSaving(true);
    try {
      await updateStatus(signal.id, newStatus, notes);
    } finally {
      setSaving(false);
    }
  };

  const handleExecute = async () => {
    const confirmed = window.confirm(
      `Bu sinyali OTOMATIĞE ÇALIŞTIR?\n\nSembol: ${signal.symbol}\nYön: ${signal.direction}\nGüven: ${(signal.confidence_score * 100).toFixed(1)}%\n\nOnayliyor musunuz?`,
    );

    if (!confirmed) return;

    setExecuting(true);
    setExecuteResult(null);

    try {
      const result = await executeApprovedSignal(signal.id, 'ACC_DEFAULT');

      if (result.success) {
        setExecuteResult(`✅ BAŞARILI: Order ${result.brokerOrderId}`);
        await updateStatus(signal.id, 'MARKED_EXECUTED', notes);
      } else {
        setExecuteResult(`❌ HATA: ${result.error}`);
      }
    } catch (error: any) {
      setExecuteResult(`❌ HATA: ${error.message}`);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Sinyal Detayları</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-gray-500">Zaman</div>
              <div className="text-sm text-gray-900">
                {new Date(signal.timestamp_utc).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Sembol</div>
              <div className="text-sm font-medium text-gray-900">{signal.symbol}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Timeframe</div>
              <div className="text-sm text-gray-900">{signal.timeframe}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Yön</div>
              <div className="text-sm font-bold text-gray-900">{signal.direction}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Güven Skoru</div>
              <div className="text-sm font-bold text-gray-900">
                {(signal.confidence_score * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Strateji</div>
              <div className="text-sm text-gray-900">{signal.strategy_family}</div>
            </div>
            {signal.entry_price && (
              <div>
                <div className="text-sm font-medium text-gray-500">Giriş Fiyatı</div>
                <div className="text-sm text-gray-900">{signal.entry_price.toFixed(2)}</div>
              </div>
            )}
            <div>
              <div className="text-sm font-medium text-gray-500">Durum</div>
              <div className="text-sm font-medium text-gray-900">{signal.status}</div>
            </div>
          </div>

          {executeResult && (
            <div
              className={`p-4 rounded ${
                executeResult.includes('✅')
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {executeResult}
            </div>
          )}

          <div className="pt-4 border-t">
            <div className="text-sm font-medium text-gray-700 mb-2">Notlar</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
              rows={3}
              placeholder="Sinyal hakkında notlarınız..."
            />
          </div>

          <div className="pt-4 border-t space-y-2">
            <div className="flex gap-2">
              {signal.status === 'NEW' && (
                <button
                  onClick={handleExecute}
                  disabled={executing}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold"
                >
                  {executing ? 'YÜRÜTÜLÜYOR...' : '⚡ OTOMATIĞE ÇALIŞTIR'}
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleStatusUpdate('MARKED_EXECUTED')}
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                Manuel Girdim
              </button>
              <button
                onClick={() => handleStatusUpdate('SKIPPED')}
                disabled={saving}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
              >
                Atladim
              </button>
              <button
                onClick={() => handleStatusUpdate('WATCHING')}
                disabled={saving}
                className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
              >
                İzlemeye Al
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
