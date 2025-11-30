import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ShellLayout } from './components/layout/ShellLayout';
import { DashboardPage } from './routes/DashboardPage';
import { AccountsPage } from './routes/AccountsPage';
import { ExecutionMatrixPage } from './routes/ExecutionMatrixPage';
import { AlertsPage } from './routes/AlertsPage';
import { DataHealthPage } from './routes/DataHealthPage';
import { BacktestsPage } from './routes/BacktestsPage';
import { SettingsPage } from './routes/SettingsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ShellLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="matrix" element={<ExecutionMatrixPage />} />
          <Route path="backtests" element={<BacktestsPage />} />
          <Route path="data-health" element={<DataHealthPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
