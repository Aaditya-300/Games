import Card from '../shared/Card';
import { useGame } from '../../hooks/useGame';

export default function PlayerHand({ onPlayCard }) {
  const { hand, legalCards, isMyTurn, phase } = useGame();

  const legalIds = new Set(legalCards.map(c => c.id));
  const canPlay = isMyTurn && (phase === 'play' || phase === 'drawn');

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
      gap: 6, padding: '12px 16px',
      background: 'var(--bg-card)', borderRadius: '14px 14px 0 0',
      minHeight: 130,
    }}>
      {hand.length === 0 && (
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', alignSelf: 'center' }}>
          No cards
        </div>
      )}
      {hand.map(card => (
        <Card
          key={card.id}
          card={card}
          playable={canPlay && legalIds.has(card.id)}
          onClick={() => onPlayCard(card)}
        />
      ))}
    </div>
  );
}
