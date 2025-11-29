import React from 'react';
import { ExecutionMode } from '../../lib/types';

interface ExecutionModeBadgeProps {
  mode: ExecutionMode;
}

const modeColors: Record<ExecutionMode, string> = {
  OFF: 'bg-red-100 text-red-800',
  AUTO: 'bg-green-100 text-green-800',
  GUARD: 'bg-yellow-100 text-yellow-800',
  ANALYSIS: 'bg-blue-100 text-blue-800',
};

export function ExecutionModeBadge({ mode }: ExecutionModeBadgeProps) {
  return (
    <span
      className={`px-3 py-1 rounded-full text-sm font-medium ${
        modeColors[mode] || 'bg-gray-100 text-gray-800'
      }`}
    >
      Mode: {mode}
    </span>
  );
}
