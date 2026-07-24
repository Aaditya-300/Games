import Card from '../shared/Card';
import { useGame } from '../../hooks/useGame';

const COLOR_BG = {
  red: 'rgba(229,57,53,0.3)',
  blue: 'rgba(30,136,229,0.3)',
  green: 'rgba(67,160,71,0.3)',
  yellow: 'rgba(253,216,53,0.3)',
  wild: 'rgba(123,31,162,0.3)',
};

export default function DiscardPile() {
  const { topCard, currentColor } = useGame();

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      padding: 12, borderRadius: 14,
      background: COLOR_BG[currentColor] || 'rgba(255,255,255,0.05)',
      transition: 'background 0.4s',
      minWidth: 90,
    }}>
      {topCard ? <Card card={topCard} /> : (
        <div style={{ width: 70, height: 105, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '2px dashed rgba(255,255,255,0.2)' }} />
      )}
      {currentColor && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
          Color: <strong style={{ color: `var(--color-${currentColor})` }}>{currentColor}</strong>
        </div>
      )}
    </div>
  );
}
