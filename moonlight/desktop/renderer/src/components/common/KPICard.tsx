import React from 'react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: 'green' | 'red' | 'blue' | 'gray';
}

const colorClasses = {
  green: 'text-green-600',
  red: 'text-red-600',
  blue: 'text-blue-600',
  gray: 'text-gray-600',
};

export function KPICard({ title, value, subtitle, color = 'gray' }: KPICardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
      <div className="text-sm font-medium text-gray-600 mb-2">{title}</div>
      <div className={`text-3xl font-bold ${colorClasses[color]}`}>{value}</div>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
    </div>
  );
}
