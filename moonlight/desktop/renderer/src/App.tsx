import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ShellLayout } from './components/layout/ShellLayout';
import { DashboardPage } from './routes/DashboardPage';
import { AccountsPage } from './routes/AccountsPage';
import { ExecutionMatrixPage } from './routes/ExecutionMatrixPage';
import { AlertsPage } from './routes/AlertsPage';
import { DataHealthPage } from './routes/DataHealthPage';
import { BacktestsPage } from './routes/BacktestsPage';
import { LiveSignalsPage } from './routes/LiveSignalsPage';
import { StrategiesPage } from './routes/StrategiesPage';
import { SessionManagerPage } from './routes/SessionManagerPage';
import { SettingsPage } from './routes/SettingsPage';
import { DataSourcesPage } from './routes/DataSourcesPage';
import { AICoachPage } from './routes/AICoachPage';
import { MarketIntelligencePage } from './routes/MarketIntelligencePage';
import { AppToaster } from './components/common/AppToaster';
import { useLiveSignalNotifications } from './hooks/useLiveSignalNotifications';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

function GlobalEffects() {
  useLiveSignalNotifications();
  useKeyboardShortcuts();
  useLocation(); // force re-evaluation on route change
  return null;
}

function App() {
  return (
    <BrowserRouter>
      <GlobalEffects />
      <AppToaster />
      <Routes>
        <Route path="/" element={<ShellLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="live/signals" element={<LiveSignalsPage />} />
          <Route path="strategies" element={<StrategiesPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="sessions" element={<SessionManagerPage />} />
          <Route path="data-sources" element={<DataSourcesPage />} />
          <Route path="ai-coach" element={<AICoachPage />} />
          <Route path="intel" element={<MarketIntelligencePage />} />
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
