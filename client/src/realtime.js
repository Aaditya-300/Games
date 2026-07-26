import Pusher from 'pusher-js';
import { getPlayerId } from './identity';
import { apiFetch, ApiError } from './api';

const PUSHER_KEY = import.meta.env.VITE_PUSHER_KEY;
const PUSHER_CLUSTER = import.meta.env.VITE_PUSHER_CLUSTER;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// event name → REST endpoint. Every call is a POST; the shim injects the
// X-Player-Id header and (when known) the current room code so the ~20
// component call sites that did `socket.emit(name, payload)` need only
// swap their import for `realtime.emit(name, payload)`.
const ROUTES = {
  'room:create': '/api/room/create',
  'room:join': '/api/room/join',
  'room:spectate': '/api/room/spectate',
  'room:leave': '/api/room/leave',
  'room:kick': '/api/room/kick',
  'room:add_bot': '/api/room/add-bot',
  'room:remove_bot': '/api/room/remove-bot',

  'chat:send': '/api/chat/send',

  'game:start': '/api/game/start',
  'game:play_card': '/api/game/play-card',
  'game:choose_color': '/api/game/choose-color',
  'game:choose_discard_color': '/api/game/choose-discard-color',
  'game:choose_swap_target': '/api/game/choose-swap-target',
  'game:choose_sabotage_target': '/api/game/choose-sabotage-target',
  'game:draw_card': '/api/game/draw-card',
  'game:pass': '/api/game/pass',
  'game:call_uno': '/api/game/call-uno',
  'game:challenge_draw4': '/api/game/challenge-draw4',
  'game:turn_timeout': '/api/game/turn-timeout',

  'td:start': '/api/td/start',
  'td:spin': '/api/td/spin',
  'td:next_turn': '/api/td/next-turn',
  'td:end': '/api/td/end',

  'sk:start': '/api/sk/start',
  'sk:pick_word': '/api/sk/pick-word',
  'sk:draw_stroke': '/api/sk/draw-stroke',
  'sk:clear_canvas': '/api/sk/clear-canvas',
  'sk:guess': '/api/sk/guess',
  'sk:end_turn': '/api/sk/end-turn',
  'sk:next_round': '/api/sk/next-round',
  'sk:end': '/api/sk/end',

  'iq:start': '/api/iq/start',
  'iq:answer': '/api/iq/answer',
  'iq:end': '/api/iq/end',
};

// Endpoints that don't need a roomCode injected (the payload already
// carries one, or there isn't a room yet).
const NO_ROOM_INJECT = new Set(['room:create', 'room:join', 'room:spectate']);

// room:create/join/spectate resolve before the player is subscribed to any
// Pusher channel, so their result can't arrive as a push — it comes back as
// the direct HTTP response instead. Re-dispatch it as the event(s) the rest
// of the app already listens for via .on(), so useSocket.js needs no changes.
// Each entry maps to one or more (event, payload-transform) pairs.
const SYNTHESIZE_RESPONSE_EVENTS = {
  'room:create': [
    data => ['room:created', data],
    data => data.messages ? ['chat:history', { messages: data.messages }] : null,
  ],
  'room:join': [
    data => ['room:joined', data],
    data => data.messages ? ['chat:history', { messages: data.messages }] : null,
  ],
  // room:joined's own handler inspects data.gameState to navigate into an
  // already-running game on rejoin — no separate event needed here.
  'room:spectate': [
    data => ['room:joined', { ...data, isSpectator: true }],
    data => data.messages ? ['chat:history', { messages: data.messages }] : null,
    data => data.gameState ? ['game:state_update', { gameState: data.gameState }] : null,
  ],
  // iq:answer_locked was a direct-to-caller emit in the old socket handler
  // (not a room broadcast) — synthesize it the same way from the response.
  'iq:answer': [
    data => ['iq:answer_locked', { optionIndex: data.optionIndex }],
  ],
  'sk:pick_word': [
    data => ['sk:word_confirmed', { word: data.word }],
  ],
};

