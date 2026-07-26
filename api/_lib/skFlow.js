import { isBotId } from './utils/botUtils.js';
import { SK_ROUND_DURATION_MS } from './config.js';
import { broadcastToRoom, sendToPlayer } from './pusher.js';
import { scheduleCallback } from './qstash.js';
import { advanceTurn, buildHint, buildBotStrokePlan, getSkPublicState } from './skEngine.js';

// Shared by sk/end-turn, sk/guess (all-guessed path), and sk/tick's
// round-timeout path: advances to the next drawer, next round, or ends the
// game — mirroring the branches the old socket handler's advanceTurn() had.
// If the next drawer is a bot, immediately resolves their word pick and
// round start too (bots never wait on a human decision).
export async function advanceSkTurn(room) {
  const outcome = advanceTurn(room);
  const gs = room.gameState;

  if (outcome === 'game_over') {
    await broadcastToRoom(room.code, 'sk:game_over', { scores: { ...gs.scores } });
    return;
  }

  if (outcome === 'round_end') {
    await broadcastToRoom(room.code, 'sk:round_ended', { round: gs.round, scores: { ...gs.scores } });
    return;
  }

  // outcome === 'next_drawer'
  const drawerNickname = room.players.get(gs.currentDrawerId)?.nickname ?? 'Unknown';
  await broadcastToRoom(room.code, 'sk:next_drawer', {
    drawerId: gs.currentDrawerId,
    drawerNickname,
    gameState: getSkPublicState(gs),
  });

  if (isBotId(gs.currentDrawerId)) {
    // beginWordPick (called inside advanceTurn) already ran startRound()
    // inline for bots, so gs.currentWord/phase are already 'drawing'.
    await broadcastRoundStarted(room);
  } else {
    await sendToPlayer(gs.currentDrawerId, 'sk:word_options', { options: gs.wordOptions });
  }
}

export async function broadcastRoundStarted(room) {
  const gs = room.gameState;
  const drawer = room.players.get(gs.currentDrawerId);
  const payload = {
    drawerId: gs.currentDrawerId,
    drawerNickname: drawer?.nickname ?? 'Unknown',
    hint: buildHint(gs.currentWord, gs.revealedPositions),
    wordLength: gs.currentWord.length,
    roundEndsAt: gs.roundEndsAt,
    round: gs.round,
    totalRounds: gs.totalRounds,
  };
  if (isBotId(gs.currentDrawerId)) {
    payload.botStrokePlan = buildBotStrokePlan(gs.currentWord);
  }
  await broadcastToRoom(room.code, 'sk:round_started', payload);
  await scheduleCallback('/api/sk/tick', {
    roomCode: room.code, expectedWord: gs.currentWord, expectedPhase: 'drawing',
  }, Math.ceil(SK_ROUND_DURATION_MS / 1000));
}
