import { SK_WORDS } from './skWords.js';
import { shuffle } from './utils/shuffle.js';
import { isBotId } from './utils/botUtils.js';
import { SK_ROUND_DURATION_MS, SK_TOTAL_ROUNDS } from './config.js';

export function pickWords(gs, count = 3) {
  if (gs.usedWordIndices.length + count > SK_WORDS.length) {
    gs.usedWordIndices = [];
  }
  const usedSet = new Set(gs.usedWordIndices);
  const available = SK_WORDS.map((_, i) => i).filter(i => !usedSet.has(i));
  const picked = shuffle(available).slice(0, count);
  gs.usedWordIndices.push(...picked);
  return picked.map(i => SK_WORDS[i]);
}

export function buildHint(word, revealedPositions) {
  return Array.from(word)
    .map((c, i) => c === ' ' ? '/' : revealedPositions.has(i) ? c : '_')
    .join(' ');
}

export function getSkPublicState(gs) {
  if (!gs) return null;
  return {
    roomCode: gs.roomCode,
    phase: gs.phase,
    round: gs.round,
    totalRounds: gs.totalRounds,
    drawerQueue: gs.drawerQueue,
    currentDrawerIndex: gs.currentDrawerIndex,
    currentDrawerId: gs.currentDrawerId,
    roundStartedAt: gs.roundStartedAt,
    roundEndsAt: gs.roundEndsAt,
    correctGuessers: gs.correctGuessers,
    scores: gs.scores,
    prevScores: gs.prevScores,
  };
}

export function initSkGameState(roomCode, drawerQueue) {
  const scores = {};
  for (const id of drawerQueue) scores[id] = 0;
  return {
    roomCode,
    phase: 'word_pick',
    round: 1,
    totalRounds: SK_TOTAL_ROUNDS,
    drawerQueue,
    currentDrawerIndex: 0,
    currentDrawerId: drawerQueue[0],
    currentWord: null,
    wordOptions: null,
    roundStartedAt: null,
    roundEndsAt: null,
    correctGuessers: [],
    scores,
    prevScores: { ...scores },
    usedWordIndices: [],
    revealedPositions: new Set(),
    botGuessDelays: {},
  };
}

// Starts word_pick for the current drawer. Bots pick immediately and
// synchronously — there's no other event that could race a word pick
// (the game blocks in word_pick until it resolves), so unlike bot guessing
// there's nothing to resolve "lazily" here.
export function beginWordPick(room) {
  const gs = room.gameState;
  gs.currentDrawerId = gs.drawerQueue[gs.currentDrawerIndex];
  gs.currentWord = null;
  gs.correctGuessers = [];
  gs.roundStartedAt = null;
  gs.roundEndsAt = null;
  gs.phase = 'word_pick';

  const options = pickWords(gs, 3);
  gs.wordOptions = options;

  if (isBotId(gs.currentDrawerId)) {
    const word = options[Math.floor(Math.random() * options.length)];
    startRound(room, word);
  }
}

export function startRound(room, word) {
  const gs = room.gameState;
  gs.currentWord = word;
  gs.phase = 'drawing';
  gs.roundStartedAt = Date.now();
  gs.roundEndsAt = gs.roundStartedAt + SK_ROUND_DURATION_MS;
  gs.correctGuessers = [];
  gs.revealedPositions = new Set();

  const bots = [...room.players.values()].filter(p => p.isBot && p.id !== gs.currentDrawerId);
  gs.botGuessDelays = {};
  for (const bot of bots) {
    gs.botGuessDelays[bot.id] = 8000 + Math.random() * 25000;
  }
}

// Called after a turn ends; advances to next drawer, next round, or game over.
// Returns 'next_drawer' | 'round_end' | 'game_over'.
export function advanceTurn(room) {
  const gs = room.gameState;
  gs.currentDrawerIndex++;

  if (gs.currentDrawerIndex < gs.drawerQueue.length) {
    beginWordPick(room);
    return 'next_drawer';
  }

  if (gs.round >= gs.totalRounds) {
    gs.phase = 'game_over';
    room.status = 'ended';
    return 'game_over';
  }

  gs.phase = 'round_end';
  gs.prevScores = { ...gs.scores };
  return 'round_end';
}

