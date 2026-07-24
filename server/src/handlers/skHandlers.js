import { getRooms } from '../roomManager.js';
import { systemMessage } from '../chatManager.js';
import { SK_WORDS } from '../skWords.js';
import { isBotId } from '../utils/botUtils.js';

const ROUND_DURATION_MS = 180_000;
const TOTAL_ROUNDS = 3;

function findSocketRoom(socketId) {
  for (const room of getRooms().values()) {
    if (room.players.has(socketId) || room.spectators.has(socketId)) return room;
  }
  return null;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickWords(gs, count = 3) {
  if (gs.usedWordIndices.length + count > SK_WORDS.length) {
    gs.usedWordIndices = [];
  }
  const usedSet = new Set(gs.usedWordIndices);
  const available = SK_WORDS.map((_, i) => i).filter(i => !usedSet.has(i));
  const picked = shuffle(available).slice(0, count);
  gs.usedWordIndices.push(...picked);
  return picked.map(i => SK_WORDS[i]);
}

function buildHint(word, revealedPositions) {
  return Array.from(word)
    .map((c, i) => c === ' ' ? '/' : revealedPositions.has(i) ? c : '_')
    .join(' ');
}

function getPublicState(gs) {
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

function initSkGameState(roomCode, drawerQueue) {
  const scores = {};
  for (const id of drawerQueue) scores[id] = 0;
  return {
    roomCode,
    phase: 'word_pick',
    // round is 1-based; currentDrawerIndex is position within drawerQueue for current round
    round: 1,
    totalRounds: TOTAL_ROUNDS,
    drawerQueue,           // player IDs for this round order; same order each round
    currentDrawerIndex: 0, // index into drawerQueue
    currentDrawerId: drawerQueue[0],
    currentWord: null,
    wordOptions: null,
    roundStartedAt: null,
    roundEndsAt: null,
    correctGuessers: [],
    scores,
    prevScores: { ...scores },
    turnTimer: null,
    usedWordIndices: [],
  };
}

// Called after a turn ends; advances to next drawer or next round or game over
function advanceTurn(io, room) {
  const gs = room.gameState;
  gs.currentDrawerIndex++;

  if (gs.currentDrawerIndex < gs.drawerQueue.length) {
    // More drawers left in current round
    beginWordPick(io, room);
  } else {
    // Round complete
    if (gs.round >= gs.totalRounds) {
      gs.phase = 'game_over';
      room.status = 'ended';
      io.to(`room:${room.code}`).emit('sk:game_over', { scores: { ...gs.scores } });
    } else {
      gs.phase = 'round_end';
      gs.prevScores = { ...gs.scores };
      io.to(`room:${room.code}`).emit('sk:round_ended', {
        round: gs.round,
        scores: { ...gs.scores },
      });
    }
  }
}

function beginWordPick(io, room) {
  const gs = room.gameState;
  gs.currentDrawerId = gs.drawerQueue[gs.currentDrawerIndex];
  gs.currentWord = null;
  gs.correctGuessers = [];
  gs.roundStartedAt = null;
  gs.roundEndsAt = null;
  gs.phase = 'word_pick';

  const options = pickWords(gs, 3);
  gs.wordOptions = options;

  const drawerNickname = room.players.get(gs.currentDrawerId)?.nickname ?? 'Unknown';

  if (isBotId(gs.currentDrawerId)) {
    scheduleBotWordPick(io, room, gs.currentDrawerId, options);
  } else {
    io.to(gs.currentDrawerId).emit('sk:word_options', { options });
  }
  io.to(`room:${room.code}`).emit('sk:next_drawer', {
    drawerId: gs.currentDrawerId,
    drawerNickname,
    gameState: getPublicState(gs),
  });
}

export function _endTurnExported(io, room) { endTurn(io, room); }

function scheduleBotWordPick(io, room, botId, options) {
  setTimeout(() => {
    if (!room.gameState || room.gameState.currentDrawerId !== botId) return;
    if (room.gameState.phase !== 'word_pick') return;
    const word = options[Math.floor(Math.random() * options.length)];
    const gs = room.gameState;
    gs.currentWord = word;
    gs.phase = 'drawing';
    gs.roundStartedAt = Date.now();
    gs.roundEndsAt = gs.roundStartedAt + ROUND_DURATION_MS;
    gs.correctGuessers = [];
    gs.revealedPositions = new Set();

    const bot = room.players.get(botId);
    const hint = buildHint(word, gs.revealedPositions);

    io.to(`room:${room.code}`).emit('sk:round_started', {
      drawerId: botId,
      drawerNickname: bot?.nickname ?? 'Bot',
      hint,
      wordLength: word.length,
      roundEndsAt: gs.roundEndsAt,
      round: gs.round,
      totalRounds: gs.totalRounds,
    });

    // Schedule bot guessers
    for (const [id, p] of room.players) {
      if (p.isBot && id !== botId) scheduleBotGuess(io, room, id, word);
    }

    scheduleBotDrawing(io, room, botId, word);

    gs.turnTimer = setTimeout(() => endTurn(io, room), ROUND_DURATION_MS);
  }, 1500);
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

// Draws the word letter-by-letter so players can read and guess it
function scheduleBotDrawing(io, room, botId, word) {
  const letters = word.toUpperCase().split('');
  const cellW = Math.min(0.12, 0.8 / Math.max(letters.length, 1));
  const cellH = cellW * 1.4;
  const totalW = cellW * letters.length;
  const startX = Math.max(0.05, (1 - totalW) / 2);
  const startY = 0.28;
  const lineWidth = Math.max(2, Math.round(cellW * 22));

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
        const stroke = { points, color: '#ffffff', lineWidth };
        setTimeout(() => {
          if (!room.gameState || room.gameState.currentWord !== word) return;
          if (room.gameState.phase !== 'drawing') return;
          io.to(`room:${room.code}`).emit('sk:draw_stroke', { stroke });
        }, strokeDelay);
      }
    });

    delay += letterGap + segments.length * 80;
  }
}

