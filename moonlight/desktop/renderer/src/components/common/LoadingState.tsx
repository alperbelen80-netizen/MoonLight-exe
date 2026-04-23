import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  /**
   * After how many milliseconds to surface a "taking longer than expected"
   * hint to the user. Set to 0 to disable.
   */
  slowHintAfterMs?: number;
  onRetry?: () => void;
}

export function LoadingState({
  message = 'Loading...',
  slowHintAfterMs = 5000,
  onRetry,
}: LoadingStateProps) {
  const [showSlowHint, setShowSlowHint] = useState(false);

  useEffect(() => {
    if (!slowHintAfterMs) return;
    const id = setTimeout(() => setShowSlowHint(true), slowHintAfterMs);
    return () => clearTimeout(id);
  }, [slowHintAfterMs]);

  return (
    <div
      data-testid="loading-state"
      className="flex flex-col items-center justify-center p-12 min-h-[300px]"
    >
      <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      <p className="mt-4 text-gray-600 font-medium">{message}</p>

      {showSlowHint && (
        <div
          data-testid="loading-slow-hint"
          className="mt-6 max-w-md text-center text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3"
        >
          <p className="font-medium mb-1">Yanıt biraz uzun sürüyor…</p>
          <p className="text-amber-600">
            Arka uç yavaş yanıt veriyor olabilir. Lokal kullanımda bu çok nadirdir;
            preview ortamında Cloudflare edge streaming bu durumu tetikleyebilir.
          </p>
          {onRetry && (
            <button
              data-testid="loading-retry-btn"
              onClick={onRetry}
              className="mt-3 px-3 py-1 text-xs font-medium bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-800 rounded transition-colors"
            >
              Tekrar dene
            </button>
          )}
        </div>
      )}
    </div>
  );
}
