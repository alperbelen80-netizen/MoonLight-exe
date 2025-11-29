import React from 'react';
import { Outlet } from 'react-router-dom';
import { SidebarNav } from './SidebarNav';
import { TopBar } from './TopBar';

export function ShellLayout() {
  return (
    <div className="flex h-screen bg-gray-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col">
        <TopBar />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
