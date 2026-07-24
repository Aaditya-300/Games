import { useNavigate } from 'react-router-dom';
import { useRoomStore } from '../store/roomStore';
import { useIqStore } from '../store/iqStore';
import PlayerList from '../components/lobby/PlayerList';
import RoomCode from '../components/lobby/RoomCode';
import ChatSidebar from '../components/chat/ChatSidebar';
import LeaveButton from '../components/shared/LeaveButton';
import socket from '../socket';

export default function IqLobbyPage() {
  const navigate = useNavigate();
  const room = useRoomStore(s => s.room);
  const myId = useRoomStore(s => s.myId) || socket.id;

  if (!room) return null;

  const amHost = room.hostId === myId;

  const startGame = () => socket.emit('iq:start');
  const kickPlayer = (id) => socket.emit('room:kick', { targetId: id });
  const addBot = () => socket.emit('room:add_bot');
  const removeBot = (id) => socket.emit('room:remove_bot', { botId: id });

  const leaveRoom = () => {
    socket.emit('room:leave');
    useRoomStore.getState().reset();
    useIqStore.getState().reset();
    navigate('/');
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
        <div style={{ maxWidth: 540 }}>
          <LeaveButton onClick={leaveRoom} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <span style={{ fontSize: '2rem' }}>🧠</span>
            <div>
              <h2 style={{ fontSize: '1.4rem', color: '#fff' }}>IQ Test — Lobby</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>General knowledge trivia, beat the clock</p>
            </div>
          </div>

          <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: '0.9rem' }}>
            Share the room code with friends to invite them.
          </p>

          <RoomCode code={room.code} />

          {room.hasPassword && (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: 20 }}>
              🔒 Password-protected room
            </div>
          )}

          <div style={{
            background: 'rgba(126,87,194,0.08)', border: '1px solid rgba(126,87,194,0.25)',
            borderRadius: 10, padding: '12px 16px', marginBottom: 20, marginTop: 4,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: '#b39ddb', fontSize: '0.85rem' }}>📋 How to Play</div>
            <ul style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', paddingLeft: 16, lineHeight: 1.8 }}>
              <li>Everyone answers the same multiple-choice question at once</li>
              <li>You have 20 seconds per question</li>
              <li>Faster correct answers earn more points (up to 1000, min 100)</li>
              <li>Wrong or missed answers earn 0 points</li>
              <li>10 questions total — highest score wins!</li>
            </ul>
          </div>

          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: '20px 24px', marginBottom: 24 }}>
            <PlayerList onKick={kickPlayer} onRemoveBot={removeBot} />
          </div>

          {amHost ? (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <button
                  className="btn btn-primary"
                  onClick={startGame}
                  style={{ flex: 1, padding: '14px', fontSize: '1.05rem' }}
                >
                  🧠 Start IQ Test
                </button>
                <button
                  onClick={addBot}
                  style={{ padding: '14px 16px', fontSize: '0.9rem', background: 'rgba(99,179,237,0.15)', border: '1px solid rgba(99,179,237,0.3)', color: '#63b3ed', borderRadius: 'var(--radius)', cursor: 'pointer' }}
                >
                  + Bot
                </button>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: 4, textAlign: 'center' }}>
                Max {room.maxPlayers} players.
              </p>
            </>
          ) : (
            <div style={{
              background: 'var(--bg-card)', borderRadius: 10, padding: '14px 18px',
              color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.9rem',
            }}>
              ⏳ Waiting for host to start the game…
            </div>
          )}
        </div>
      </div>
      <ChatSidebar />
    </div>
  );
}
