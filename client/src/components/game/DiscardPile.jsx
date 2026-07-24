import Card from '../shared/Card';
import { useGame } from '../../hooks/useGame';

const COLOR_BG = {
  red: 'rgba(238,63,63,0.3)',
  blue: 'rgba(31,127,224,0.3)',
  green: 'rgba(58,168,67,0.3)',
  yellow: 'rgba(246,194,0,0.3)',
  wild: 'rgba(255,255,255,0.12)',
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