let pusherClient = null;
let roomChannelObj = null;
let playerChannelObj = null;
let currentRoomCode = null;
const listeners = new Map(); // eventName -> Set<handler>

function ensurePusher() {
  if (pusherClient) return pusherClient;
  pusherClient = new Pusher(PUSHER_KEY, {
    cluster: PUSHER_CLUSTER,
    authEndpoint: `${API_BASE_URL}/api/pusher/auth`,
    auth: { headers: { 'X-Player-Id': getPlayerId() } },
  });
  return pusherClient;
}

function bindAllOn(channel) {
  for (const [event, handlers] of listeners) {
    for (const handler of handlers) channel.bind(event, handler);
  }
}

function subscribePlayerChannel() {
  const pusher = ensurePusher();
  playerChannelObj = pusher.subscribe(`private-player-${getPlayerId()}`);
  bindAllOn(playerChannelObj);
}

function setRoomCode(code) {
  if (!code || code === currentRoomCode) return;
  const pusher = ensurePusher();
  if (roomChannelObj) pusher.unsubscribe(roomChannelObj.name);
  currentRoomCode = code;
  roomChannelObj = pusher.subscribe(`presence-room-${code}`);
  bindAllOn(roomChannelObj);
}

function clearRoomCode() {
  if (!currentRoomCode) return;
  const pusher = ensurePusher();
  if (roomChannelObj) pusher.unsubscribe(roomChannelObj.name);
  roomChannelObj = null;
  currentRoomCode = null;
}

const realtime = {
  connect() {
    subscribePlayerChannel();
  },

  disconnect() {
    if (pusherClient) pusherClient.disconnect();
    pusherClient = null;
    roomChannelObj = null;
    playerChannelObj = null;
    currentRoomCode = null;
    listeners.clear();
  },

  on(event, handler) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(handler);
    if (roomChannelObj) roomChannelObj.bind(event, handler);
    if (playerChannelObj) playerChannelObj.bind(event, handler);
  },

  off(event, handler) {
    listeners.get(event)?.delete(handler);
    roomChannelObj?.unbind(event, handler);
    playerChannelObj?.unbind(event, handler);
  },

  removeAllListeners() {
    for (const [event, handlers] of listeners) {
      for (const handler of handlers) {
        roomChannelObj?.unbind(event, handler);
        playerChannelObj?.unbind(event, handler);
      }
    }
    listeners.clear();
  },

  async emit(event, payload = {}) {
    const path = ROUTES[event];
    if (!path) throw new Error(`Unknown realtime event: ${event}`);

    const body = { ...payload };
    if (!NO_ROOM_INJECT.has(event) && !body.roomCode && currentRoomCode) {
      body.roomCode = currentRoomCode;
    }

    let data;
    try {
      data = await apiFetch(path, body);
    } catch (err) {
      // The old socket handlers reported failures via a `*:error` event
      // rather than a thrown rejection — dispatch the same way so existing
      // useSocket.js handlers (room:error, game:error, ...) keep working.
      const prefix = event.split(':')[0];
      const errorEvent = `${prefix}:error`;
      const message = err instanceof ApiError ? err.message : 'Request failed';
      for (const handler of listeners.get(errorEvent) || []) handler({ message });
      return null;
    }

    if (event === 'room:leave') {
      clearRoomCode();
    } else if (data?.room?.code) {
      setRoomCode(data.room.code);
    }

    const transforms = SYNTHESIZE_RESPONSE_EVENTS[event];
    if (transforms) {
      for (const transform of transforms) {
        const result = transform(data);
        if (!result) continue;
        const [responseEvent, payload] = result;
        for (const handler of listeners.get(responseEvent) || []) handler(payload);
      }
    }

    return data;
  },

  get id() {
    return getPlayerId();
  },
};

export default realtime;
