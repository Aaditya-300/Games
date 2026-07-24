import { useGame } from '../../hooks/useGame';
import { useGameStore } from '../../store/gameStore';
import { useRoomStore } from '../../store/roomStore';
import socket from '../../socket';

export default function UnoButton() {
  const { hand } = useGame();
  const gameState = useGameStore(s => s.gameState);
  const myId = useRoomStore(s => s.myId) || socket.id;

  const myCardCount = hand.length;
  const unoCalled = gameState?.unoCalled || [];

  const iHaveCalled = unoCalled.includes(myId);
  const shouldPulse = myCardCount <= 2 && !iHaveCalled;

  const callUno = () => socket.emit('game:call_uno', {});

  // Also allow catching others who haven't called
  const catchOthers = gameState?.activePlayers?.filter(id => {
    if (id === myId) return false;
    const player = gameState && id;
    return !unoCalled.includes(id);
  }) || [];

  return (
    <div style={{
      position: 'fixed', bottom: 160, right: 24, zIndex: 100,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8,
    }}>
      <button
        className={`btn ${iHaveCalled ? 'btn-secondary' : 'btn-primary'} ${shouldPulse ? 'anim-pulse' : ''}`}
        onClick={callUno}
        style={{
          fontSize: '1.1rem', fontWeight: 900, padding: '12px 20px',
          borderRadius: 50, boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
          minWidth: 80,
        }}
      >
        UNO!
      </button>
    </div>
  );
}
