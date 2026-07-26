import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import realtime from '../realtime';
import { getPlayerId } from '../identity';
import { useRoomStore } from '../store/roomStore';
import { useGameStore } from '../store/gameStore';
import { useChatStore } from '../store/chatStore';
import { useUiStore } from '../store/uiStore';
import { useTdStore } from '../store/tdStore';
import { useSkStore } from '../store/skStore';
import { useIqStore } from '../store/iqStore';

export function useSocketEvents() {
  const navigate = useNavigate();
  const { setRoom, setMyId, setIsSpectator } = useRoomStore();
  const { setGameState, setHand, setWinner, setPeekData, setTurnTimeout, reset: resetGame } = useGameStore();
  const { addMessage, setHistory } = useChatStore();
  const { openColorPicker, openSwapTarget, openDiscardColor, openSabotageTarget, openChallenge, addToast, closeChallenge } = useUiStore();

  useEffect(() => {
    const myId = getPlayerId();
    setMyId(myId);
    realtime.connect();

    // ─── Room events ────────────────────────────────────────────────────────
    realtime.on('room:created', ({ room }) => {
      setRoom(room);
      if (room.gameType === 'sketch') navigate('/sk-lobby');
      else if (room.gameType === 'truth_dare') navigate('/td-lobby');
      else if (room.gameType === 'iq') navigate('/iq-lobby');
      else navigate('/lobby');
    });

    realtime.on('room:joined', ({ room, isSpectator, gameState }) => {
      setRoom(room);
      setIsSpectator(!!isSpectator);
      if (gameState) {
        // Rejoin (page reload) landed mid-game — jump straight back in.
        if (room.gameType === 'sketch') {
          useSkStore.getState().setGameState(gameState);
          navigate('/sk-game');
        } else if (room.gameType === 'truth_dare') {
          useTdStore.getState().setGameState(gameState);
          navigate('/td-game');
        } else if (room.gameType === 'iq') {
          useIqStore.getState().setGameState(gameState);
          navigate('/iq-game');
        } else {
          setGameState(gameState);
          setHand(gameState.hand || []);
          navigate(isSpectator ? '/spectator' : '/game');
        }
      } else {
        if (room.gameType === 'sketch') navigate('/sk-lobby');
        else if (room.gameType === 'truth_dare') navigate('/td-lobby');
        else if (room.gameType === 'iq') navigate('/iq-lobby');
        else navigate(isSpectator ? '/spectator' : '/lobby');
      }
    });

    realtime.on('room:updated', ({ room }) => setRoom(room));

    realtime.on('room:kicked', ({ reason }) => {
      addToast(`You were kicked: ${reason}`, 'error');
      navigate('/');
    });

    realtime.on('room:error', ({ message }) => addToast(message, 'error'));

    // ─── UNO Game events ─────────────────────────────────────────────────────
    realtime.on('game:started', ({ gameState }) => {
      resetGame();
      setGameState(gameState);
      setHand(gameState.hand || []);
      navigate('/game');
    });

    realtime.on('game:state_update', ({ gameState }) => {
      setGameState(gameState);
      if (gameState.phase === 'color_pick' && gameState.lastPlayerId === myId) {
        openColorPicker();
      }
      if (gameState.phase === 'swap_target' && gameState.lastPlayerId === myId) {
        openSwapTarget();
      }
      if (gameState.phase === 'discard_color_pick' && gameState.lastPlayerId === myId) {
        openDiscardColor();
      }
      if (gameState.phase === 'sabotage_target' && gameState.lastPlayerId === myId) {
        openSabotageTarget();
      }
    });

    realtime.on('game:hand_update', ({ hand }) => setHand(hand));

    realtime.on('game:turn', ({ currentPlayerId, timeoutAt }) => {
      setTurnTimeout(timeoutAt);
      if (currentPlayerId === myId) {
        addToast("It's your turn!", 'info');
      }
    });

    realtime.on('game:winner', ({ winnerId, nickname, rankings }) => {
      setWinner(winnerId, nickname, rankings);
    });

    realtime.on('game:peek_result', ({ targetNickname, hand }) => {
      setPeekData({ targetNickname, hand });
    });

    realtime.on('game:uno_called', () => addToast('UNO called!', 'warning'));
    realtime.on('game:uno_caught', ({ drawCount }) => addToast(`Player caught not calling UNO! +${drawCount} cards`, 'warning'));

    realtime.on('game:challenge_result', ({ success, drawn }) => {
      closeChallenge();
      addToast(success ? `Challenge succeeded! Opponent draws ${drawn}` : `Challenge failed! You draw ${drawn}`, 'info');
    });

    realtime.on('game:swap_hands', () => addToast('Hands were swapped!', 'warning'));
    realtime.on('game:shield_activated', () => addToast('Shield activated!', 'info'));
    realtime.on('game:shield_blocked', () => addToast('Shield blocked the effect!', 'success'));
    realtime.on('game:turn_timeout', ({ playerId }) => {
      if (playerId === myId) addToast('Time out! Auto-drew a card.', 'warning');
    });
    realtime.on('game:draw_until_color', ({ playerId, drawnCount, color }) => {
      if (playerId === myId) addToast(`Drew ${drawnCount} cards until ${color}`, 'info');
    });
    realtime.on('game:discard_color', ({ playerId, color, discardedCount }) => {
      if (playerId === myId) addToast(`Discarded ${discardedCount} ${color} cards`, 'warning');
    });
    realtime.on('game:error', ({ message }) => addToast(message, 'error'));

    realtime.on('game:card_played', ({ card }) => {
      if (card.type === 'wild_draw4') {
        const gs = useGameStore.getState().gameState;
        if (gs?.currentPlayerId === myId) {
          openChallenge(Date.now() + 5000);
        }
      }
    });

    // ─── Truth or Dare events ─────────────────────────────────────────────────
    realtime.on('td:started', ({ gameState }) => {
      useTdStore.getState().setGameState(gameState);
      navigate('/td-game');
    });

    realtime.on('td:spin_result', ({ targetId, targetNickname, card, spinnerIndex, spunAt }) => {
      useTdStore.getState().setSpinResult({ targetId, targetNickname, card, spunAt });
      useTdStore.getState().setPhase('card_active');
    });

    realtime.on('td:turn_advanced', ({ gameState }) => {
      useTdStore.getState().setGameState(gameState);
    });

    realtime.on('td:ended', () => {
      useTdStore.getState().reset();
      navigate('/td-lobby');
    });

    realtime.on('td:error', ({ message }) => addToast(message, 'error'));

    // ─── Sketch events ────────────────────────────────────────────────────────
    realtime.on('sk:started', ({ gameState }) => {
      useSkStore.getState().setGameState(gameState);
      navigate('/sk-game');
    });

    realtime.on('sk:word_options', ({ options }) => {
      useSkStore.getState().setWordOptions(options);
    });

    realtime.on('sk:word_confirmed', ({ word }) => {
      useSkStore.getState().setCurrentWord(word);
    });

    realtime.on('sk:round_started', ({ botStrokePlan, ...data }) => {
      useSkStore.getState().startRound(data);
      // Bot drawing is precomputed server-side and shipped once; each
      // client paces the replay locally with setTimeout since it's purely
      // cosmetic (scoring only ever checks the guessed word, not strokes).
      if (botStrokePlan?.length) {
        for (const { stroke, delayMs } of botStrokePlan) {
          setTimeout(() => {
            if (useSkStore.getState().phase !== 'drawing') return;
            useSkStore.getState().addStroke(stroke);
          }, delayMs);
        }
      }
    });

    realtime.on('sk:draw_stroke', ({ stroke, byId }) => {
      // Broadcasts include the sender (Pusher has no server-triggered
      // exclusion here) — the drawer already rendered their own stroke
      // locally as they drew it, so skip re-applying it.
      if (byId === myId) return;
      useSkStore.getState().addStroke(stroke);
    });

    realtime.on('sk:canvas_cleared', () => {
      useSkStore.getState().clearStrokes();
    });

    realtime.on('sk:public_guess', (guess) => {
      useSkStore.getState().addGuess({ type: 'public', ...guess });
    });

    realtime.on('sk:hint_update', ({ hint }) => {
      useSkStore.getState().setHint(hint);
    });

    realtime.on('sk:player_guessed', ({ nickname }) => {
      useSkStore.getState().addGuess({ type: 'correct', nickname });
    });

    realtime.on('sk:correct_guess', (data) => {
      useSkStore.getState().setCorrectGuess(data);
      addToast(`+${data.points} points!`, 'success');
    });

    realtime.on('sk:turn_ended', (data) => {
      useSkStore.getState().setTurnEnded(data);
    });

    realtime.on('sk:round_ended', (data) => {
      useSkStore.getState().setRoundEnded(data);
    });

    realtime.on('sk:next_drawer', (data) => {
      useSkStore.getState().setNextDrawer(data);
    });

    realtime.on('sk:game_over', (data) => {
      useSkStore.getState().setGameOver(data);
    });

    realtime.on('sk:ended', () => {
      useSkStore.getState().reset();
      navigate('/sk-lobby');
    });

    realtime.on('sk:error', ({ message }) => addToast(message, 'error'));

    // ─── IQ Test events ───────────────────────────────────────────────────────
    realtime.on('iq:started', ({ gameState }) => {
      useIqStore.getState().setGameState(gameState);
      navigate('/iq-game');
    });

    realtime.on('iq:question', (data) => {
      useIqStore.getState().setQuestion(data);
    });

    realtime.on('iq:answer_locked', ({ optionIndex }) => {
      useIqStore.getState().setAnswerLocked(optionIndex);
    });

    realtime.on('iq:player_answered', (data) => {
      useIqStore.getState().setPlayerAnswered(data);
    });

    realtime.on('iq:reveal', (data) => {
      useIqStore.getState().setReveal(data);
    });

    realtime.on('iq:game_over', (data) => {
      useIqStore.getState().setGameOver(data);
    });

    realtime.on('iq:ended', () => {
      useIqStore.getState().reset();
      navigate('/iq-lobby');
    });

    realtime.on('iq:error', ({ message }) => addToast(message, 'error'));

    // ─── Chat events ─────────────────────────────────────────────────────────
    realtime.on('chat:message', ({ message }) => addMessage(message));
    realtime.on('chat:history', ({ messages }) => setHistory(messages));

    return () => {
      realtime.removeAllListeners();
      realtime.disconnect();
    };
  }, []);
}
