import { getRooms } from '../roomManager.js';
import { systemMessage } from '../chatManager.js';
import { IQ_QUESTIONS } from '../iqQuestions.js';
import { shuffle } from '../utils/shuffle.js';
import { IQ_QUESTION_DURATION_MS, IQ_TOTAL_QUESTIONS } from '../config.js';

const REVEAL_DURATION_MS = 4000;
const MAX_POINTS = 1000;
const MIN_POINTS = 100;

function findSocketRoom(socketId) {
  for (const room of getRooms().values()) {
    if (room.players.has(socketId) || room.spectators.has(socketId)) return room;
  }
  return null;
}

function pickQuestions(count) {
  const chosen = shuffle(IQ_QUESTIONS).slice(0, count);
  return chosen.map(q => {
    const order = shuffle([0, 1, 2, 3]);
    return {
      text: q.text,
      options: order.map(i => q.options[i]),
      answerIndex: order.indexOf(q.answerIndex),
    };
  });
}

function scoreFor(answeredAt, startedAt) {
  const elapsedMs = Math.max(0, answeredAt - startedAt);
  const remainingMs = Math.max(0, IQ_QUESTION_DURATION_MS - elapsedMs);
  const fraction = remainingMs / IQ_QUESTION_DURATION_MS;
  return Math.max(MIN_POINTS, Math.round(fraction * MAX_POINTS));
}

function initIqGameState(roomCode, playerIds, questions) {
  const scores = {};
  for (const id of playerIds) scores[id] = 0;
  return {
    roomCode,
    phase: 'question',
    questionIndex: -1,
    totalQuestions: questions.length,
    questions,
    currentQuestion: null,
    questionStartedAt: null,
    questionEndsAt: null,
    answers: {},
    scores,
    prevScores: { ...scores },
    lastResult: null,
    questionTimer: null,
    revealTimer: null,
  };
}

function getPublicQuestion(gs) {
  if (!gs.currentQuestion) return null;
  return { text: gs.currentQuestion.text, options: gs.currentQuestion.options };
}

function getIqPublicView(gs) {
  if (!gs) return null;
  return {
    roomCode: gs.roomCode,
    phase: gs.phase,
    questionIndex: gs.questionIndex,
    totalQuestions: gs.totalQuestions,
    question: getPublicQuestion(gs),
    questionStartedAt: gs.questionStartedAt,
    questionEndsAt: gs.questionEndsAt,
    answeredCount: Object.keys(gs.answers).length,
    scores: gs.scores,
    prevScores: gs.prevScores,
    lastResult: gs.lastResult,
  };
}

function activePlayerIds(room) {
  return [...room.players.values()].filter(p => !p.isSpectator).map(p => p.id);
}

function recordAnswer(io, room, playerId, optionIndex) {
  const gs = room.gameState;
  if (!gs || gs.phase !== 'question') return;
  if (gs.answers[playerId]) return;

  gs.answers[playerId] = { optionIndex, answeredAt: Date.now() };
  room.lastActivityAt = Date.now();

  io.to(`room:${room.code}`).emit('iq:player_answered', {
    answeredCount: Object.keys(gs.answers).length,
    total: activePlayerIds(room).length,
  });

  const total = activePlayerIds(room).length;
  if (Object.keys(gs.answers).length >= total) {
    endQuestion(io, room);
  }
}

function scheduleBotAnswers(io, room, questionIndex) {
  const bots = [...room.players.values()].filter(p => p.isBot && !p.isSpectator);
  for (const bot of bots) {
    const delay = 2000 + Math.random() * (IQ_QUESTION_DURATION_MS - 4000);
    setTimeout(() => {
      const gs = room.gameState;
      if (!gs || gs.phase !== 'question' || gs.questionIndex !== questionIndex) return;
      if (gs.answers[bot.id]) return;

      const correctIndex = gs.currentQuestion.answerIndex;
      const guessCorrectly = Math.random() < 0.65;
      const optionIndex = guessCorrectly
        ? correctIndex
        : Math.floor(Math.random() * gs.currentQuestion.options.length);

      recordAnswer(io, room, bot.id, optionIndex);
    }, delay);
  }
}

function beginQuestion(io, room) {
  const gs = room.gameState;
  gs.questionIndex++;
  gs.currentQuestion = gs.questions[gs.questionIndex];
  gs.answers = {};
  gs.lastResult = null;
  gs.questionStartedAt = Date.now();
  gs.questionEndsAt = gs.questionStartedAt + IQ_QUESTION_DURATION_MS;
  gs.phase = 'question';

  io.to(`room:${room.code}`).emit('iq:question', {
    questionIndex: gs.questionIndex,
    totalQuestions: gs.totalQuestions,
    text: gs.currentQuestion.text,
    options: gs.currentQuestion.options,
    questionEndsAt: gs.questionEndsAt,
  });

  scheduleBotAnswers(io, room, gs.questionIndex);

  gs.questionTimer = setTimeout(() => endQuestion(io, room), IQ_QUESTION_DURATION_MS);
}

