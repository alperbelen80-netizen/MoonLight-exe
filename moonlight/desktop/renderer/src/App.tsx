import React, { useState } from 'react';
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
import { JournalPage } from './routes/JournalPage';
import { AppToaster } from './components/common/AppToaster';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { CommandPalette } from './components/common/CommandPalette';
import { useLiveSignalNotifications } from './hooks/useLiveSignalNotifications';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

function GlobalEffects({ onOpenPalette }: { onOpenPalette: () => void }) {
  useLiveSignalNotifications();
  useKeyboardShortcuts();
  useLocation();
  // keep onOpenPalette in closure for external shortcut handling if any future use
  void onOpenPalette;
  return null;
}

function App() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <GlobalEffects onOpenPalette={() => setPaletteOpen(true)} />
        <AppToaster />
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
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
            <Route path="journal" element={<JournalPage />} />
            <Route path="matrix" element={<ExecutionMatrixPage />} />
            <Route path="backtests" element={<BacktestsPage />} />
            <Route path="data-health" element={<DataHealthPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