export function endTurn(room) {
  const gs = room.gameState;
  const drawerBonus = gs.correctGuessers.length * 20;
  if (drawerBonus > 0 && gs.currentDrawerId) {
    gs.scores[gs.currentDrawerId] = (gs.scores[gs.currentDrawerId] || 0) + drawerBonus;
  }
  return {
    word: gs.currentWord,
    scores: { ...gs.scores },
    correctGuessers: [...gs.correctGuessers],
    drawerId: gs.currentDrawerId,
  };
}

function scoreForGuess(gs, isFirst) {
  const timeRemaining = Math.max(0, (gs.roundEndsAt - Date.now()) / 1000);
  const basePoints = Math.max(10, Math.round((timeRemaining / 180) * 300));
  return isFirst ? basePoints + 50 : basePoints;
}

// Resolves any bot guessers whose precomputed delay has elapsed. Called
// opportunistically from sk/guess and sk/tick, mirroring the IQ bot-answer
// pattern — no per-bot scheduled callback needed.
export function resolveDueBotGuesses(room) {
  const gs = room.gameState;
  if (!gs || gs.phase !== 'drawing') return [];
  const now = Date.now();
  const resolved = [];
  for (const [botId, delay] of Object.entries(gs.botGuessDelays || {})) {
    if (gs.correctGuessers.includes(botId)) continue;
    if (now - gs.roundStartedAt < delay) continue;
    const bot = room.players.get(botId);
    if (!bot) continue;

    const isFirst = gs.correctGuessers.length === 0;
    const points = scoreForGuess(gs, isFirst);
    gs.correctGuessers.push(botId);
    gs.scores[botId] = (gs.scores[botId] || 0) + points;
    resolved.push({ nickname: bot.nickname });
  }
  return resolved;
}

export function recordGuess(room, playerId, text) {
  const gs = room.gameState;
  const normalizedGuess = text?.trim().toLowerCase();
  const normalizedWord = gs.currentWord?.toLowerCase();
  if (!normalizedGuess) return { correct: false };

  if (normalizedGuess === normalizedWord) {
    const isFirst = gs.correctGuessers.length === 0;
    const points = scoreForGuess(gs, isFirst);
    gs.correctGuessers.push(playerId);
    gs.scores[playerId] = (gs.scores[playerId] || 0) + points;
    return { correct: true, points, totalScore: gs.scores[playerId] };
  }

  const revealed = gs.revealedPositions ?? new Set();
  let newReveal = false;
  for (let i = 0; i < normalizedWord.length; i++) {
    if (!revealed.has(i) && normalizedGuess[i] === normalizedWord[i]) {
      revealed.add(i);
      newReveal = true;
    }
  }
  gs.revealedPositions = revealed;
  return { correct: false, newReveal, hint: newReveal ? buildHint(gs.currentWord, revealed) : null };
}

export function nonDrawerCount(room) {
  const gs = room.gameState;
  return [...room.players.keys()].filter(id => id !== gs.currentDrawerId).length;
}

