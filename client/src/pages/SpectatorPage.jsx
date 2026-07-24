import GameBoard from '../components/game/GameBoard';
import ChatSidebar from '../components/chat/ChatSidebar';

export default function SpectatorPage() {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '8px 16px', background: 'var(--bg-surface)', fontSize: '0.82rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
          👁 Spectator Mode — You are watching but not playing
        </div>
        <GameBoard spectator={true} />
      </div>
      <ChatSidebar />
    </div>
  );
}
