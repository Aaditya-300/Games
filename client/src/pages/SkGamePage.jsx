import { useState, useEffect, useRef } from 'react';
import { useSkStore } from '../store/skStore';
import { useRoomStore } from '../store/roomStore';
import ChatSidebar from '../components/chat/ChatSidebar';
import DrawingCanvas from '../components/sk/DrawingCanvas';
import WordChoicePicker from '../components/sk/WordChoicePicker';
import GuessList from '../components/sk/GuessList';
import Scoreboard from '../components/sk/Scoreboard';
import realtime from '../realtime';
import { getPlayerId } from '../identity';

function useTimer(roundEndsAt) {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!roundEndsAt) { setTimeLeft(null); return; }
    const tick = () => {
      const left = Math.max(0, Math.round((roundEndsAt - Date.now()) / 1000));
      setTimeLeft(left);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [roundEndsAt]);

  return timeLeft;
}

function formatTime(secs) {
  if (secs == null) return '--:--';
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function SkGamePage() {
  const gameState = useSkStore(s => s.gameState);
  const drawStrokes = useSkStore(s => s.drawStrokes);
  const guesses = useSkStore(s => s.guesses);
  const wordOptions = useSkStore(s => s.wordOptions);
  const currentWord = useSkStore(s => s.currentWord);
  const hint = useSkStore(s => s.hint);
  const phase = useSkStore(s => s.phase);
  const roundEndsAt = useSkStore(s => s.roundEndsAt);
  const turnResult = useSkStore(s => s.turnResult);

  const room = useRoomStore(s => s.room);
  const myId = useRoomStore(s => s.myId) || getPlayerId();

  const [guessText, setGuessText] = useState('');
  const timeLeft = useTimer(roundEndsAt);

  const players = room?.players ?? [];
  const amHost = room?.hostId === myId;
  const isDrawer = gameState?.currentDrawerId === myId;
  const drawerNickname = players.find(p => p.id === gameState?.currentDrawerId)?.nickname ?? '…';

  const alreadyGuessed = guesses.some(g => g.type === 'correct' && g.nickname === players.find(p => p.id === myId)?.nickname);

  const handlePickWord = (word) => {
    realtime.emit('sk:pick_word', { word });
  };

  const handleGuess = (e) => {
    e.preventDefault();
    if (!guessText.trim() || alreadyGuessed) return;
    realtime.emit('sk:guess', { text: guessText.trim() });
    setGuessText('');
  };

  const handleNextRound = () => realtime.emit('sk:next_round');
  const handleEndGame = () => realtime.emit('sk:end');

  const showScoreboard = phase === 'turn_end' || phase === 'round_end' || phase === 'game_over';
  const prevScores = turnResult?.prevScores ?? gameState?.prevScores;

  const scoreboardTitle =
    phase === 'game_over' ? '🎉 Game Over!' :
    phase === 'round_end' ? `Round ${gameState?.round ? gameState.round - 1 : ''} Complete!` :
    turnResult?.word ? `The word was "${turnResult.word}"` : 'Turn Over';

  const scoreboardContinueLabel =
    phase === 'game_over' ? '🏠 Back to Lobby' :
    phase === 'round_end' ? '▶ Next Round' :
    null;

  const handleScoreboardContinue = () => {
    if (phase === 'game_over') realtime.emit('sk:end');
    else if (phase === 'round_end') handleNextRound();
  };

  if (!gameState || !room) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>
        Loading game…
      </div>
    );
  }

  const timerColor = timeLeft != null && timeLeft <= 30 ? 'var(--text-accent)' : '#fff';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{
          padding: '10px 20px', background: 'var(--bg-card)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '1.4rem' }}>✏️</span>
            <span style={{ fontWeight: 700, color: '#fff' }}>Sketch & Draw</span>
            <span style={{
              background: 'var(--bg-surface)', borderRadius: 6, padding: '2px 8px',
              fontSize: '0.78rem', color: 'var(--text-secondary)', letterSpacing: '0.1em',
            }}>
              {room.code}
            </span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
              Round {gameState.round ?? 1} / {gameState.totalRounds ?? 3}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {phase === 'drawing' && timeLeft != null && (
              <div style={{
                fontWeight: 900, fontSize: '1.2rem',
                color: timerColor,
                transition: 'color 0.3s',
                fontVariantNumeric: 'tabular-nums',
              }}>
                ⏱ {formatTime(timeLeft)}
              </div>
            )}

            {amHost && (
              <button className="btn btn-danger" onClick={handleEndGame} style={{ padding: '6px 14px', fontSize: '0.82rem' }}>
                End Game
              </button>
            )}
          </div>
        </div>

        {/* Drawer info strip */}
        <div style={{
          padding: '8px 20px', textAlign: 'center',
          background: 'rgba(0,0,0,0.1)', flexShrink: 0,
        }}>
          {phase === 'word_pick' && (
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              {isDrawer ? '🎲 Choose your word…' : `⏳ ${drawerNickname} is choosing a word…`}
            </span>
          )}
          {phase === 'drawing' && (
            <span style={{ color: '#fff', fontSize: '0.88rem' }}>
              {isDrawer
                ? <><span style={{ color: 'var(--text-accent)', fontWeight: 700 }}>You</span> are drawing: <span style={{ fontWeight: 700, letterSpacing: '0.05em' }}>{currentWord}</span></>
                : <><span style={{ color: 'var(--text-accent)', fontWeight: 700 }}>{drawerNickname}</span> is drawing{alreadyGuessed ? ' — you guessed it! ✓' : ' — type your guess!'}</>
              }
            </span>
          )}
        </div>

        {/* Main area */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Canvas area */}
          <div style={{ flex: 1, padding: '16px 16px 12px', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            <DrawingCanvas isDrawer={isDrawer} drawStrokes={drawStrokes} />

            {/* Drawer end turn button */}
            {isDrawer && phase === 'drawing' && (
              <div style={{ textAlign: 'center', marginTop: 10 }}>
                <button
                  className="btn"
                  onClick={() => realtime.emit('sk:end_turn')}
                  style={{
                    padding: '8px 20px', fontSize: '0.85rem',
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                    color: 'var(--text-secondary)', borderRadius: 8, cursor: 'pointer',
                  }}
                >
                  ✋ Give up / reveal word
                </button>
              </div>
            )}
          </div>

          {/* Guess panel — non-drawers only */}
          {!isDrawer && (
            <div style={{
              width: 260, borderLeft: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}>
              <div style={{ flex: 1, padding: '12px 10px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <GuessList guesses={guesses} hint={hint} />
              </div>

              {phase === 'drawing' && !alreadyGuessed && (
                <form onSubmit={handleGuess} style={{
                  padding: '10px', borderTop: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex', gap: 6,
                }}>
                  <input
                    value={guessText}
                    onChange={e => setGuessText(e.target.value)}
                    placeholder="Type a guess…"
                    autoComplete="off"
                    style={{
                      flex: 1, padding: '8px 10px',
                      background: 'var(--bg-surface)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8, color: '#fff', fontSize: '0.88rem',
                    }}
                  />
                  <button type="submit" className="btn btn-primary" style={{ padding: '8px 12px', fontSize: '0.88rem' }}>
                    ➤
                  </button>
                </form>
              )}

              {alreadyGuessed && phase === 'drawing' && (
                <div style={{ padding: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                  <span style={{ color: '#66bb6a', fontSize: '0.82rem', fontWeight: 700 }}>✓ You guessed it!</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Player strip */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8,
          padding: '10px 16px', background: 'var(--bg-card)',
          borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
        }}>
          {players.map(p => {
            const isCurrentDrawer = p.id === gameState.currentDrawerId;
            const score = gameState.scores?.[p.id] ?? 0;
            return (
              <div key={p.id} style={{
                padding: '4px 12px', borderRadius: 20,
                background: isCurrentDrawer ? 'rgba(233,69,96,0.2)' : 'rgba(255,255,255,0.05)',
                border: `1.5px solid ${isCurrentDrawer ? 'var(--text-accent)' : 'transparent'}`,
                fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 5,
              }}>
                {isCurrentDrawer && <span>✏️</span>}
                <span style={{ color: isCurrentDrawer ? '#fff' : 'rgba(255,255,255,0.75)', fontWeight: isCurrentDrawer ? 700 : 400 }}>
                  {p.nickname}
                </span>
                {p.id === myId && <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>(you)</span>}
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{score}pt</span>
              </div>
            );
          })}
        </div>
      </div>

      <ChatSidebar />

      {/* Word pick overlay */}
      {phase === 'word_pick' && isDrawer && wordOptions && (
        <WordChoicePicker options={wordOptions} onPick={handlePickWord} />
      )}

      {/* Scoreboard overlay */}
      {showScoreboard && (
        <Scoreboard
          scores={turnResult?.scores ?? gameState?.scores}
          prevScores={gameState?.prevScores}
          players={players}
          title={scoreboardTitle}
          showContinue={amHost && phase !== 'turn_end'}
          continueLabel={scoreboardContinueLabel}
          onContinue={handleScoreboardContinue}
        />
      )}
    </div>
  );
}
