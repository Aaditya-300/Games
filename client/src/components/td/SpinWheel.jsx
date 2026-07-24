import { useRef, useEffect, useState } from 'react';

const SEGMENT_COLORS = [
  '#e53935', '#1e88e5', '#43a047', '#ff6f00',
  '#6a1b9a', '#00838f', '#c62828', '#2e7d32',
  '#1565c0', '#f57f17',
];

export default function SpinWheel({ players, targetIndex, isSpinning, onSpinEnd }) {
  const wheelRef = useRef(null);
  const [finalRotation, setFinalRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);

  const N = players.length;

  useEffect(() => {
    if (!isSpinning || targetIndex == null || N === 0) return;

    const segCenter = (targetIndex + 0.5) * (360 / N);
    const toTop = (360 - segCenter) % 360;
    const deg = 360 * 6 + toTop;

    setFinalRotation(deg);
    setSpinning(true);
  }, [isSpinning, targetIndex, N]);

  const handleAnimEnd = () => {
    setSpinning(false);
    onSpinEnd?.();
  };

  if (N === 0) return null;

  // Build conic-gradient
  const gradient = players.map((_, i) => {
    const start = (360 / N) * i;
    const end = (360 / N) * (i + 1);
    return `${SEGMENT_COLORS[i % SEGMENT_COLORS.length]} ${start}deg ${end}deg`;
  }).join(', ');

  // Highlight segment after spin (rotate the base so target is at top)
  const segCenter = targetIndex != null ? (targetIndex + 0.5) * (360 / N) : 0;
  const toTop = (360 - segCenter) % 360;
  const baseAngle = isSpinning || spinning ? 0 : (targetIndex != null ? toTop : 0);

  return (
    <div style={{ position: 'relative', width: 280, height: 280, margin: '0 auto' }}>
      {/* Pointer */}
      <div style={{
        position: 'absolute', top: -18, left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '1.6rem', zIndex: 10, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
      }}>
        ▼
      </div>

      {/* Wheel */}
      <div
        ref={wheelRef}
        onAnimationEnd={handleAnimEnd}
        style={{
          width: '100%', height: '100%',
          borderRadius: '50%',
          background: `conic-gradient(${gradient})`,
          boxShadow: '0 4px 24px rgba(0,0,0,0.5), inset 0 0 0 4px rgba(255,255,255,0.15)',
          position: 'relative',
          transform: spinning ? undefined : `rotate(${baseAngle}deg)`,
          '--final-rotation': `${finalRotation}deg`,
          animation: spinning ? 'wheelSpin 3s cubic-bezier(0.17, 0.67, 0.12, 0.99) forwards' : 'none',
          transition: spinning ? 'none' : 'transform 0.4s ease',
        }}
      >
        {/* Segment labels */}
        {players.map((p, i) => {
          const midAngle = (360 / N) * i + (360 / N) / 2;
          const label = p.nickname.slice(0, 9);
          return (
            <div
              key={p.id}
              style={{
                position: 'absolute',
                top: '50%', left: '50%',
                transformOrigin: 'left center',
                transform: `rotate(${midAngle}deg) translateX(28px) translateY(-50%)`,
                color: '#fff',
                fontWeight: 700,
                fontSize: `clamp(0.52rem, ${14 / N}px, 0.78rem)`,
                textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              {label}
            </div>
          );
        })}

        {/* Center circle */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 44, height: 44, borderRadius: '50%',
          background: 'var(--bg-dark)',
          border: '3px solid rgba(255,255,255,0.2)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          zIndex: 5,
        }} />
      </div>
    </div>
  );
}
