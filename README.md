# UNO Online

Multiplayer party game hub. Vercel serverless functions + Pusher Channels for realtime + Upstash Redis for state, React + Vite frontend.
One lobby/room system powers four games:

- 🃏 **UNO** — classic card game, 2–15 players, plus custom cards (Shield, Peek, Swap Hands, Draw Until Color, Discard Color, Sabotage)
- 🎲 **Truth or Dare** — spin the wheel, get a Truth or Dare card, 2–20 players
- ✏️ **Sketch & Draw** — draw the secret word, others guess in chat, 3 rounds, 2–20 players
- 🧠 **IQ Test** — general knowledge multiple-choice trivia, 20s per question, time-weighted scoring, 2–20 players

All four support bots (fill empty seats, play automatically) and a shared chat sidebar per room.

## Architecture

This app runs entirely on Vercel — there is no persistent Node process. Every player action is a stateless HTTP call to a Vercel serverless function under `api/`; realtime updates are pushed to clients over **Pusher Channels**; room/game state lives in **Upstash Redis** (not in server memory) so it survives across function invocations; and countdown/window timers that must fire even if no client is watching (UNO's UNO-catch/challenge windows, IQ's question/reveal timers, Sketch & Draw's round timer) are scheduled via **Upstash QStash**.

Player identity is a client-generated UUID persisted in `localStorage` (see `client/src/identity.js`), sent as an `X-Player-Id` header on every request and Pusher auth call — this replaces what used to be a Socket.io `socket.id`, and as a side effect makes rejoining a room after a page reload idempotent (same player ID → same seat) rather than needing a separate reconnect flow.

## Requirements

- Node.js
- [Vercel CLI](https://vercel.com/docs/cli) (`npm i -g vercel`) for local development against the serverless functions
- Accounts + API keys for **Upstash** (Redis + QStash) and **Pusher** (Channels) — see [Environment variables](#environment-variables)
- Run `npm run install:all` from the repo root once to install all workspace dependencies

## Development

**Terminal 1 — API + client, via Vercel's local emulator** (serves both `api/` and the built client on port 3000):

```bash
vercel dev
```

**Terminal 2 — client dev server** (Vite + React on port 5173, hot-reloading, proxies `/api` to `vercel dev`):

```bash
cd client
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser. You'll need a `.env` file (see below) with your Upstash/Pusher credentials for either terminal to work — without them, room creation and realtime updates will fail.

## Project structure

```
Games/
├── package.json           # root workspace (npm workspaces: client)
├── vercel.json             # build command + SPA rewrite for Vercel
├── api/                     # Vercel serverless functions (the backend)
│   ├── _lib/                # shared logic, imported by the functions below — not routable itself
│   │   ├── config.js        # timing constants (turn duration, UNO/challenge windows, etc.)
│   │   ├── redis.js         # Upstash Redis room store: get/save/lock, Map/Set (de)serialization
│   │   ├── pusher.js         # Pusher server client + broadcastToRoom/sendToPlayer helpers
│   │   ├── qstash.js         # schedules delayed callbacks to other /api endpoints
│   │   ├── qstashReceiver.js  # verifies inbound QStash callback signatures
│   │   ├── identity.js       # reads/validates the X-Player-Id header
│   │   ├── cors.js           # CORS_ORIGINS-gated response headers
│   │   ├── roomAccess.js     # loads a room and checks the caller is a member
│   │   ├── roomManager.js    # room/player CRUD, public view serializers
│   │   ├── chatManager.js    # per-room chat history + system messages
│   │   ├── botManager.js     # UNO bot AI — resolved synchronously/inline, no setTimeout
│   │   ├── gameFlow.js       # UNO turn advancement + QStash timer scheduling glue
│   │   ├── gameEngine.js, cardEffects.js, turnManager.js, deckBuilder.js, validators.js  # UNO rules (pure functions, unchanged since the Socket.io version)
│   │   ├── tdEngine.js, tdCards.js         # Truth or Dare
│   │   ├── skEngine.js, skFlow.js, skWords.js  # Sketch & Draw (+ bot drawing/guessing)
│   │   ├── iqEngine.js, iqQuestions.js     # IQ Test
│   │   └── utils/            # shuffle, room-code generation, bot-id helpers
│   ├── pusher/
│   │   ├── auth.js           # authorizes presence-room-*/private-player-* channel subscriptions
│   │   └── webhook.js        # presence member_added/removed → connection status
│   ├── room/                 # create, join, spectate, leave, kick, add-bot, remove-bot
│   ├── chat/                 # send
│   ├── game/                 # UNO: start, play-card, draw-card, pass, call-uno, challenge-draw4,
│   │                          #      choose-color/-swap-target/-sabotage-target/-discard-color,
│   │                          #      turn-timeout, uno-timeout, challenge-timeout (QStash callbacks)
│   ├── td/                   # start, spin, next-turn, end
│   ├── sk/                   # start, pick-word, draw-stroke, clear-canvas, guess, end-turn,
│   │                          #      next-round, end, tick (QStash round-timeout callback)
│   └── iq/                   # start, answer, end, tick (QStash question/reveal callback)
│
└── client/                   # React + Vite frontend
    ├── package.json
    ├── vite.config.js        # dev server + /api proxy to `vercel dev`
    └── src/
        ├── main.jsx, App.jsx   # entry + route table (react-router-dom)
        ├── identity.js          # generates/persists the player's UUID
        ├── api.js               # fetch wrapper — attaches X-Player-Id, throws ApiError
        ├── realtime.js          # drop-in replacement for the old socket.js: .emit maps to a
        │                        #   REST call, .on subscribes to Pusher channels
        ├── hooks/
        │   ├── useSocket.js     # registers all realtime.on(...) listeners, drives navigation
        │   ├── useGame.js       # derived UNO game-state selectors
        │   └── useTurnTimer.js  # client-side countdown; self-reports timeout via realtime.emit
        ├── store/               # zustand stores, one per concern (unchanged — no socket coupling)
        ├── pages/               # one lobby + one game page per game type
        ├── components/          # lobby/, shared/, chat/, game/, td/, sk/
        └── styles/
```

**Adding a new game** follows the same shape each time: an `api/<x>/*.js` set of endpoints backed by an `api/_lib/<x>Engine.js`, a `client/src/store/<x>Store.js`, an `<X>LobbyPage.jsx` + `<X>GamePage.jsx` pair wired into `App.jsx`'s routes, realtime listeners added to `useSocket.js`, entries added to `client/src/realtime.js`'s `ROUTES` map, and an entry in `LandingPage.jsx`'s `GAMES` list.

## Environment variables

| Variable                        | Used by | Purpose                                                                 |
|----------------------------------|---------|--------------------------------------------------------------------------|
| `UPSTASH_REDIS_REST_URL`         | api     | Upstash Redis REST endpoint (room/game state store)                     |
| `UPSTASH_REDIS_REST_TOKEN`       | api     | Upstash Redis REST auth token                                           |
| `QSTASH_TOKEN`                   | api     | Upstash QStash token, used to schedule delayed timeout callbacks         |
| `QSTASH_CURRENT_SIGNING_KEY`     | api     | Verifies inbound QStash callbacks are genuine                            |
| `QSTASH_NEXT_SIGNING_KEY`        | api     | Same, covers key rotation                                                |
| `PUSHER_APP_ID`                  | api     | Pusher Channels app ID                                                   |
| `PUSHER_KEY`                     | api     | Pusher Channels key (server-side)                                        |
| `PUSHER_SECRET`                  | api     | Pusher Channels secret                                                   |
| `PUSHER_CLUSTER`                 | api     | Pusher Channels cluster (e.g. `us2`, `eu`)                                |
| `CORS_ORIGINS`                   | api     | Comma-separated list of origins allowed to call the API cross-origin     |
| `PUBLIC_BASE_URL`                | api     | Publicly reachable base URL QStash calls back to (falls back to `VERCEL_URL`) |
| `VITE_PUSHER_KEY`                | client  | Pusher Channels key (public, safe to expose client-side)                 |
| `VITE_PUSHER_CLUSTER`            | client  | Pusher Channels cluster                                                  |
| `VITE_API_BASE_URL`              | client  | Base URL for API calls; leave unset for same-origin (client + API on one Vercel project) |

## Deploying online

1. **Upstash** ([console.upstash.com](https://console.upstash.com)) — create a Redis database, copy its REST URL/token. Create a QStash instance under the same account, copy its token and signing keys.
2. **Pusher** ([dashboard.pusher.com](https://dashboard.pusher.com)) — create a new Channels app, enable **Presence**, copy its app ID/key/secret/cluster.
3. **Vercel** — import this repo as a new project. `vercel.json` already points the build at `client/` and rewrites non-`/api` routes to `index.html`. Add all the environment variables above in the project's Settings.
4. After the first deploy, go back to the Pusher app's dashboard → **Webhooks**, and point it at `https://<your-vercel-domain>/api/pusher/webhook` (this URL only exists after the first deploy, so it's a two-step setup).
5. Push to `main` — Vercel deploys automatically on every push (no custom GitHub Action needed).

**Notes:**
- Redis rooms auto-expire 30 minutes after their last write (`EXPIRE` on every save) — there's no cleanup cron job to run, the store handles it.
- Every mutating endpoint takes a short-lived per-room Redis lock before reading/modifying/writing state, to prevent two concurrent requests (e.g. a bot's inline move racing a human's play) from clobbering each other.
- UNO bot turns resolve **instantly** rather than after a "thinking" pause — there's no persistent process to hold that delay. If you want the pacing back, it would need to be a client-side delay applied after receiving an already-computed move.
- Sketch & Draw's bot drawing is precomputed server-side as a full stroke-and-timing plan and shipped to clients in one payload; each client replays it locally with `setTimeout` since it's cosmetic only and doesn't affect scoring.
