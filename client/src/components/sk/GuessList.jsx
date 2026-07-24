import { useEffect, useRef } from 'react';

export default function GuessList({ guesses, hint }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [guesses]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {hint && (
        <div style={{
          padding: '10px 14px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 8,
          marginBottom: 10,
          textAlign: 'center',
        }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', marginBottom: 4, letterSpacing: '0.08em' }}>
            WORD TO GUESS
          </div>
          <div style={{
            fontSize: '1.4rem', fontWeight: 900, letterSpacing: '0.25em',
            color: '#fff', fontFamily: 'monospace',
          }}>
            {hint}
          </div>
        </div>
      )}

      <div style={{
        flex: 1, overflowY: 'auto', padding: '6px 0',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        {guesses.length === 0 && (
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', textAlign: 'center', marginTop: 16 }}>
            Type a guess below…
          </div>
        )}
        {guesses.map((g, i) => (
          <div key={i} style={{
            padding: '5px 10px', borderRadius: 6,
            background: g.type === 'correct' ? 'rgba(67,160,71,0.15)' : 'transparent',
            display: 'flex', alignItems: 'baseline', gap: 6,
          }}>
            {g.type === 'correct' ? (
              <span style={{ color: '#66bb6a', fontSize: '0.85rem', fontWeight: 700 }}>
                ✓ {g.nickname} guessed it!
              </span>
            ) : (
              <>
                <span style={{ color: 'var(--text-accent)', fontSize: '0.78rem', fontWeight: 700, flexShrink: 0 }}>
                  {g.nickname}:
                </span>
                <span style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                  {g.text}
                </span>
              </>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
