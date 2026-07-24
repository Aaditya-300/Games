import '../../styles/animations.css';

export default function Spinner() {
  return (
    <div style={{
      width: 36, height: 36, border: '4px solid rgba(255,255,255,0.15)',
      borderTopColor: 'var(--text-accent)', borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
      display: 'inline-block',
    }} />
  );
}
