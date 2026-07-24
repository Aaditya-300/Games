import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';
import { useRoomStore } from '../store/roomStore';
import { useGameStore } from '../store/gameStore';
import { useChatStore } from '../store/chatStore';
import { useUiStore } from '../store/uiStore';
import { useTdStore } from '../store/tdStore';
import { useSkStore } from '../store/skStore';
import { useIqStore } from '../store/iqStore';

export function useSocketEvents() {
  const navigate = useNavigate();
  const { setRoom, setReconnectToken, setMyId, setIsSpectator } = useRoomStore();
  const { setGameState, setHand, setWinner, setPeekData, setTurnTimeout, reset: resetGame } = useGameStore();
  const { addMessage, setHistory } = useChatStore();
  const { openColorPicker, openSwapTarget, openDiscardColor, openSabotageTarget, openChallenge, addToast, closeChallenge } = useUiStore();

  useEffect(() => {
    socket.connect();
    setMyId(socket.id);

    socket.on('connect', () => setMyId(socket.id));

    // ─── Room events ────────────────────────────────────────────────────────
    socket.on('room:created', ({ room, reconnectToken }) => {
      setRoom(room);
      setReconnectToken(reconnectToken);
      localStorage.setItem('reconnectToken', reconnectToken);
      localStorage.setItem('roomCode', room.code);
      if (room.gameType === 'sketch') navigate('/sk-lobby');
      else if (room.gameType === 'truth_dare') navigate('/td-lobby');
      else if (room.gameType === 'iq') navigate('/iq-lobby');
      else navigate('/lobby');
    });

    socket.on('room:joined', ({ room, reconnectToken, isSpectator }) => {
      setRoom(room);
      setReconnectToken(reconnectToken);
      setIsSpectator(!!isSpectator);
      localStorage.setItem('reconnectToken', reconnectToken);
      localStorage.setItem('roomCode', room.code);
      if (room.gameType === 'sketch') navigate('/sk-lobby');
      else if (room.gameType === 'truth_dare') navigate('/td-lobby');
      else if (room.gameType === 'iq') navigate('/iq-lobby');
      else navigate(isSpectator ? '/spectator' : '/lobby');
    });

    socket.on('room:reconnected', ({ room, reconnectToken, gameState }) => {
      setRoom(room);
      setReconnectToken(reconnectToken);
      if (gameState) {
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
          navigate('/game');
        }
      } else {
        if (room.gameType === 'sketch') navigate('/sk-lobby');
        else if (room.gameType === 'truth_dare') navigate('/td-lobby');
        else if (room.gameType === 'iq') navigate('/iq-lobby');
        else navigate('/lobby');
      }
    });

    socket.on('room:updated', ({ room }) => setRoom(room));

    socket.on('room:kicked', ({ reason }) => {
      addToast(`You were kicked: ${reason}`, 'error');
      navigate('/');
    });

    socket.on('room:error', ({ message }) => addToast(message, 'error'));

    // ─── UNO Game events ─────────────────────────────────────────────────────
    socket.on('game:started', ({ gameState }) => {
      resetGame();
      setGameState(gameState);
      setHand(gameState.hand || []);
      navigate('/game');
    });

    socket.on('game:state_update', ({ gameState }) => {
      setGameState(gameState);
      if (gameState.phase === 'color_pick' && gameState.lastPlayerId === socket.id) {
        openColorPicker();
      }
      if (gameState.phase === 'swap_target' && gameState.lastPlayerId === socket.id) {
        openSwapTarget();
      }
      if (gameState.phase === 'discard_color_pick' && gameState.lastPlayerId === socket.id) {
        openDiscardColor();
      }
      if (gameState.phase === 'sabotage_target' && gameState.lastPlayerId === socket.id) {
        openSabotageTarget();
      }
    });

    socket.on('game:hand_update', ({ hand }) => setHand(hand));

    socket.on('game:turn', ({ currentPlayerId, timeoutAt }) => {
      setTurnTimeout(timeoutAt);
      if (currentPlayerId === socket.id) {
        addToast("It's your turn!", 'info');
      }
    });

    socket.on('game:winner', ({ winnerId, nickname, rankings }) => {
      setWinner(winnerId, nickname, rankings);
    });

    socket.on('game:peek_result', ({ targetNickname, hand }) => {
      setPeekData({ targetNickname, hand });
    });

    socket.on('game:uno_called', () => addToast('UNO called!', 'warning'));
    socket.on('game:uno_caught', ({ drawCount }) => addToast(`Player caught not calling UNO! +${drawCount} cards`, 'warning'));

    socket.on('game:challenge_result', ({ success, drawn }) => {
      closeChallenge();
      addToast(success ? `Challenge succeeded! Opponent draws ${drawn}` : `Challenge failed! You draw ${drawn}`, 'info');
    });

    socket.on('game:swap_hands', () => addToast('Hands were swapped!', 'warning'));
    socket.on('game:shield_activated', () => addToast('Shield activated!', 'info'));
    socket.on('game:shield_blocked', () => addToast('Shield blocked the effect!', 'success'));
    socket.on('game:turn_timeout', ({ playerId }) => {
      if (playerId === socket.id) addToast('Time out! Auto-drew a card.', 'warning');
    });
    socket.on('game:draw_until_color', ({ playerId, drawnCount, color }) => {
      if (playerId === socket.id) addToast(`Drew ${drawnCount} cards until ${color}`, 'info');
    });
    socket.on('game:discard_color', ({ playerId, color, discardedCount }) => {
      if (playerId === socket.id) addToast(`Discarded ${discardedCount} ${color} cards`, 'warning');
    });
    socket.on('game:error', ({ message }) => addToast(message, 'error'));

    socket.on('game:card_played', ({ card }) => {
      if (card.type === 'wild_draw4') {
        const gs = useGameStore.getState().gameState;
        if (gs?.currentPlayerId === socket.id) {
          openChallenge(Date.now() + 5000);
        }
      }
    });

    // ─── Truth or Dare events ─────────────────────────────────────────────────
    socket.on('td:started', ({ gameState }) => {
      useTdStore.getState().setGameState(gameState);
      navigate('/td-game');
    });

    socket.on('td:spin_result', ({ targetId, targetNickname, card, spinnerIndex, spunAt }) => {
      useTdStore.getState().setSpinResult({ targetId, targetNickname, card, spunAt });
      useTdStore.getState().setPhase('card_active');
    });

    socket.on('td:turn_advanced', ({ gameState }) => {
      useTdStore.getState().setGameState(gameState);
    });

    socket.on('td:ended', () => {
      useTdStore.getState().reset();
      navigate('/td-lobby');
    });

    socket.on('td:error', ({ message }) => addToast(message, 'error'));

    // ─── Sketch events ────────────────────────────────────────────────────────
    socket.on('sk:started', ({ gameState }) => {
      useSkStore.getState().setGameState(gameState);
      navigate('/sk-game');
    });

    socket.on('sk:word_options', ({ options }) => {
      useSkStore.getState().setWordOptions(options);
    });

    socket.on('sk:word_confirmed', ({ word }) => {
      useSkStore.getState().setCurrentWord(word);
    });

    socket.on('sk:round_started', (data) => {
      useSkStore.getState().startRound(data);
    });

    socket.on('sk:draw_stroke', ({ stroke }) => {
      useSkStore.getState().addStroke(stroke);
    });

    socket.on('sk:canvas_cleared', () => {
      useSkStore.getState().clearStrokes();
    });

    socket.on('sk:public_guess', (guess) => {
      useSkStore.getState().addGuess({ type: 'public', ...guess });
    });

    socket.on('sk:hint_update', ({ hint }) => {
      useSkStore.getState().setHint(hint);
    });

    socket.on('sk:player_guessed', ({ nickname }) => {
      useSkStore.getState().addGuess({ type: 'correct', nickname });
    });

    socket.on('sk:correct_guess', (data) => {
      useSkStore.getState().setCorrectGuess(data);
      addToast(`+${data.points} points!`, 'success');
    });

    socket.on('sk:turn_ended', (data) => {
      useSkStore.getState().setTurnEnded(data);
    });

    socket.on('sk:round_ended', (data) => {
      useSkStore.getState().setRoundEnded(data);
    });

    socket.on('sk:next_drawer', (data) => {
      useSkStore.getState().setNextDrawer(data);
    });

    socket.on('sk:game_over', (data) => {
      useSkStore.getState().setGameOver(data);
    });

    socket.on('sk:ended', () => {
      useSkStore.getState().reset();
      navigate('/sk-lobby');
    });

    socket.on('sk:error', ({ message }) => addToast(message, 'error'));

    // ─── IQ Test events ───────────────────────────────────────────────────────
    socket.on('iq:started', ({ gameState }) => {
      useIqStore.getState().setGameState(gameState);
      navigate('/iq-game');
    });

    socket.on('iq:question', (data) => {
      useIqStore.getState().setQuestion(data);
    });

    socket.on('iq:answer_locked', ({ optionIndex }) => {
      useIqStore.getState().setAnswerLocked(optionIndex);
    });

    socket.on('iq:player_answered', (data) => {
      useIqStore.getState().setPlayerAnswered(data);
    });

    socket.on('iq:reveal', (data) => {
      useIqStore.getState().setReveal(data);
    });

    socket.on('iq:game_over', (data) => {
      useIqStore.getState().setGameOver(data);
    });

    socket.on('iq:ended', () => {
      useIqStore.getState().reset();
      navigate('/iq-lobby');
    });

    socket.on('iq:error', ({ message }) => addToast(message, 'error'));

    // ─── Chat events ─────────────────────────────────────────────────────────
    socket.on('chat:message', ({ message }) => addMessage(message));
    socket.on('chat:history', ({ messages }) => setHistory(messages));

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, []);
}