// Pixel-font stroke data: each letter on a 3×4 grid (gx∈[0,3], gy∈[0,4], y-down)
const SIMPLE_FONT = {
  A: [[[0,4],[1.5,0],[3,4]], [[0.75,2.5],[2.25,2.5]]],
  B: [[[0,0],[0,4],[2.5,4],[3,3.5],[3,2.5],[2.5,2],[0,2],[2.5,2],[3,1.5],[3,0.5],[2.5,0],[0,0]]],
  C: [[[3,0.5],[2,0],[1,0],[0,0.5],[0,3.5],[1,4],[2,4],[3,3.5]]],
  D: [[[0,0],[0,4],[2,4],[3,3.5],[3,0.5],[2,0],[0,0]]],
  E: [[[3,0],[0,0],[0,4],[3,4]], [[0,2],[2,2]]],
  F: [[[3,0],[0,0],[0,4]], [[0,2],[2.5,2]]],
  G: [[[3,0.5],[2,0],[1,0],[0,1],[0,3],[1,4],[2,4],[3,3.5],[3,2],[2,2]]],
  H: [[[0,0],[0,4]], [[3,0],[3,4]], [[0,2],[3,2]]],
  I: [[[0.5,0],[2.5,0]], [[1.5,0],[1.5,4]], [[0.5,4],[2.5,4]]],
  J: [[[0,0],[3,0]], [[2,0],[2,3.5],[1.5,4],[0.5,3.5]]],
  K: [[[0,0],[0,4]], [[0,2],[3,0]], [[0,2],[3,4]]],
  L: [[[0,0],[0,4],[3,4]]],
  M: [[[0,4],[0,0],[1.5,2],[3,0],[3,4]]],
  N: [[[0,4],[0,0],[3,4],[3,0]]],
  O: [[[1.5,0],[0.5,0],[0,1],[0,3],[0.5,4],[1.5,4],[2.5,4],[3,3],[3,1],[2.5,0],[1.5,0]]],
  P: [[[0,4],[0,0],[2.5,0],[3,0.5],[3,1.5],[2.5,2],[0,2]]],
  Q: [[[1.5,0],[0.5,0],[0,1],[0,3],[0.5,4],[1.5,4],[2.5,4],[3,3],[3,1],[2.5,0],[1.5,0]], [[2,3],[3,4]]],
  R: [[[0,4],[0,0],[2.5,0],[3,0.5],[3,1.5],[2.5,2],[0,2]], [[1.5,2],[3,4]]],
  S: [[[3,0.5],[2,0],[1,0],[0,0.5],[0,1.5],[1,2],[2,2.5],[3,3],[3,3.5],[2,4],[1,4],[0,3.5]]],
  T: [[[0,0],[3,0]], [[1.5,0],[1.5,4]]],
  U: [[[0,0],[0,3],[0.5,4],[1.5,4],[2.5,4],[3,3],[3,0]]],
  V: [[[0,0],[1.5,4],[3,0]]],
  W: [[[0,0],[0.75,4],[1.5,2],[2.25,4],[3,0]]],
  X: [[[0,0],[3,4]], [[3,0],[0,4]]],
  Y: [[[0,0],[1.5,2],[3,0]], [[1.5,2],[1.5,4]]],
  Z: [[[0,0],[3,0],[0,4],[3,4]]],
};

// Precomputes the entire letter-by-letter drawing simulation as a flat list
// of { stroke, delayMs } pairs. Shipped to clients in one payload for a bot
// drawer's round_started event — each client replays it locally with
// setTimeout, since it's cosmetic only and doesn't affect scoring.
export function buildBotStrokePlan(word) {
  const letters = word.toUpperCase().split('');
  const cellW = Math.min(0.12, 0.8 / Math.max(letters.length, 1));
  const cellH = cellW * 1.4;
  const totalW = cellW * letters.length;
  const startX = Math.max(0.05, (1 - totalW) / 2);
  const startY = 0.28;
  const lineWidth = Math.max(2, Math.round(cellW * 22));

  const plan = [];
  let delay = 2000;
  const letterGap = 1000;

  for (let ci = 0; ci < letters.length; ci++) {
    const letter = letters[ci];
    if (letter === ' ') { delay += letterGap; continue; }
    const segments = SIMPLE_FONT[letter];
    if (!segments) { delay += letterGap; continue; }

    const ox = startX + ci * cellW;
    const oy = startY;

    segments.forEach((seg, si) => {
      const strokeDelay = delay + si * 80;
      const points = seg.map(([gx, gy]) => ({
        x: Math.max(0.01, Math.min(0.99, ox + (gx / 3) * cellW)),
        y: Math.max(0.01, Math.min(0.99, oy + (gy / 4) * cellH)),
      }));
      if (points.length >= 2) {
        plan.push({ stroke: { points, color: '#ffffff', lineWidth }, delayMs: strokeDelay });
      }
    });

    delay += letterGap + segments.length * 80;
  }

  return plan;
}