function endQuestion(io, room) {
  const gs = room.gameState;
  if (!gs || gs.phase !== 'question') return;

  if (gs.questionTimer) {
    clearTimeout(gs.questionTimer);
    gs.questionTimer = null;
  }

  gs.phase = 'reveal';
  gs.prevScores = { ...gs.scores };

  const correctIndex = gs.currentQuestion.answerIndex;
  const perPlayer = {};

  for (const playerId of activePlayerIds(room)) {
    const answer = gs.answers[playerId];
    const correct = !!answer && answer.optionIndex === correctIndex;
    const points = correct ? scoreFor(answer.answeredAt, gs.questionStartedAt) : 0;
    if (points > 0) gs.scores[playerId] = (gs.scores[playerId] || 0) + points;
    perPlayer[playerId] = { optionIndex: answer?.optionIndex ?? null, correct, points };
  }

  gs.lastResult = {
    questionIndex: gs.questionIndex,
    correctIndex,
    correctText: gs.currentQuestion.options[correctIndex],
    perPlayer,
  };

  io.to(`room:${room.code}`).emit('iq:reveal', {
    correctIndex,
    correctText: gs.currentQuestion.options[correctIndex],
    perPlayer,
    scores: { ...gs.scores },
  });

  gs.revealTimer = setTimeout(() => advanceQuestion(io, room), REVEAL_DURATION_MS);
}

function advanceQuestion(io, room) {
  const gs = room.gameState;
  if (!gs) return;

  if (gs.revealTimer) {
    clearTimeout(gs.revealTimer);
    gs.revealTimer = null;
  }

  if (gs.questionIndex + 1 >= gs.totalQuestions) {
    gs.phase = 'game_over';
    room.status = 'ended';
    io.to(`room:${room.code}`).emit('iq:game_over', { scores: { ...gs.scores } });
  } else {
    beginQuestion(io, room);
  }
}

export function registerIqHandlers(io, socket) {
  socket.on('iq:start', () => {
    const room = findSocketRoom(socket.id);
    if (!room) return;
    if (room.gameType !== 'iq') return;

    const player = room.players.get(socket.id);
    if (!player?.isHost) return socket.emit('iq:error', { code: 'NOT_HOST', message: 'Only host can start' });
    if (room.status !== 'waiting') return socket.emit('iq:error', { code: 'WRONG_STATUS', message: 'Game already started' });

    const playerIds = activePlayerIds(room);
    const questions = pickQuestions(IQ_TOTAL_QUESTIONS);
    room.gameState = initIqGameState(room.code, playerIds, questions);
    room.status = 'playing';
    room.lastActivityAt = Date.now();

    io.to(`room:${room.code}`).emit('iq:started', { gameState: getIqPublicView(room.gameState) });
    beginQuestion(io, room);

    const msg = systemMessage(room, 'IQ Test started!');
    io.to(`room:${room.code}`).emit('chat:message', { message: msg });
  });

  socket.on('iq:answer', ({ optionIndex } = {}) => {
    const room = findSocketRoom(socket.id);
    if (!room?.gameState) return;
    const gs = room.gameState;

    if (gs.phase !== 'question') return socket.emit('iq:error', { code: 'WRONG_PHASE', message: 'No active question' });
    const player = room.players.get(socket.id);
    if (!player || player.isSpectator) return;
    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= gs.currentQuestion.options.length) {
      return socket.emit('iq:error', { code: 'INVALID_OPTION', message: 'Invalid option' });
    }
    if (gs.answers[socket.id]) return;

    recordAnswer(io, room, socket.id, optionIndex);
    socket.emit('iq:answer_locked', { optionIndex });
  });

  socket.on('iq:end', () => {
    const room = findSocketRoom(socket.id);
    if (!room) return;
    if (room.hostId !== socket.id) return socket.emit('iq:error', { code: 'NOT_HOST', message: 'Only host can end' });

    const gs = room.gameState;
    if (gs?.questionTimer) clearTimeout(gs.questionTimer);
    if (gs?.revealTimer) clearTimeout(gs.revealTimer);

    room.status = 'waiting';
    room.lastActivityAt = Date.now();

    io.to(`room:${room.code}`).emit('iq:ended', { reason: 'host' });

    const msg = systemMessage(room, 'IQ Test ended by host.');
    io.to(`room:${room.code}`).emit('chat:message', { message: msg });
  });
}
