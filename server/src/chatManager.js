import { v4 as uuidv4 } from 'uuid';
import { CHAT_HISTORY_LIMIT } from './config.js';

export function addMessage(room, senderId, senderNickname, text, type = 'player') {
  const msg = {
    id: uuidv4(),
    roomCode: room.code,
    senderId,
    senderNickname,
    text,
    type,
    timestamp: Date.now(),
  };
  room.chatHistory.push(msg);
  if (room.chatHistory.length > CHAT_HISTORY_LIMIT) {
    room.chatHistory.shift();
  }
  return msg;
}

export function systemMessage(room, text) {
  return addMessage(room, 'system', 'Game', text, 'system');
}
