import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { useRoomStore } from '../store/roomStore';
import realtime from '../realtime';
import { getPlayerId } from '../identity';

export function useTurnTimer() {
  const turnTimeout = useGameStore(s => s.turnTimeout);
  const gameState = useGameStore(s => s.gameState);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!turnTimeout) return;

    const myId = useRoomStore.getState().myId || getPlayerId();
    const isMyTurn = gameState?.currentPlayerId === myId;
    let reported = false;

    const tick = () => {
      const left = Math.max(0, turnTimeout - Date.now());
      setRemaining(left);
      if (left > 0) {
        raf = requestAnimationFrame(tick);
      } else if (isMyTurn && !reported) {
        // The server also schedules a QStash safety-net callback for closed
        // tabs, but the common case (this tab open) resolves instantly via
        // this self-report instead of waiting on that scheduled callback.
        reported = true;
        realtime.emit('game:turn_timeout', {
          expectedPlayerId: myId,
          expectedTurnStartedAt: gameState?.turnStartedAt,
        });
      }
    };

    let raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [turnTimeout]);

  const duration = 30000;
  const pct = turnTimeout ? Math.min(100, (remaining / duration) * 100) : 0;

  return { remaining, pct };
}
