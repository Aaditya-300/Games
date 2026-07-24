import { useEffect, useState } from 'react';
import Modal from '../shared/Modal';
import { useUiStore } from '../../store/uiStore';
import socket from '../../socket';

export default function ChallengePrompt() {
  const { showChallenge, challengeTimeoutAt, closeChallenge } = useUiStore();
  const [remaining, setRemaining] = useState(5);

  useEffect(() => {
    if (!showChallenge || !challengeTimeoutAt) return;
    const tick = setInterval(() => {
      const left = Math.max(0, Math.ceil((challengeTimeoutAt - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        closeChallenge();
        clearInterval(tick);
      }
    }, 200);
    return () => clearInterval(tick);
  }, [showChallenge, challengeTimeoutAt]);

  if (!showChallenge) return null;

  const challenge = () => {
    socket.emit('game:challenge_draw4');
    closeChallenge();
  };

  return (
    <Modal title="Wild Draw 4 Played!">
      <p style={{ color: 'var(--text-secondary)', marginBottom: 18, fontSize: '0.9rem' }}>
        Do you want to challenge this Wild Draw 4? If the player had a playable card, they draw 4 instead of you.
        If their play was legal, you draw 6.
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-danger" onClick={challenge} style={{ flex: 1 }}>
          Challenge ({remaining}s)
        </button>
        <button className="btn btn-secondary" onClick={closeChallenge} style={{ flex: 1 }}>
          Accept
        </button>
      </div>
    </Modal>
  );
}
