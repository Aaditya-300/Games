import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

export function useTurnTimer() {
  const turnTimeout = useGameStore(s => s.turnTimeout);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!turnTimeout) return;

    const tick = () => {
      const left = Math.max(0, turnTimeout - Date.now());
      setRemaining(left);
      if (left > 0) raf = requestAnimationFrame(tick);
    };

    let raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [turnTimeout]);

  const duration = 30000;
  const pct = turnTimeout ? Math.min(100, (remaining / duration) * 100) : 0;

  return { remaining, pct };
}
