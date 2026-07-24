import { useRef, useEffect, useState } from 'react';
import { useChatStore } from '../../store/chatStore';
import { useRoomStore } from '../../store/roomStore';
import ChatMessage from './ChatMessage';
import socket from '../../socket';

export default function ChatSidebar() {
  const messages = useChatStore(s => s.messages);
  const myId = useRoomStore(s => s.myId);
  const [text, setText] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    socket.emit('chat:send', { text: text.trim() });
    setText('');
  };

  return (
    <div style={{
      width: 260, background: 'var(--bg-card)', display: 'flex',
      flexDirection: 'column', borderLeft: '1px solid rgba(255,255,255,0.08)',
      height: '100%',
    }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontWeight: 700, fontSize: '0.9rem' }}>
        Chat
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
        {messages.map(m => <ChatMessage key={m.id} msg={m} myId={myId || socket.id} />)}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 6 }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type a message…"
          maxLength={300}
          style={{
            flex: 1, background: 'var(--bg-surface)', border: 'none',
            borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: '0.85rem',
          }}
        />
        <button type="submit" className="btn btn-primary" style={{ padding: '8px 12px', fontSize: '0.8rem' }}>
          Send
        </button>
      </form>
    </div>
  );
}
