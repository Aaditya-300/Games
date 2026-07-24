import { useNavigate } from 'react-router-dom';
import { useRoomStore } from '../store/roomStore';
import { useGameStore } from '../store/gameStore';
import PlayerList from '../components/lobby/PlayerList';
import RoomCode from '../components/lobby/RoomCode';
import ChatSidebar from '../components/chat/ChatSidebar';
import LeaveButton from '../components/shared/LeaveButton';
import socket from '../socket';

export default function LobbyPage() {
  const navigate = useNavigate();
  const room = useRoomStore(s => s.room);
  const myId = useRoomStore(s => s.myId) || socket.id;
  const gameState = useGameStore(s => s.gameState);

  if (!room) return null;

  const amHost = room.hostId === myId;
  const playerCount = room.players.length;
  const canStart = amHost && playerCount >= 1;

  const startGame = () => socket.emit('game:start');
  const kickPlayer = (id) => socket.emit('room:kick', { targetId: id });
  const addBot = () => socket.emit('room:add_bot');
  const removeBot = (id) => socket.emit('room:remove_bot', { botId: id });

  const leaveRoom = () => {
    socket.emit('room:leave');
    useRoomStore.getState().reset();
    useGameStore.getState().reset();
    navigate('/');
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Main area */}
      <div style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
        <div style={{ maxWidth: 540 }}>
          <LeaveButton onClick={leaveRoom} />

          <h2 style={{ fontSize: '1.4rem', marginBottom: 4, color: '#fff' }}>Game Lobby</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: '0.9rem' }}>
            Share the room code with friends
          </p>

          <RoomCode code={room.code} />

          {room.hasPassword && (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: 20 }}>
              🔒 Password-protected room
            </div>
          )}

          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: '20px 24px', marginTop: 20 }}>
            <PlayerList onKick={kickPlayer} onRemoveBot={removeBot} />
          </div>

          <div style={{ marginTop: 24 }}>
            {amHost ? (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <button
                    className="btn btn-primary"
                    onClick={startGame}
                    style={{ flex: 1, padding: '14px', fontSize: '1.05rem' }}
                  >
                    🎮 Start Game
                  </button>
                  <button
                    className="btn"
                    onClick={addBot}
                    style={{ padding: '14px 16px', fontSize: '0.9rem', background: 'rgba(99,179,237,0.15)', border: '1px solid rgba(99,179,237,0.3)', color: '#63b3ed', borderRadius: 'var(--radius)', cursor: 'pointer' }}
                  >
                    + Bot
                  </button>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: 4, textAlign: 'center' }}>
                  Max {room.maxPlayers} players. Add bots to fill empty spots.
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
      </div>

      {/* Chat */}
      <ChatSidebar />
    </div>
  );
}
