export const PORT = process.env.PORT || 3001;
export const CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:5173'];

export const MAX_PLAYERS = 20;
// UNO's 124-card deck can't deal 7 cards to more than ~17 players; cap it lower.
export const MAX_PLAYERS_UNO = 15;
export const TURN_DURATION_MS = 30000;
export const RECONNECT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
export const ROOM_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const ROOM_CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
export const CHAT_HISTORY_LIMIT = 200;
export const UNO_CATCH_WINDOW_MS = 2000;
export const CHALLENGE_WINDOW_MS = 5000;
export const PEEK_DURATION_MS = 5000;
export const IQ_QUESTION_DURATION_MS = 20_000;
export const IQ_TOTAL_QUESTIONS = 10;
