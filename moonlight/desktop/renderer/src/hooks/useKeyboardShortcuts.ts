import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Global keyboard shortcuts (Gmail-style "g <letter>").
 *  g d → dashboard
 *  g l → live/signals
 *  g i → intel
 *  g a → ai-coach
 *  g s → data-sources
 *  g b → backtests
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  useEffect(() => {
    let lastG = 0;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (target?.isContentEditable) return;
      const key = e.key.toLowerCase();
      if (key === 'g') {
        lastG = Date.now();
        return;
      }
      if (Date.now() - lastG < 900) {
        lastG = 0;
        const routes: Record<string, string> = {
          d: '/dashboard',
          l: '/live/signals',
          i: '/intel',
          a: '/ai-coach',
          s: '/data-sources',
          b: '/backtests',
          h: '/data-health',
        };
        if (routes[key]) {
          e.preventDefault();
          navigate(routes[key]);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);
}
