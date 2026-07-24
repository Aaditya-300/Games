export default function LeaveButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16,
        padding: '6px 14px', fontSize: '0.85rem', fontWeight: 600,
        color: '#ff6b6b', background: 'rgba(233,69,96,0.1)',
        border: '1px solid rgba(233,69,96,0.35)',
        borderRadius: 8, cursor: 'pointer',
        transition: 'background var(--transition), border-color var(--transition)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(233,69,96,0.2)';
        e.currentTarget.style.borderColor = 'rgba(233,69,96,0.6)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(233,69,96,0.1)';
        e.currentTarget.style.borderColor = 'rgba(233,69,96,0.35)';
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
      Back to Main Menu
    </button>
  );
}
