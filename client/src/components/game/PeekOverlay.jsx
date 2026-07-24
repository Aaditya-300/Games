import { useEffect } from 'react';
import Card from '../shared/Card';
import { useGameStore } from '../../store/gameStore';

export default function PeekOverlay() {
  const peekData = useGameStore(s => s.peekData);
  const clearPeek = useGameStore(s => s.clearPeek);

  useEffect(() => {
    if (!peekData) return;
    const t = setTimeout(clearPeek, 5000);
    return () => clearTimeout(t);
  }, [peekData]);

  if (!peekData) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 900,
    }} onClick={clearPeek}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 'var(--radius)',
        padding: '24px 28px', maxWidth: 500,
      }}>
        <h3 style={{ marginBottom: 16, color: '#fff' }}>
          Peeking at {peekData.targetNickname}'s hand
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {peekData.hand.map(c => <Card key={c.id} card={c} small />)}
        </div>
        <p style={{ marginTop: 14, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
          Click anywhere to dismiss (auto-closes in 5s)
        </p>
      </div>
    </div>
  );
}
