import { useState, useEffect } from 'react';
import { useTdStore } from '../store/tdStore';
import { useRoomStore } from '../store/roomStore';
import ChatSidebar from '../components/chat/ChatSidebar';
import SpinWheel from '../components/td/SpinWheel';
import CardReveal from '../components/td/CardReveal';
import realtime from '../realtime';
import { getPlayerId } from '../identity';

export default function TDGamePage() {
  const gameState = useTdStore(s => s.gameState);
  const spinResult = useTdStore(s => s.spinResult);
  const phase = useTdStore(s => s.phase);
  const room = useRoomStore(s => s.room);
  const myId = useRoomStore(s => s.myId) || getPlayerId();

  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [showCard, setShowCard] = useState(false);

  const players = room?.players || [];
  const amHost = room?.hostId === myId;
  const isMyTurn = gameState?.currentSpinnerId === myId;

  // When a spin result arrives, start the wheel animation
  useEffect(() => {
    if (spinResult) {
      setShowCard(false);
      setWheelSpinning(true);
    }
  }, [spinResult]);

  const handleSpin = () => {
    if (!isMyTurn || phase !== 'spinning') return;
    realtime.emit('td:spin');
  };

  const handleDone = () => {
    if (!isMyTurn || phase !== 'card_active') return;
    setShowCard(false);
    realtime.emit('td:next_turn');
  };

  const handleWheelEnd = () => {
    setWheelSpinning(false);
    setShowCard(true);
  };

  const handleEndGame = () => {
    if (!amHost) return;
    realtime.emit('td:end');
  };

  if (!gameState || !room) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>
        Loading game…
      </div>
    );
  }

  const currentSpinner = players.find(p => p.id === gameState.currentSpinnerId);
  const targetPlayer = spinResult ? players.find(p => p.id === spinResult.targetId) : null;
  const targetIndex = spinResult ? players.findIndex(p => p.id === spinResult.targetId) : null;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Game area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{
          padding: '10px 20px', background: 'var(--bg-card)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.4rem' }}>🎲</span>
            <span style={{ fontWeight: 700, color: '#fff' }}>Truth or Dare</span>
            <span style={{
              background: 'var(--bg-surface)', borderRadius: 6, padding: '2px 8px',
              fontSize: '0.78rem', color: 'var(--text-secondary)', letterSpacing: '0.1em',
            }}>
              {room.code}
            </span>
          </div>
          {amHost && (
            <button className="btn btn-danger" onClick={handleEndGame} style={{ padding: '6px 14px', fontSize: '0.82rem' }}>
              End Game
            </button>
          )}
        </div>

        {/* Turn indicator */}
        <div style={{
          padding: '14px 20px', textAlign: 'center',
          background: 'rgba(0,0,0,0.15)',
        }}>
          {phase === 'spinning' && (
            <div>
              <span style={{ color: isMyTurn ? 'var(--text-accent)' : 'var(--text-secondary)', fontWeight: 700, fontSize: '1rem' }}>
                {isMyTurn ? '🎡 Your turn to spin!' : `⏳ ${currentSpinner?.nickname ?? '…'} is spinning…`}
              </span>
            </div>
          )}
          {(phase === 'card_active' || showCard) && spinResult && (
            <div>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>
                🃏 {spinResult.targetNickname}'s card — {spinResult.card?.type === 'truth' ? '🤔 Truth' : '💪 Dare'}!
              </span>
            </div>
          )}
        </div>

        {/* Main content */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 24, padding: 20, overflow: 'auto',
        }}>
          {/* Spin wheel — always visible */}
          <SpinWheel
            players={players}
            targetIndex={targetIndex}
            isSpinning={wheelSpinning}
            onSpinEnd={handleWheelEnd}
          />

          {/* Card reveal (shown after wheel stops) */}
          {showCard && spinResult?.card && (
            <div className="anim-slide-up">
              <CardReveal card={spinResult.card} isVisible={showCard} />
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            {isMyTurn && phase === 'spinning' && !wheelSpinning && (
              <button
                className="btn btn-primary anim-pulse"
                onClick={handleSpin}
                style={{ padding: '14px 32px', fontSize: '1.1rem', fontWeight: 900, borderRadius: 50 }}
              >
                🎡 Spin!
              </button>
            )}

            {isMyTurn && phase === 'card_active' && showCard && (
              <button
                className="btn btn-primary"
                onClick={handleDone}
                style={{ padding: '12px 28px', fontSize: '1rem' }}
              >
                ✅ Done!
              </button>
            )}
          </div>

          {/* Turn counter */}
          {gameState.turnCount > 0 && (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              Round {gameState.turnCount}
            </div>
          )}
        </div>

        {/* Player roster strip */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8,
          padding: '12px 16px', background: 'var(--bg-card)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          {players.map((p, i) => {
            const isSpinner = p.id === gameState.currentSpinnerId;
            const isTarget = spinResult && p.id === spinResult.targetId && showCard;
            return (
              <div key={p.id} style={{
                padding: '5px 12px', borderRadius: 20,
                background: isTarget ? 'rgba(233,69,96,0.25)' : isSpinner ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)',
                border: `1.5px solid ${isTarget ? 'var(--text-accent)' : isSpinner ? 'rgba(255,255,255,0.3)' : 'transparent'}`,
                fontSize: '0.82rem', fontWeight: isSpinner || isTarget ? 700 : 400,
                color: isTarget ? 'var(--text-accent)' : '#fff',
                transition: 'all 0.3s',
              }}>
                {isSpinner && '🎡 '}
                {isTarget && !isSpinner && '🃏 '}
                {p.nickname}
                {p.id === myId && <span style={{ color: 'var(--text-secondary)', marginLeft: 4, fontSize: '0.7rem' }}>(you)</span>}
              </div>
            );
          })}
        </div>
      </div>

      <ChatSidebar />
    </div>
  );
}
