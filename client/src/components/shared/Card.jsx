import '../../styles/card.css';

const TYPE_SYMBOL = {
  skip: '⊘',
  reverse: '↺',
  draw2: '+2',
  wild: '★',
  wild_draw4: '+4',
  swap_hands: '⇄',
  shield: '🛡',
  draw_until_color: '⬇',
  discard_color: '✕',
  peek: '👁',
  sabotage: '💣',
};

export default function Card({ card, playable = false, onClick, small = false }) {
  if (!card) return null;

  const colorClass = `card-${card.color}`;
  const symbol = card.type === 'number' ? String(card.value) : TYPE_SYMBOL[card.type] || '?';

  const cls = ['card', colorClass, playable && 'playable', small && 'card-small']
    .filter(Boolean).join(' ');

  return (
    <div className={cls} onClick={playable ? onClick : undefined} title={card.label}>
      <span className="card-corner">{symbol}</span>
      <span style={{ fontSize: small ? '1rem' : '1.5rem' }}>{symbol}</span>
      {card.type !== 'number' && (
        <span className="card-label">{card.label}</span>
      )}
      <span className="card-corner bottom">{symbol}</span>
    </div>
  );
}

export function CardBack({ small = false }) {
  return (
    <div className={`card card-back ${small ? 'card-small' : ''}`}>
      <span style={{ fontSize: '1.8rem' }}>🃏</span>
    </div>
  );
}
