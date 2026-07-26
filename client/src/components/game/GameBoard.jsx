import { useRoomStore } from '../../store/roomStore';
import { useGame } from '../../hooks/useGame';
import realtime from '../../realtime';
import { getPlayerId } from '../../identity';
import PlayerSeat from './PlayerSeat';
import DrawPile from './DrawPile';
import DiscardPile from './DiscardPile';
import PlayerHand from './PlayerHand';
import TurnTimer from './TurnTimer';
import UnoButton from './UnoButton';
import ColorPicker from './ColorPicker';
import SwapTargetPicker from './SwapTargetPicker';
import SabotageTargetPicker from './SabotageTargetPicker';
import DiscardColorPicker from './DiscardColorPicker';
import ChallengePrompt from './ChallengePrompt';
import PeekOverlay from './PeekOverlay';
import WinScreen from './WinScreen';

export default function GameBoard({ spectator = false }) {
  const room = useRoomStore(s => s.room);
  const myId = useRoomStore(s => s.myId) || getPlayerId();
  const { gameState, isMyTurn, phase } = useGame();

  if (!room || !gameState) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-secondary)' }}>
      Loading game…
    </div>
  );

  const allPlayers = room.players;
  const others = allPlayers.filter(p => p.id !== myId);
  const me = allPlayers.find(p => p.id === myId);

  const handlePlayCard = (card) => {
    if (!isMyTurn || spectator) return;
    realtime.emit('game:play_card', { cardId: card.id });
  };

  const handleDraw = () => {
    if (!isMyTurn || spectator) return;
    realtime.emit('game:draw_card');
  };

  const handlePass = () => {
    if (!isMyTurn || spectator) return;
    realtime.emit('game:pass');
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Opponents row */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10,
        padding: '12px 16px', background: 'rgba(0,0,0,0.2)', minHeight: 100,
      }}>
        {others.map(p => (
          <PlayerSeat
            key={p.id}
            player={p}
            isCurrentTurn={gameState.currentPlayerId === p.id}
            isMe={false}
            cardCount={p.cardCount}
          />
        ))}
      </div>

      {/* Center table */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 16, padding: 16,
      }}>
        <TurnTimer />

        <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
          <DrawPile onDraw={handleDraw} />
          <DiscardPile />
        </div>

        {/* Direction indicator */}
        <div style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>
          {gameState.direction === 1 ? '→ Clockwise' : '← Counter-clockwise'}
        </div>

        {/* Pass button */}
        {isMyTurn && phase === 'drawn' && !spectator && (
          <button className="btn btn-secondary" onClick={handlePass}>
            Pass (skip after drawing)
          </button>
        )}

        {/* Turn indicator */}
        <div style={{ fontSize: '0.9rem', color: isMyTurn ? 'var(--text-accent)' : 'var(--text-secondary)', fontWeight: isMyTurn ? 700 : 400 }}>
          {isMyTurn ? "Your turn!" : `${allPlayers.find(p => p.id === gameState.currentPlayerId)?.nickname ?? '…'}'s turn`}
        </div>
      </div>

      {/* My hand */}
      {!spectator && (
        <div style={{ position: 'relative' }}>
          {me && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 16px', background: 'var(--bg-card)' }}>
              <span style={{ fontWeight: 700 }}>{me.nickname}</span>
              {me.shieldActive && <span title="Shield active">🛡</span>}
            </div>
          )}
          <PlayerHand onPlayCard={handlePlayCard} />
          <UnoButton />
        </div>
      )}

      {/* Modals & overlays */}
      {!spectator && (
        <>
          <ColorPicker />
          <SwapTargetPicker />
          <SabotageTargetPicker />
          <DiscardColorPicker />
          <ChallengePrompt />
          <PeekOverlay />
        </>
      )}
      <WinScreen />
    </div>
  );
}
