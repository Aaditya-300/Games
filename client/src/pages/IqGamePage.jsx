import { useState, useEffect } from 'react';
import { useIqStore } from '../store/iqStore';
import { useRoomStore } from '../store/roomStore';
import ChatSidebar from '../components/chat/ChatSidebar';
import Scoreboard from '../components/sk/Scoreboard';
import socket from '../socket';

const OPTION_COLORS = ['#e53935', '#1e88e5', '#43a047', '#ff6f00'];

function useCountdown(endsAt) {
  const [secondsLeft, setSecondsLeft] = useState(null);

  useEffect(() => {
    if (!endsAt) { setSecondsLeft(null); return; }
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [endsAt]);

  return secondsLeft;
}

export default function IqGamePage() {
  const gameState = useIqStore(s => s.gameState);
  const question = useIqStore(s => s.question);
  const questionEndsAt = useIqStore(s => s.questionEndsAt);
  const phase = useIqStore(s => s.phase);
  const answeredCount = useIqStore(s => s.answeredCount);
  const totalPlayers = useIqStore(s => s.totalPlayers);
  const myAnswer = useIqStore(s => s.myAnswer);
  const reveal = useIqStore(s => s.reveal);

  const room = useRoomStore(s => s.room);
  const myId = useRoomStore(s => s.myId) || socket.id;

  const secondsLeft = useCountdown(phase === 'question' ? questionEndsAt : null);

  const players = room?.players ?? [];
  const amHost = room?.hostId === myId;
  const myResult = reveal?.perPlayer?.[myId];

  const handleAnswer = (optionIndex) => {
    if (myAnswer != null || phase !== 'question') return;
    socket.emit('iq:answer', { optionIndex });
  };

  const handleEndGame = () => socket.emit('iq:end');

  const showScoreboard = phase === 'game_over';

  if (!gameState || !room) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>
        Loading game…
      </div>
    );
  }

  const timerColor = secondsLeft != null && secondsLeft <= 5 ? 'var(--text-accent)' : '#fff';
  const questionIndex = question?.questionIndex ?? gameState.questionIndex ?? 0;
  const totalQuestions = question?.totalQuestions ?? gameState.totalQuestions ?? 10;

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
            <span style={{ fontSize: '1.4rem' }}>🧠</span>
            <span style={{ fontWeight: 700, color: '#fff' }}>IQ Test</span>
            <span style={{
              background: 'var(--bg-surface)', borderRadius: 6, padding: '2px 8px',
              fontSize: '0.78rem', color: 'var(--text-secondary)', letterSpacing: '0.1em',
            }}>
              {room.code}
            </span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
              Question {questionIndex + 1} / {totalQuestions}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {phase === 'question' && secondsLeft != null && (
              <div style={{
                fontWeight: 900, fontSize: '1.2rem',
                color: timerColor,
                transition: 'color 0.3s',
                fontVariantNumeric: 'tabular-nums',
              }}>
                ⏱ {secondsLeft}s
              </div>
            )}

            {amHost && (
              <button className="btn btn-danger" onClick={handleEndGame} style={{ padding: '6px 14px', fontSize: '0.82rem' }}>
                End Game
              </button>
            )}
          </div>
        </div>

        {/* Progress strip */}
        <div style={{
          padding: '8px 20px', textAlign: 'center',
          background: 'rgba(0,0,0,0.1)', flexShrink: 0,
        }}>
          {phase === 'question' && (
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {answeredCount} / {totalPlayers || players.length} answered
            </span>
          )}
          {phase === 'reveal' && (
            <span style={{ color: '#fff', fontSize: '0.88rem', fontWeight: 700 }}>
              ✅ Correct answer: {reveal?.correctText}
            </span>
          )}
        </div>

        {/* Main content */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 24, padding: 20, overflow: 'auto',
        }}>
          {question?.text && (
            <div className="anim-fade" style={{
              maxWidth: 620, width: '100%', textAlign: 'center',
              background: 'var(--bg-card)', borderRadius: 'var(--radius)',
              padding: '28px 32px', boxShadow: 'var(--shadow)',
            }}>
              <h2 style={{ color: '#fff', fontSize: '1.3rem', marginBottom: 24 }}>
                {question.text}
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {question.options.map((opt, i) => {
                  const isMine = myAnswer === i;
                  const isCorrect = reveal && reveal.correctIndex === i;
                  const isWrongPick = reveal && isMine && !isCorrect;
                  let bg = OPTION_COLORS[i % OPTION_COLORS.length];
                  let border = 'transparent';
                  let opacity = 1;

                  if (phase === 'reveal') {
                    if (isCorrect) border = '#66bb6a';
                    else if (isWrongPick) border = '#e53935';
                    if (!isCorrect && !isMine) opacity = 0.5;
                  } else if (myAnswer != null) {
                    opacity = isMine ? 1 : 0.45;
                  }

                  return (
                    <button
                      key={i}
                      onClick={() => handleAnswer(i)}
                      disabled={myAnswer != null || phase !== 'question'}
                      style={{
                        padding: '16px 18px', borderRadius: 12,
                        border: `3px solid ${border}`,
                        background: bg, opacity,
                        color: '#fff', cursor: myAnswer != null || phase !== 'question' ? 'default' : 'pointer',
                        fontSize: '1rem', fontWeight: 700,
                        transition: 'all var(--transition)',
                        position: 'relative',
                      }}
                    >
                      {opt}
                      {isMine && <span style={{ position: 'absolute', top: 6, right: 8, fontSize: '0.9rem' }}>👤</span>}
                      {phase === 'reveal' && isCorrect && <span style={{ position: 'absolute', top: 6, left: 8, fontSize: '0.9rem' }}>✓</span>}
                    </button>
                  );
                })}
              </div>

              {phase === 'question' && myAnswer != null && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 16 }}>
                  Answer locked in — waiting for others…
                </p>
              )}

              {phase === 'reveal' && myResult && (
                <p style={{
                  marginTop: 16, fontSize: '0.95rem', fontWeight: 700,
                  color: myResult.correct ? '#66bb6a' : '#ef5350',
                }}>
                  {myResult.correct ? `✓ Correct! +${myResult.points} points` : myResult.optionIndex == null ? '✗ No answer' : '✗ Incorrect'}
                </p>
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
            const score = gameState.scores?.[p.id] ?? 0;
            const answered = phase === 'question' && reveal == null && !!p.isConnected;
            return (
              <div key={p.id} style={{
                padding: '4px 12px', borderRadius: 20,
                background: 'rgba(255,255,255,0.05)',
                border: '1.5px solid transparent',
                fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <span style={{ color: 'rgba(255,255,255,0.75)' }}>{p.nickname}</span>
                {p.id === myId && <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>(you)</span>}
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{score}pt</span>
              </div>
            );
          })}
        </div>
      </div>

      <ChatSidebar />

      {showScoreboard && (
        <Scoreboard
          scores={gameState?.scores}
          prevScores={null}
          players={players}
          title="🎉 IQ Test Complete!"
          showContinue={amHost}
          continueLabel="🏠 Back to Lobby"
          onContinue={handleEndGame}
        />
      )}
    </div>
  );
}
