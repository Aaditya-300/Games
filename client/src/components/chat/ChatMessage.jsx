export default function ChatMessage({ msg, myId }) {
  const isMe = msg.senderId === myId;
  const isSystem = msg.type === 'system';

  if (isSystem) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.78rem', padding: '4px 0', fontStyle: 'italic' }}>
        {msg.text}
      </div>
    );
  }

  return (
    <div style={{
      marginBottom: 6,
      textAlign: isMe ? 'right' : 'left',
    }}>
      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>
        {msg.senderNickname}
      </span>
      <span style={{
        display: 'inline-block',
        background: isMe ? 'var(--text-accent)' : 'var(--bg-surface)',
        color: '#fff',
        borderRadius: 8,
        padding: '5px 10px',
        fontSize: '0.85rem',
        maxWidth: '85%',
        wordBreak: 'break-word',
      }}>
        {msg.text}
      </span>
    </div>
  );
}
