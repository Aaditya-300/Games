import Modal from '../shared/Modal';
import { useUiStore } from '../../store/uiStore';
import { useRoomStore } from '../../store/roomStore';
import realtime from '../../realtime';
import { getPlayerId } from '../../identity';

export default function SabotageTargetPicker() {
  const { showSabotageTarget, closeSabotageTarget } = useUiStore();
  const room = useRoomStore(s => s.room);
  const myId = useRoomStore(s => s.myId) || getPlayerId();
  if (!showSabotageTarget || !room) return null;

  const others = room.players.filter(p => p.id !== myId);

  const pick = (targetId) => {
    realtime.emit('game:choose_sabotage_target', { targetId });
    closeSabotageTarget();
  };

  return (
    <Modal title="Sabotage — Choose Target">
      <p style={{ color: 'var(--text-secondary)', marginBottom: 14, fontSize: '0.88rem' }}>
        That player will play a random card from their hand.
      </p>
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
