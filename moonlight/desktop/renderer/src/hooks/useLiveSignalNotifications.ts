import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { getApiBase } from '../services/api-client';

interface LiveSignal {
  id: string;
  symbol: string;
  timeframe: string;
  direction: string;
  confidence_score: number;
  ai_verdict?: string;
  ai_confidence?: number;
}

/**
 * Watches /api/live/signals and pops a toast whenever a NEW signal
 * or a freshly-APPROVED verdict is observed. Deduplicated via Set of
 * known ids kept in ref (survives component lifecycle).
 */
export function useLiveSignalNotifications() {
  const seenIds = useRef<Set<string>>(new Set());
  const seenApproved = useRef<Set<string>>(new Set());
  const bootstrapped = useRef(false);
  const base = getApiBase();

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`${base}/live/signals?limit=10`);
        if (!res.ok) return;
        const data = await res.json();
        const items: LiveSignal[] = data?.items || [];
        if (cancelled) return;
        // First run: just record known ids, no toasts (avoid avalanche).
        if (!bootstrapped.current) {
          for (const s of items) {
            seenIds.current.add(s.id);
            if (s.ai_verdict === 'APPROVED') seenApproved.current.add(s.id);
          }
          bootstrapped.current = true;
          return;
        }
        // New signals
        for (const s of items.slice().reverse()) {
          if (!seenIds.current.has(s.id)) {
            seenIds.current.add(s.id);
            toast(`📡 ${s.symbol} ${s.direction}`, {
              description: `${s.timeframe} · güven ${(s.confidence_score * 100).toFixed(0)}%`,
              duration: 3500,
            });
          }
          if (s.ai_verdict === 'APPROVED' && !seenApproved.current.has(s.id)) {
            seenApproved.current.add(s.id);
            toast.success(`✅ AI onay: ${s.symbol} ${s.direction}`, {
              description: `Güven ${((s.ai_confidence || 0) * 100).toFixed(0)}% · ${s.timeframe}`,
              duration: 4000,
            });
          }
        }
        // Cap memory
        if (seenIds.current.size > 500) {
          seenIds.current = new Set(Array.from(seenIds.current).slice(-300));
        }
        if (seenApproved.current.size > 200) {
          seenApproved.current = new Set(Array.from(seenApproved.current).slice(-150));
        }
      } catch {
        // swallow
      }
    };
    check();
    const id = setInterval(check, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [base]);
}
