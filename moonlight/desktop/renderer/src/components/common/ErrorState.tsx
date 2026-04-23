import { AlertTriangle, RotateCw, BookOpen } from 'lucide-react';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  /**
   * Optional documentation link the user can consult to diagnose the issue
   * locally (e.g. Quickstart, Incident Runbook).
   */
  docLink?: { href: string; label: string };
}

export function ErrorState({ message, onRetry, docLink }: ErrorStateProps) {
  return (
    <div
      data-testid="error-state"
      className="flex flex-col items-center justify-center p-12 min-h-[300px]"
    >
      <div className="flex items-center justify-center w-14 h-14 rounded-full bg-rose-50 border border-rose-200 mb-4">
        <AlertTriangle className="w-7 h-7 text-rose-600" />
      </div>
      <p className="text-gray-900 font-semibold text-base mb-1">Bir sorun oluştu</p>
      <p
        data-testid="error-state-message"
        className="text-gray-600 text-sm mb-5 max-w-md text-center"
      >
        {message}
      </p>

      <div className="flex items-center gap-2">
        {onRetry && (
          <button
            data-testid="error-retry-btn"
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2"
          >
            <RotateCw className="w-4 h-4" />
            Tekrar dene
          </button>
        )}
        {docLink && (
          <a
            data-testid="error-doc-link"
            href={docLink.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            {docLink.label}
          </a>
        )}
      </div>
    </div>
  );
}
