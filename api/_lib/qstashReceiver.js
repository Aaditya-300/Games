import { Receiver } from '@upstash/qstash';

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
});

// Verifies an inbound QStash-scheduled callback is genuinely from QStash,
// not spoofed. `rawBody` must be the exact unparsed request body string.
export async function verifyQstashSignature(req, rawBody) {
  const signature = req.headers['upstash-signature'];
  if (!signature) return false;
  try {
    return await receiver.verify({ signature, body: rawBody });
  } catch {
    return false;
  }
}
