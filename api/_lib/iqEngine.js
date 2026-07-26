import { IQ_QUESTIONS } from './iqQuestions.js';
import { shuffle } from './utils/shuffle.js';
import { IQ_QUESTION_DURATION_MS, IQ_REVEAL_DURATION_MS } from './config.js';

const MAX_POINTS = 1000;
const MIN_POINTS = 100;

export function pickQuestions(count) {
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

export function initIqGameState(roomCode, playerIds, questions) {
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
  };
}

export function getIqPublicView(gs) {
  if (!gs) return null;
  return {
    roomCode: gs.roomCode,
    phase: gs.phase,
    questionIndex: gs.questionIndex,
    totalQuestions: gs.totalQuestions,
    question: gs.currentQuestion ? { text: gs.currentQuestion.text, options: gs.currentQuestion.options } : null,
    questionStartedAt: gs.questionStartedAt,
    questionEndsAt: gs.questionEndsAt,
    answeredCount: Object.keys(gs.answers).length,
    scores: gs.scores,
    prevScores: gs.prevScores,
    lastResult: gs.lastResult,
  };
}

export function activePlayerIds(room) {
  return [...room.players.values()].filter(p => !p.isSpectator).map(p => p.id);
}

// Bots don't get a scheduled per-bot delay in the serverless model — instead
// each bot's answer-by time is precomputed once (relative to questionStartedAt)
// and resolved opportunistically whenever a real request touches this question
// (another player's answer, or the question-timeout tick).
export function computeBotAnswerDelays(room, gs) {
  const bots = [...room.players.values()].filter(p => p.isBot && !p.isSpectator);
  const delays = {};
  for (const bot of bots) {
    delays[bot.id] = 2000 + Math.random() * (IQ_QUESTION_DURATION_MS - 4000);
  }
  return delays;
}

export function resolveDueBotAnswers(room) {
  const gs = room.gameState;
  if (!gs || gs.phase !== 'question') return;
  const now = Date.now();
  const bots = [...room.players.values()].filter(p => p.isBot && !p.isSpectator);
  for (const bot of bots) {
    if (gs.answers[bot.id]) continue;
    const delay = gs.botAnswerDelays?.[bot.id];
    if (delay == null) continue;
    if (now - gs.questionStartedAt < delay) continue;

    const correctIndex = gs.currentQuestion.answerIndex;
    const guessCorrectly = Math.random() < 0.65;
    const optionIndex = guessCorrectly
      ? correctIndex
      : Math.floor(Math.random() * gs.currentQuestion.options.length);
    gs.answers[bot.id] = { optionIndex, answeredAt: now };
  }
}

export function recordAnswer(room, playerId, optionIndex) {
  const gs = room.gameState;
  if (!gs || gs.phase !== 'question') return { recorded: false };
  if (gs.answers[playerId]) return { recorded: false };

  gs.answers[playerId] = { optionIndex, answeredAt: Date.now() };
  return { recorded: true };
}

export function allAnswered(room) {
  const gs = room.gameState;
  const total = activePlayerIds(room).length;
  return Object.keys(gs.answers).length >= total;
}

export function beginQuestion(room) {
  const gs = room.gameState;
  gs.questionIndex++;
  gs.currentQuestion = gs.questions[gs.questionIndex];
  gs.answers = {};
  gs.lastResult = null;
  gs.questionStartedAt = Date.now();
  gs.questionEndsAt = gs.questionStartedAt + IQ_QUESTION_DURATION_MS;
  gs.phase = 'question';
  gs.botAnswerDelays = computeBotAnswerDelays(room, gs);
}

export function endQuestion(room) {
  const gs = room.gameState;
  if (!gs || gs.phase !== 'question') return false;

  gs.phase = 'reveal';
  gs.prevScores = { ...gs.scores };
  gs.revealEndsAt = Date.now() + IQ_REVEAL_DURATION_MS;

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

  return true;
}

// Returns true if the game ended (caller should broadcast game_over),
// false if a new question began (caller should broadcast it).
export function advanceQuestion(room) {
  const gs = room.gameState;
  if (gs.questionIndex + 1 >= gs.totalQuestions) {
    gs.phase = 'game_over';
    room.status = 'ended';
    return true;
  }
  beginQuestion(room);
  return false;
}
