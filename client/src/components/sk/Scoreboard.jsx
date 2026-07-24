export default function Scoreboard({ scores, prevScores, players, title, onContinue, showContinue, continueLabel }) {
  if (!scores || !players) return null;

  const ranked = [...players]
    .filter(p => scores[p.id] !== undefined)
    .map(p => ({
      ...p,
      score: scores[p.id] ?? 0,
      delta: (scores[p.id] ?? 0) - (prevScores?.[p.id] ?? 0),
    }))
    .sort((a, b) => b.score - a.score);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }}>
      <div className="anim-slide-up" style={{
        background: 'var(--bg-card)', borderRadius: 16,
        padding: '32px 36px', maxWidth: 420, width: '100%',
        boxShadow: 'var(--shadow)', textAlign: 'center',
      }}>
        <div style={{ fontSize: '2rem', marginBottom: 6 }}>🏆</div>
        <h2 style={{ color: '#fff', fontSize: '1.3rem', marginBottom: 20 }}>{title}</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {ranked.map((p, i) => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', borderRadius: 10,
              background: i === 0 ? 'rgba(253,216,53,0.1)' : 'var(--bg-surface)',
              border: i === 0 ? '1px solid rgba(253,216,53,0.25)' : '1px solid rgba(255,255,255,0.06)',
            }}>
              <span style={{ fontSize: '1.1rem', width: 28, textAlign: 'center' }}>
                {medals[i] ?? `${i + 1}.`}
              </span>
              <span style={{ flex: 1, color: '#fff', fontWeight: i === 0 ? 700 : 400, textAlign: 'left' }}>
                {p.nickname}
              </span>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>
                {p.score}
              </span>
              {p.delta > 0 && (
                <span style={{
                  color: '#66bb6a', fontSize: '0.78rem', fontWeight: 700,
                  minWidth: 40, textAlign: 'right',
                }}>
                  +{p.delta}
                </span>
              )}
            </div>
          ))}
        </div>

        {showContinue && (
          <button
            className="btn btn-primary"
            onClick={onContinue}
            style={{ padding: '12px 28px', fontSize: '1rem' }}
          >
            {continueLabel ?? 'Continue'}
          </button>
        )}
      </div>
    </div>
  );
}