function scheduleBotGuess(io, room, botId, word) {
  const delay = 8000 + Math.random() * 25000;
  setTimeout(() => {
    if (!room.gameState) return;
    const gs = room.gameState;
    if (gs.phase !== 'drawing') return;
    if (gs.correctGuessers.includes(botId)) return;
    if (gs.currentWord !== word) return; // round changed

    const bot = room.players.get(botId);
    if (!bot) return;

    const timeRemaining = Math.max(0, (gs.roundEndsAt - Date.now()) / 1000);
    const isFirst = gs.correctGuessers.length === 0;
    const basePoints = Math.max(10, Math.round((timeRemaining / 180) * 300));
    const points = isFirst ? basePoints + 50 : basePoints;

    gs.correctGuessers.push(botId);
    gs.scores[botId] = (gs.scores[botId] || 0) + points;

    io.to(`room:${room.code}`).emit('sk:player_guessed', { nickname: bot.nickname });

    const nonDrawers = [...room.players.keys()].filter(id => id !== gs.currentDrawerId);
    if (gs.correctGuessers.length >= nonDrawers.length) {
      endTurn(io, room);
    }
  }, delay);
}

function endTurn(io, room) {
  const gs = room.gameState;
  if (!gs) return;

  if (gs.turnTimer) {
    clearTimeout(gs.turnTimer);
    gs.turnTimer = null;
  }

  // Drawer bonus
  const drawerBonus = gs.correctGuessers.length * 20;
  if (drawerBonus > 0 && gs.currentDrawerId) {
    gs.scores[gs.currentDrawerId] = (gs.scores[gs.currentDrawerId] || 0) + drawerBonus;
  }

  io.to(`room:${room.code}`).emit('sk:turn_ended', {
    word: gs.currentWord,
    scores: { ...gs.scores },
    correctGuessers: [...gs.correctGuessers],
    drawerId: gs.currentDrawerId,
  });

  advanceTurn(io, room);
}

