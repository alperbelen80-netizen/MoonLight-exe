import React from 'react';
import { HealthColor } from '../../lib/types';

interface HealthScoreBadgeProps {
  score: number;
  color: HealthColor;
}

const colorClasses: Record<HealthColor, string> = {
  GREEN: 'bg-green-500 text-white',
  AMBER: 'bg-yellow-500 text-white',
  RED: 'bg-red-500 text-white',
  BLACKOUT: 'bg-gray-900 text-white',
};

export function HealthScoreBadge({ score, color }: HealthScoreBadgeProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-600">Health:</span>
      <span
        className={`px-3 py-1 rounded-full text-sm font-bold ${
          colorClasses[color] || 'bg-gray-500 text-white'
        }`}
      >
        {score}/100
      </span>
    </div>
  );
}
