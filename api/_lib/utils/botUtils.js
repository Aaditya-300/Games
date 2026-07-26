export const BOT_NAMES = ['Aria', 'Nova', 'Pixel', 'Rex', 'Zara', 'Leo', 'Maya', 'Otto', 'Kai', 'Sage'];

export function isBotId(id) {
  return typeof id === 'string' && id.startsWith('bot_');
}
