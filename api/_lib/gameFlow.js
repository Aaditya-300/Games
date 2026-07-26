import { getCurrentPlayerId } from './turnManager.js';
import { getPublicGameView } from './roomManager.js';
import { isBotId } from './utils/botUtils.js';
import { broadcastToRoom, sendToPlayer } from './pusher.js';
import { scheduleCallback } from './qstash.js';
import { runBotTurnsUntilHuman, emitTurn } from './botManager.js';
import { TURN_DURATION_MS, UNO_CATCH_WINDOW_MS, CHALLENGE_WINDOW_MS } from './config.js';

// Called after any move that leaves the game in 'play' phase with turn
// advanced. Always emits 'game:turn' first (so clients see whose turn it
// is even when that's a bot), then branches: if the next player is a bot,
// resolve their whole run of moves inline right now — there's no persistent
// process to hold a "thinking" timer the way scheduleUnoBotTurn used to —
// otherwise schedule a QStash safety-net callback for the human's timeout.
export async function advanceToNextTurn(room) {
  const gs = room.gameState;
  if (!gs || gs.phase === 'finished') return;

  await emitTurn(room);

  if (isBotId(getCurrentPlayerId(gs))) {
    await runBotTurnsUntilHuman(room);
  } else {
    await scheduleTurnTimeout(room);
  }
}

export async function scheduleTurnTimeout(room) {
  const gs = room.gameState;
  await scheduleCallback('/api/game/turn-timeout', {
    roomCode: room.code,
    expectedPlayerId: getCurrentPlayerId(gs),
    expectedTurnStartedAt: gs.turnStartedAt,
  }, Math.ceil(TURN_DURATION_MS / 1000));
}

export async function scheduleUnoWindow(room, playerId) {
  await scheduleCallback('/api/game/uno-timeout', {
    roomCode: room.code,
    playerId,
    // Distinguishes this UNO window from any later one for the same player.
    expectedTurnCount: room.gameState.turnCount,
  }, Math.ceil(UNO_CATCH_WINDOW_MS / 1000));
}

export async function scheduleChallengeWindow(room) {
  await scheduleCallback('/api/game/challenge-timeout', {
    roomCode: room.code,
    expectedLastPlayerId: room.gameState.lastPlayerId,
  }, Math.ceil(CHALLENGE_WINDOW_MS / 1000));
}

export async function broadcastHandUpdate(room, playerId) {
  if (isBotId(playerId)) return;
  const player = room.players.get(playerId);
  if (player) await sendToPlayer(playerId, 'game:hand_update', { hand: player.hand });
}

export async function broadcastStateUpdate(room) {
  await broadcastToRoom(room.code, 'game:state_update', { gameState: getPublicGameView(room.gameState) });
}
