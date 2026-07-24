import { CardBack } from '../shared/Card';
import { useGame } from '../../hooks/useGame';
import socket from '../../socket';

export default function DrawPile({ onDraw }) {
  const { isMyTurn, phase, pendingDraw, gameState } = useGame();
  const canDraw = isMyTurn && (phase === 'play' || phase === 'drawn' || pendingDraw > 0);

  const count = gameState?.drawPileCount || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div
        onClick={canDraw ? onDraw : undefined}
        style={{ cursor: canDraw ? 'pointer' : 'default', transform: canDraw ? undefined : undefined, transition: 'transform 0.15s' }}
        className={canDraw ? 'draw-pile-hover' : ''}
        title={canDraw ? (pendingDraw > 0 ? `Draw ${pendingDraw} cards` : 'Draw a card') : ''}
      >
        <CardBack />
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{count} cards</div>
      {pendingDraw > 0 && isMyTurn && (
        <div style={{
          background: '#f44336', color: '#fff', borderRadius: 20,
          padding: '3px 10px', fontSize: '0.78rem', fontWeight: 700,
        }}>
          Draw {pendingDraw}!
        </div>
      )}
    </div>
  );
}
