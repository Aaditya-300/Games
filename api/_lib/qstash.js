import { Client } from '@upstash/qstash';

const qstash = new Client({ token: process.env.QSTASH_TOKEN });

// Schedules a delayed POST to one of our own /api endpoints. `path` is
// relative (e.g. '/api/game/turn-timeout'); resolved against VERCEL_URL
// (or PUBLIC_BASE_URL for local/custom domains) since QStash needs a
// publicly reachable URL, not a relative one.
export async function scheduleCallback(path, body, delaySeconds) {
  const base = process.env.PUBLIC_BASE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  if (!base) throw new Error('PUBLIC_BASE_URL or VERCEL_URL must be set to schedule QStash callbacks');

  await qstash.publishJSON({
    url: `${base}${path}`,
    body,
    delay: delaySeconds,
  });
}
