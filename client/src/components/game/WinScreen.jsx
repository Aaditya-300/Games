import { useGameStore } from '../../store/gameStore';
import { useRoomStore } from '../../store/roomStore';
import realtime from '../../realtime';
import { getPlayerId } from '../../identity';

export default function WinScreen() {
  const { winner, rankings } = useGameStore();
  const room = useRoomStore(s => s.room);
  const myId = useRoomStore(s => s.myId) || getPlayerId();

  if (!winner) return null;

  const iWon = winner.winnerId === myId;
  const amHost = room?.hostId === myId;

  const rematch = () => realtime.emit('game:start');

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div className="anim-slide-up" style={{
        background: 'var(--bg-card)', borderRadius: 'var(--radius)',
        padding: '36px 48px', textAlign: 'center', minWidth: 340,
        boxShadow: 'var(--shadow)',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: 8 }}>{iWon ? '🏆' : '🎴'}</div>
        <h1 style={{ fontSize: '1.8rem', color: '#fff', marginBottom: 4 }}>
          {iWon ? 'You Win!' : `${winner.nickname} Wins!`}
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Game Over</p>

        <div style={{ marginBottom: 28 }}>
          <div style={{ fontWeight: 700, marginBottom: 10, color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Final Rankings
          </div>
          {rankings.map(r => (
            <div key={r.id} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '8px 12px', borderRadius: 8,
              background: r.id === myId ? 'var(--bg-hover)' : 'transparent',
              marginBottom: 4,
            }}>
              <span>
                <span style={{ marginRight: 8, fontWeight: 900 }}>#{r.rank}</span>
                {r.nickname}
                {r.id === myId && <span style={{ marginLeft: 6, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>(you)</span>}
              </span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                {r.cardCount} cards left
              </span>
            </div>
          ))}
        </div>

        {amHost && (
          <button className="btn btn-primary" onClick={rematch} style={{ width: '100%', marginBottom: 10 }}>
            Play Again
          </button>
        )}
        {!amHost && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Waiting for host to start a new game…
          </p>
        )}
      </div>
    </div>
  );
}
