export default function TDCard({ card }) {
  if (!card) return null;

  const isTruth = card.type === 'truth';
  const badgeColor = isTruth ? 'var(--color-blue)' : 'var(--text-accent)';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 16, padding: '24px 20px',
      width: '100%', height: '100%',
    }}>
      {/* Type badge */}
      <span style={{
        background: badgeColor, color: '#fff',
        padding: '5px 18px', borderRadius: 20,
        fontWeight: 900, fontSize: '0.82rem',
        letterSpacing: '0.12em', textTransform: 'uppercase',
      }}>
        {isTruth ? 'Truth' : 'Dare'}
      </span>

      {/* Card text */}
      <p style={{
        color: 'var(--text-primary)', fontSize: '1.05rem',
        textAlign: 'center', lineHeight: 1.55,
        maxWidth: 260, margin: 0,
      }}>
        {card.text}
      </p>
    </div>
  );
}
