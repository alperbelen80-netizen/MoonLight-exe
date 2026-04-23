import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[MoonLight ErrorBoundary]', error, info);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return (
        <div
          data-testid="error-boundary"
          className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6"
        >
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">
                  Birçey hatalı gitti
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Konsol kaydına düştü
                </div>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-60 overflow-auto">
              {this.state.error?.stack || this.state.error?.message || 'Unknown error'}
            </div>
            <div className="flex justify-end gap-2">
              <button
                data-testid="error-boundary-reload"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Yeniden yükle
              </button>
              <button
                data-testid="error-boundary-reset"
                onClick={this.reset}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-slate-100 rounded-lg hover:bg-slate-200 dark:text-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
