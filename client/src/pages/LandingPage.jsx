import { useState } from 'react';
import realtime from '../realtime';
import '../styles/animations.css';

const GAMES = [
  { id: 'uno', emoji: '🃏', title: 'UNO', desc: 'Classic card game, 2–15 players' },
  { id: 'truth_dare', emoji: '🎲', title: 'Truth or Dare', desc: 'Party fun, spin the wheel, 2–20 players' },
  { id: 'sketch', emoji: '✏️', title: 'Sketch & Draw', desc: 'Draw it, guess it, 2–20 players' },
  { id: 'iq', emoji: '🧠', title: 'IQ Test', desc: 'General knowledge MCQ, beat the clock, 2–20 players' },
];

export default function LandingPage() {
  const [tab, setTab] = useState('create');
  const [gameType, setGameType] = useState('uno');
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (!nickname.trim()) return;

    if (tab === 'create') {
      realtime.emit('room:create', { nickname: nickname.trim(), password: usePassword ? password : undefined, gameType });
    } else if (tab === 'join') {
      realtime.emit('room:join', { nickname: nickname.trim(), roomCode: roomCode.trim().toUpperCase(), password: password || undefined });
    } else {
      realtime.emit('room:spectate', { nickname: nickname.trim(), roomCode: roomCode.trim().toUpperCase(), password: password || undefined });
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div className="anim-fade" style={{
        background: 'var(--bg-card)', borderRadius: 'var(--radius)',
        padding: '40px 44px', width: '100%', maxWidth: 460,
        boxShadow: 'var(--shadow)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: '2.8rem', marginBottom: 4 }}>🎮</div>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 900, color: '#fff' }}>Game Room</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Online multiplayer party games</p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 22, background: 'var(--bg-dark)', borderRadius: 10, padding: 4 }}>
          {['create', 'join', 'spectate'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
              background: tab === t ? 'var(--bg-surface)' : 'transparent',
              color: tab === t ? '#fff' : 'var(--text-secondary)',
              fontWeight: tab === t ? 700 : 400, fontSize: '0.88rem',
              textTransform: 'capitalize', cursor: 'pointer',
              transition: 'all var(--transition)',
            }}>
              {t === 'create' ? 'Create' : t === 'join' ? 'Join' : 'Spectate'}
            </button>
          ))}
        </div>

        <form onSubmit={submit}>
          {/* Game selector — only on Create tab */}
          {tab === 'create' && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Choose a Game
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {GAMES.map(g => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGameType(g.id)}
                    style={{
                      padding: '14px 10px', borderRadius: 10, border: '2px solid',
                      borderColor: gameType === g.id ? 'var(--text-accent)' : 'rgba(255,255,255,0.1)',
                      background: gameType === g.id ? 'rgba(233,69,96,0.12)' : 'var(--bg-surface)',
                      cursor: 'pointer', textAlign: 'center',
                      transition: 'all var(--transition)',
                    }}
                  >
                    <div style={{ fontSize: '1.8rem', marginBottom: 4 }}>{g.emoji}</div>
                    <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>{g.title}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', marginTop: 2 }}>{g.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Your Nickname
            </label>
            <input
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder="e.g. CardShark99"
              maxLength={20}
              required
              style={{
                width: '100%', padding: '10px 14px',
                background: 'var(--bg-surface)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, color: '#fff', fontSize: '0.95rem',
              }}
            />
          </div>

          {(tab === 'join' || tab === 'spectate') && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Room Code
              </label>
              <input
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                placeholder="e.g. K3X9PQ"
                maxLength={6}
                required
                style={{
                  width: '100%', padding: '10px 14px',
                  background: 'var(--bg-surface)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, color: '#fff', fontSize: '1.2rem',
                  letterSpacing: '0.15em', fontWeight: 700, textTransform: 'uppercase',
                }}
              />
            </div>
          )}

          {tab === 'create' && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={usePassword} onChange={e => setUsePassword(e.target.checked)} />
                Password-protect this room
              </label>
            </div>
          )}

          {(usePassword || tab === 'join' || tab === 'spectate') && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Room Password (optional)
              </label>
              <input
                value={password}
                onChange={e => setPassword(e.target.value)}
                type="password"
                placeholder="Leave blank if no password"
                style={{
                  width: '100%', padding: '10px 14px',
                  background: 'var(--bg-surface)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, color: '#fff', fontSize: '0.95rem',
                }}
              />
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: '1rem' }}>
            {tab === 'create'
              ? `🎮 Create ${gameType === 'truth_dare' ? 'Truth or Dare' : gameType === 'sketch' ? 'Sketch & Draw' : gameType === 'iq' ? 'IQ Test' : 'UNO'} Room`
              : tab === 'join' ? '🚪 Join Room' : '👁 Watch as Spectator'}
          </button>
        </form>
      </div>
    </div>
  );
}
