import { useTurnTimer } from '../../hooks/useTurnTimer';
import { useGame } from '../../hooks/useGame';
import { useRoomStore } from '../../store/roomStore';
import socket from '../../socket';

export default function TurnTimer() {
  const { pct, remaining } = useTurnTimer();
  const { gameState } = useGame();
  const myId = useRoomStore(s => s.myId) || socket.id;

  const isMyTurn = gameState?.currentPlayerId === myId;
  const color = pct > 40 ? '#4caf50' : pct > 20 ? '#ff9800' : '#f44336';

  return (
    <div style={{ width: '100%', maxWidth: 300 }}>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: color, borderRadius: 3,
          transition: 'width 0.5s linear, background 0.3s',
        }} />
      </div>
      {isMyTurn && (
        <div style={{ textAlign: 'center', marginTop: 4, fontSize: '0.8rem', color }}>
          {Math.ceil(remaining / 1000)}s
        </div>
      )}
    </div>
  );
}
