// Excludes O/0/I/1 to avoid visual ambiguity
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(existingCodes) {
  let code;
  do {
    code = Array.from({ length: 6 }, () =>
      CHARS[Math.floor(Math.random() * CHARS.length)]
    ).join('');
  } while (existingCodes.has(code));
  return code;
}
