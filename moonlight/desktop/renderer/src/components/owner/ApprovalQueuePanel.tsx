import React from 'react';
import { ApprovalItemDTO } from '../../lib/types';
import { useApprovalsStore } from '../../store/approvals.store';

interface ApprovalQueuePanelProps {
  items: ApprovalItemDTO[];
}

export function ApprovalQueuePanel({ items }: ApprovalQueuePanelProps) {
  const { approve, reject, processingId } = useApprovalsStore();

  if (items.length === 0) {
    return <div className="text-gray-500 text-sm">No pending approvals</div>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between p-3 bg-gray-50 rounded border"
        >
          <div className="flex-1">
            <div className="text-sm font-medium">
              {item.trade_uid} - {item.m3_uncertainty_level}
            </div>
            <div className="text-xs text-gray-500">
              Score: {item.m3_uncertainty_score.toFixed(2)}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => approve(item.id)}
              disabled={processingId === item.id}
              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              onClick={() => reject(item.id)}
              disabled={processingId === item.id}
              className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
