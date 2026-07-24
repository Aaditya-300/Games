import '../../styles/card.css';

const CUSTOM_SYMBOL = {
  swap_hands: '⇄',
  shield: '🛡',
  draw_until_color: '⬇',
  discard_color: '✕',
  peek: '👁',
  sabotage: '💣',
};

const TYPE_LABEL = {
  skip: 'Skip',
  reverse: 'Reverse',
  draw2: 'Draw 2',
  wild: 'Wild',
  wild_draw4: 'Wild Draw 4',
  swap_hands: 'Swap Hands',
  shield: 'Shield',
  draw_until_color: 'Draw Until Color',
  discard_color: 'Discard Color',
  peek: 'Peek',
  sabotage: 'Sabotage',
};

function SkipIcon({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="3" />
      <line x1="6.5" y1="17.5" x2="17.5" y2="6.5" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function ReverseIcon({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 8.5h14M12 3.5l5 5-5 5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M21 15.5H7M12 20.5l-5-5 5-5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function DrawStack({ colors, small }) {
  return (
    <div className="draw-stack">
      {colors.map((c, i) => (
        <span key={i} className={`mini-card${c ? ` mini-${c}` : ' mini-plain'}`} />
      ))}
    </div>
  );
}

function Pinwheel({ size }) {
  return <div className="pinwheel" style={{ width: size, height: size }} />;
}

function CardCenter({ card, small }) {
  const iconSize = small ? 20 : 32;

  switch (card.type) {
    case 'number':
      return <span className="card-number">{card.value}</span>;
    case 'skip':
      return <SkipIcon size={iconSize} />;
    case 'reverse':
      return <ReverseIcon size={iconSize} />;
    case 'draw2':
      return (
        <div className="draw-icon">
          <DrawStack colors={[null, null]} small={small} />
          <span className="draw-icon-label">+2</span>
        </div>
      );
    case 'wild':
      return <Pinwheel size={small ? 26 : 44} />;
    case 'wild_draw4':
      return (
        <div className="draw-icon">
          <DrawStack colors={['red', 'yellow', 'green', 'blue']} small={small} />
          <span className="draw-icon-label">+4</span>
        </div>
      );
    default:
      return <span className="card-custom-symbol">{CUSTOM_SYMBOL[card.type] || '?'}</span>;
  }
}

function cornerContent(card) {
  switch (card.type) {
    case 'number': return String(card.value);
    case 'skip': return '⊘';
    case 'reverse': return '⇄';
    case 'draw2': return '+2';
    case 'wild': return null;
    case 'wild_draw4': return '+4';
    default: return CUSTOM_SYMBOL[card.type] || '?';
  }
}

export default function Card({ card, playable = false, onClick, small = false }) {
  if (!card) return null;

  const isBlackWild = card.type === 'wild' || card.type === 'wild_draw4';
  const colorClass = isBlackWild ? 'card-black' : `card-${card.color}`;
  const corner = cornerContent(card);

  const cls = ['card', colorClass, playable && 'playable', small && 'card-small']
    .filter(Boolean).join(' ');

  return (
    <div className={cls} onClick={playable ? onClick : undefined} title={TYPE_LABEL[card.type] ?? card.label}>
      {!isBlackWild && <div className="card-oval" />}
      <span className="card-corner">{corner ?? <span className="card-corner-dot" />}</span>
      <div className="card-center">
        <CardCenter card={card} small={small} />
      </div>
      <span className="card-corner bottom">{corner ?? <span className="card-corner-dot" />}</span>
    </div>
  );
}

export function CardBack({ small = false }) {
  return (
    <div className={`card card-back ${small ? 'card-small' : ''}`}>
      <div className="card-back-oval" />
      <span className="card-back-logo">UNO</span>
    </div>
  );
}
