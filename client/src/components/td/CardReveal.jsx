import { useEffect, useState } from 'react';
import TDCard from './TDCard';

export default function CardReveal({ card, isVisible }) {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (!isVisible || !card) {
      setFlipped(false);
      return;
    }
    // 50ms delay lets React paint the face-down state before flipping
    const t = setTimeout(() => setFlipped(true), 50);
    return () => clearTimeout(t);
  }, [isVisible, card]);

  if (!card) return null;

  return (
    <div style={{
      width: 320, height: 220,
      perspective: '900px',
      margin: '0 auto',
    }}>
      <div style={{
        width: '100%', height: '100%',
        position: 'relative',
        transformStyle: 'preserve-3d',
        transition: 'transform 0.7s cubic-bezier(0.4, 0.2, 0.2, 1)',
        transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
      }}>
        {/* Back face */}
        <div style={{
          position: 'absolute', inset: 0,
          backfaceVisibility: 'hidden',
          borderRadius: 'var(--radius)',
          background: 'var(--bg-surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '4rem', color: 'var(--text-accent)',
          boxShadow: 'var(--shadow)',
          border: '2px solid rgba(255,255,255,0.1)',
        }}>
          ?
        </div>

        {/* Front face */}
        <div style={{
          position: 'absolute', inset: 0,
          backfaceVisibility: 'hidden',
          borderRadius: 'var(--radius)',
          background: 'var(--bg-card)',
          transform: 'rotateY(180deg)',
          boxShadow: 'var(--shadow)',
          border: '2px solid rgba(255,255,255,0.12)',
          overflow: 'hidden',
        }}>
          <TDCard card={card} />
        </div>
      </div>
    </div>
  );
}
