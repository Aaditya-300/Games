import GameBoard from '../components/game/GameBoard';
import ChatSidebar from '../components/chat/ChatSidebar';

export default function GamePage() {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <GameBoard spectator={false} />
      <ChatSidebar />
    </div>
  );
}
