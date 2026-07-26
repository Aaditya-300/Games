import Modal from '../shared/Modal';
import { useUiStore } from '../../store/uiStore';
import { useRoomStore } from '../../store/roomStore';
import realtime from '../../realtime';
import { getPlayerId } from '../../identity';

export default function SwapTargetPicker() {
  const { showSwapTarget, closeSwapTarget } = useUiStore();
  const room = useRoomStore(s => s.room);
  const myId = useRoomStore(s => s.myId) || getPlayerId();
  if (!showSwapTarget || !room) return null;

  const others = room.players.filter(p => p.id !== myId);

  const pick = (targetId) => {
    realtime.emit('game:choose_swap_target', { targetId });
    closeSwapTarget();
  };

  return (
    <Modal title="Swap Hands With…">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {others.map(p => (
          <button key={p.id} className="btn btn-secondary" onClick={() => pick(p.id)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{p.nickname}</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{p.cardCount} cards</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
