import { useRoomStore } from '../../store/roomStore';
import { getPlayerId } from '../../identity';

export default function PlayerList({ onKick, onRemoveBot }) {
  const room = useRoomStore(s => s.room);
  const myId = useRoomStore(s => s.myId) || getPlayerId();

  if (!room) return null;

  const amHost = room.hostId === myId;

  return (
    <div>
      <div style={{ fontWeight: 700, marginBottom: 10, color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Players ({room.players.length} / {room.maxPlayers})
      </div>
      {room.players.map(p => (
        <div key={p.id} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px', borderRadius: 8,
          background: p.id === myId ? 'var(--bg-hover)' : 'transparent',
          marginBottom: 4,
        }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: p.isConnected ? '#4caf50' : '#f44336',
          }} />
          <span style={{ flex: 1, fontWeight: p.id === myId ? 700 : 400 }}>
            {p.nickname}
            {p.isHost && <span style={{ marginLeft: 6, fontSize: '0.72rem', background: 'var(--text-accent)', padding: '2px 6px', borderRadius: 4 }}>HOST</span>}
            {p.id === myId && <span style={{ marginLeft: 6, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>(you)</span>}
          </span>
          {p.isBot && <span style={{ marginLeft: 4, fontSize: '0.72rem', background: 'rgba(99,179,237,0.25)', color: '#63b3ed', padding: '2px 6px', borderRadius: 4 }}>BOT</span>}
          {amHost && p.id !== myId && (
            <button className="btn btn-danger" onClick={() => p.isBot ? onRemoveBot?.(p.id) : onKick?.(p.id)} style={{ padding: '3px 8px', fontSize: '0.75rem' }}>
              {p.isBot ? 'Remove' : 'Kick'}
            </button>
          )}
        </div>
      ))}
      {room.spectators.length > 0 && (
        <>
          <div style={{ fontWeight: 700, marginTop: 14, marginBottom: 8, color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Spectators ({room.spectators.length})
          </div>
          {room.spectators.map(p => (
            <div key={p.id} style={{ padding: '6px 12px', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              👁 {p.nickname}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
