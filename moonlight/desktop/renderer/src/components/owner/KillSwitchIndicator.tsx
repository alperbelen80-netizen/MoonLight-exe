import React from 'react';

interface KillSwitchIndicatorProps {
  active: boolean;
}

export function KillSwitchIndicator({ active }: KillSwitchIndicatorProps) {
  if (!active) {
    return (
      <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
        Kill-Switch OFF
      </span>
    );
  }

  return (
    <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-600 text-white animate-pulse">
      ⚠ KILL-SWITCH ACTIVE
    </span>
  );
}
