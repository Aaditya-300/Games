import { CardBack } from '../shared/Card';

export default function PlayerSeat({ player, isCurrentTurn, isMe, cardCount }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      padding: '8px 10px', borderRadius: 10,
      background: isCurrentTurn ? 'rgba(233,69,96,0.2)' : 'rgba(255,255,255,0.04)',
      border: isCurrentTurn ? '2px solid var(--text-accent)' : '2px solid transparent',
      transition: 'all 0.3s', minWidth: 70,
    }}>
      {/* Mini card stack */}
      <div style={{ position: 'relative', height: 40 }}>
        {Array.from({ length: Math.min(cardCount, 4) }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute', top: i * 2, left: i * 2,
            width: 28, height: 40, borderRadius: 4,
            background: '#131313',
            border: '1px solid rgba(255,255,255,0.15)',
          }} />
        ))}
      </div>

      {/* Name */}
      <div style={{
        fontSize: '0.75rem', fontWeight: isMe ? 700 : 400,
        color: isMe ? '#fff' : 'var(--text-secondary)',
        textAlign: 'center', maxWidth: 70,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {player.nickname}
      </div>

      {/* Card count badge */}
      <div style={{
        background: isCurrentTurn ? 'var(--text-accent)' : 'var(--bg-surface)',
        color: '#fff', borderRadius: 12, padding: '1px 8px',
        fontSize: '0.72rem', fontWeight: 700,
      }}>
        {cardCount}
      </div>

      {/* Shield indicator */}
      {player.shieldActive && (
        <div title="Shield active" style={{ fontSize: '0.9rem' }}>🛡</div>
      )}

      {/* Connected indicator */}
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: player.isConnected ? '#4caf50' : '#f44336',
      }} />
    </div>
  );
}
