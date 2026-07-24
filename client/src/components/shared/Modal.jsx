import '../../styles/animations.css';

export default function Modal({ title, children, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div className="anim-slide-up" style={{
        background: 'var(--bg-card)', borderRadius: 'var(--radius)',
        padding: '28px 32px', minWidth: 320, maxWidth: 480,
        boxShadow: 'var(--shadow)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ color: '#fff', fontSize: '1.2rem' }}>{title}</h2>
          {onClose && (
            <button onClick={onClose} style={{ background: 'none', color: 'var(--text-secondary)', fontSize: '1.4rem', lineHeight: 1 }}>
              ×
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
