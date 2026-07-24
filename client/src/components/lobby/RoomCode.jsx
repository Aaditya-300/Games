import { useState } from 'react';

export default function RoomCode({ code }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 10, padding: '10px 20px',
        letterSpacing: '0.2em', fontWeight: 900, fontSize: '1.8rem', color: '#fff',
      }}>
        {code}
      </div>
      <button className="btn btn-secondary" onClick={copy} style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  );
}
