import React from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { path: '/live/signals', label: 'Live Signals', icon: '⚡' },
  { path: '/strategies', label: 'Strategies', icon: '🧠' },
  { path: '/accounts', label: 'Accounts', icon: '💼' },
  { path: '/sessions', label: 'Sessions', icon: '🔌' },
  { path: '/data-sources', label: 'Data Sources', icon: '📡' },
  { path: '/ai-coach', label: 'AI Coach', icon: '🧬' },
  { path: '/intel', label: 'Market Intel', icon: '🔭' },
  { path: '/matrix', label: 'Execution Matrix', icon: '⚙️' },
  { path: '/backtests', label: 'Backtests', icon: '📈' },
  { path: '/data-health', label: 'Data Health', icon: '💚' },
  { path: '/alerts', label: 'Alerts', icon: '🔔' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
];

export function SidebarNav() {
  return (
    <aside className="w-64 bg-gray-900 text-white p-4">
      <div className="text-xl font-bold mb-8">
        <span className="text-blue-400">Moon</span>
        <span className="text-white">Light</span>
        <div className="text-xs text-gray-400 mt-1">v1.8 AI‑Native</div>
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `block px-4 py-2.5 rounded transition flex items-center gap-3 ${
                isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'
              }`
            }
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
