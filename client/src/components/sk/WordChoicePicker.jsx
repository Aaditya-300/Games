import { useState, useEffect } from 'react';

const PICK_TIMEOUT = 15;

export default function WordChoicePicker({ options, onPick }) {
  const [timeLeft, setTimeLeft] = useState(PICK_TIMEOUT);

  useEffect(() => {
    if (!options?.length) return;
    setTimeLeft(PICK_TIMEOUT);
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(interval);
          onPick(options[0]);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [options]);

  if (!options?.length) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }}>
      <div className="anim-slide-up" style={{
        background: 'var(--bg-card)', borderRadius: 16,
        padding: '36px 40px', maxWidth: 460, width: '100%',
        textAlign: 'center', boxShadow: 'var(--shadow)',
      }}>
        <div style={{ fontSize: '2.4rem', marginBottom: 8 }}>✏️</div>
        <h2 style={{ color: '#fff', fontSize: '1.3rem', marginBottom: 4 }}>Your turn to draw!</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: 6 }}>
          Pick a word to draw. Others will try to guess it.
        </p>
        <div style={{
          color: timeLeft <= 5 ? 'var(--text-accent)' : 'var(--text-secondary)',
          fontSize: '0.8rem', marginBottom: 24,
          transition: 'color 0.3s',
        }}>
          Auto-picks in {timeLeft}s
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {options.map((word, i) => (
            <button
              key={i}
              onClick={() => onPick(word)}
              style={{
                padding: '16px 24px', borderRadius: 12,
                border: '2px solid rgba(255,255,255,0.15)',
                background: 'var(--bg-surface)',
                color: '#fff', cursor: 'pointer',
                fontSize: '1.1rem', fontWeight: 700,
                letterSpacing: '0.05em',
                transition: 'all var(--transition)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--text-accent)';
                e.currentTarget.style.background = 'rgba(233,69,96,0.12)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                e.currentTarget.style.background = 'var(--bg-surface)';
              }}
            >
              {word}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
