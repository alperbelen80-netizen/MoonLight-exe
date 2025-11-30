import React from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/accounts', label: 'Accounts' },
  { path: '/matrix', label: 'Execution Matrix' },
  { path: '/backtests', label: 'Backtests' },
  { path: '/data-health', label: 'Data Health' },
  { path: '/alerts', label: 'Alerts' },
  { path: '/settings', label: 'Settings' },
];

export function SidebarNav() {
  return (
    <aside className="w-64 bg-gray-900 text-white p-4">
      <div className="text-xl font-bold mb-8">MoonLight</div>
      <nav className="space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `block px-4 py-2 rounded transition ${
                isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