export function registerSkHandlers(io, socket) {
  socket.on('sk:start', () => {
    const room = findSocketRoom(socket.id);
    if (!room) return;
    if (room.gameType !== 'sketch') return;

    const player = room.players.get(socket.id);
    if (!player?.isHost) return socket.emit('sk:error', { message: 'Only host can start' });
    if (room.status !== 'waiting') return socket.emit('sk:error', { message: 'Game already started' });

    const activePlayers = [...room.players.values()].filter(p => !p.isSpectator);

    const drawerQueue = shuffle(activePlayers.map(p => p.id));
    room.gameState = initSkGameState(room.code, drawerQueue);
    room.status = 'playing';
    room.lastActivityAt = Date.now();

    const gs = room.gameState;
    const options = pickWords(gs, 3);
    gs.wordOptions = options;

    io.to(`room:${room.code}`).emit('sk:started', { gameState: getPublicState(gs) });

    if (isBotId(gs.currentDrawerId)) {
      scheduleBotWordPick(io, room, gs.currentDrawerId, options);
    } else {
      io.to(gs.currentDrawerId).emit('sk:word_options', { options });
    }

    const msg = systemMessage(room, 'Sketch & Draw game started!');
    io.to(`room:${room.code}`).emit('chat:message', { message: msg });
  });

  socket.on('sk:pick_word', ({ word } = {}) => {
    const room = findSocketRoom(socket.id);
    if (!room?.gameState) return;
    const gs = room.gameState;

    if (gs.phase !== 'word_pick') return socket.emit('sk:error', { message: 'Not in word pick phase' });
    if (gs.currentDrawerId !== socket.id) return socket.emit('sk:error', { message: 'Not your turn to draw' });
    if (!gs.wordOptions?.includes(word)) return socket.emit('sk:error', { message: 'Invalid word choice' });

    gs.currentWord = word;
    gs.phase = 'drawing';
    gs.roundStartedAt = Date.now();
    gs.roundEndsAt = gs.roundStartedAt + ROUND_DURATION_MS;
    gs.correctGuessers = [];
    gs.revealedPositions = new Set();
    room.lastActivityAt = Date.now();

    const drawerNickname = room.players.get(socket.id)?.nickname ?? 'Unknown';
    const hint = buildHint(word, gs.revealedPositions);

    io.to(`room:${room.code}`).emit('sk:round_started', {
      drawerId: gs.currentDrawerId,
      drawerNickname,
      hint,
      wordLength: word.length,
      roundEndsAt: gs.roundEndsAt,
      round: gs.round,
      totalRounds: gs.totalRounds,
    });

    socket.emit('sk:word_confirmed', { word });

    // Schedule bot guessers
    for (const [id, p] of room.players) {
      if (p.isBot && id !== gs.currentDrawerId) {
        scheduleBotGuess(io, room, id, word);
      }
    }

    gs.turnTimer = setTimeout(() => endTurn(io, room), ROUND_DURATION_MS);
  });

  socket.on('sk:draw_stroke', ({ stroke } = {}) => {
    const room = findSocketRoom(socket.id);
    if (!room?.gameState) return;
    const gs = room.gameState;

    if (gs.phase !== 'drawing') return;
    if (gs.currentDrawerId !== socket.id) return;
    if (!stroke?.points?.length) return;

    socket.to(`room:${room.code}`).emit('sk:draw_stroke', { stroke });
    room.lastActivityAt = Date.now();
  });

  socket.on('sk:clear_canvas', () => {
    const room = findSocketRoom(socket.id);
    if (!room?.gameState) return;
    const gs = room.gameState;

    if (gs.currentDrawerId !== socket.id) return;

    io.to(`room:${room.code}`).emit('sk:canvas_cleared');
    room.lastActivityAt = Date.now();
  });

  socket.on('sk:guess', ({ text } = {}) => {
    const room = findSocketRoom(socket.id);
    if (!room?.gameState) return;
    const gs = room.gameState;

    if (gs.phase !== 'drawing') return socket.emit('sk:error', { message: 'No active round' });
    if (gs.currentDrawerId === socket.id) return;
    if (gs.correctGuessers.includes(socket.id)) return;

    const player = room.players.get(socket.id);
    const nickname = player?.nickname ?? 'Unknown';
    const normalizedGuess = text?.trim().toLowerCase();
    const normalizedWord = gs.currentWord?.toLowerCase();

    if (!normalizedGuess) return;

    if (normalizedGuess === normalizedWord) {
      const timeRemaining = Math.max(0, (gs.roundEndsAt - Date.now()) / 1000);
      const isFirst = gs.correctGuessers.length === 0;
      const basePoints = Math.max(10, Math.round((timeRemaining / 180) * 300));
      const points = isFirst ? basePoints + 50 : basePoints;

      gs.correctGuessers.push(socket.id);
      gs.scores[socket.id] = (gs.scores[socket.id] || 0) + points;

      socket.emit('sk:correct_guess', { points, totalScore: gs.scores[socket.id] });
      io.to(`room:${room.code}`).emit('sk:player_guessed', { nickname });
      room.lastActivityAt = Date.now();

      const nonDrawers = [...room.players.keys()].filter(id => id !== gs.currentDrawerId);
      if (gs.correctGuessers.length >= nonDrawers.length) {
        endTurn(io, room);
      }
    } else {
      io.to(`room:${room.code}`).emit('sk:public_guess', { nickname, text: text.trim() });

      // Reveal correctly-positioned letters from this guess
      const revealed = gs.revealedPositions ?? new Set();
      let newReveal = false;
      for (let i = 0; i < normalizedWord.length; i++) {
        if (!revealed.has(i) && normalizedGuess[i] === normalizedWord[i]) {
          revealed.add(i);
          newReveal = true;
        }
      }
      if (newReveal) {
        gs.revealedPositions = revealed;
        io.to(`room:${room.code}`).emit('sk:hint_update', { hint: buildHint(gs.currentWord, revealed) });
      }
    }
  });

  socket.on('sk:end_turn', () => {
    const room = findSocketRoom(socket.id);
    if (!room?.gameState) return;
    const gs = room.gameState;

    if (gs.currentDrawerId !== socket.id) return socket.emit('sk:error', { message: 'Not your turn to draw' });
    if (gs.phase !== 'drawing') return;

    endTurn(io, room);
  });

  socket.on('sk:next_round', () => {
    const room = findSocketRoom(socket.id);
    if (!room?.gameState) return;
    const gs = room.gameState;

    if (room.hostId !== socket.id) return socket.emit('sk:error', { message: 'Only host can advance round' });
    if (gs.phase !== 'round_end') return socket.emit('sk:error', { message: 'Not in round end phase' });

    gs.round++;
    gs.currentDrawerIndex = 0;
    beginWordPick(io, room);
  });

  socket.on('sk:end', () => {
    const room = findSocketRoom(socket.id);
    if (!room) return;
    if (room.hostId !== socket.id) return socket.emit('sk:error', { message: 'Only host can end' });

    if (room.gameState?.turnTimer) {
      clearTimeout(room.gameState.turnTimer);
    }
    room.status = 'waiting';
    room.lastActivityAt = Date.now();

    io.to(`room:${room.code}`).emit('sk:ended', { reason: 'host' });

    const msg = systemMessage(room, 'Sketch & Draw game ended by host.');
    io.to(`room:${room.code}`).emit('chat:message', { message: msg });
  });
}
