# UNO Online

Multiplayer party game hub. Node.js + Socket.io backend, React + Vite frontend.
One lobby/room system powers four games:

- 🃏 **UNO** — classic card game, 2–15 players, plus custom cards (Shield, Peek, Swap Hands, Draw Until Color, Discard Color, Sabotage)
- 🎲 **Truth or Dare** — spin the wheel, get a Truth or Dare card, 2–20 players
- ✏️ **Sketch & Draw** — draw the secret word, others guess in chat, 3 rounds, 2–20 players
- 🧠 **IQ Test** — general knowledge multiple-choice trivia, 20s per question, time-weighted scoring, 2–20 players

All four support bots (fill empty seats, play automatically) and a shared chat sidebar per room.

## Requirements

- Node.js
- Run `npm run install:all` from the repo root once to install all workspace dependencies.

## Development

The server and client must be started in **separate terminals** — `npm run dev --workspaces` won't work here because the server's `node --watch` process never exits, blocking the client from starting in the same sequential run.

**Terminal 1 — server** (Express + Socket.io on port 3001):

```bash
cd server
npm run dev
```

**Terminal 2 — client** (Vite + React on port 5173):

```bash
cd client
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

Health check for the server: `curl http://localhost:3001/health` → `{"ok":true}`.

## Project structure

```
Games/
├── package.json          # root workspace (npm workspaces: server, client)
├── render.yaml            # Render deployment blueprint
├── server/                # Express + Socket.io backend
│   ├── package.json
│   └── src/
│       ├── index.js       # entrypoint — creates the HTTP/Socket.io server, registers handlers
│       ├── config.js      # env-driven constants (PORT, timers, player caps, etc.)
│       ├── roomManager.js # room/player CRUD, public view serializers, idle-room cleanup
│       ├── chatManager.js # per-room chat history + system messages
│       ├── reconnect.js   # reconnect-token lookup for socket-drop recovery
│       ├── botManager.js  # UNO bot AI (turn scheduling, card choice, target picking)
│       │
│       ├── gameEngine.js  # UNO: core game state, playCard/drawCard/pass, win detection
│       ├── cardEffects.js # UNO: applies card effects (skip, reverse, swap, sabotage, ...)
│       ├── turnManager.js # UNO: turn order / direction advancement
│       ├── deckBuilder.js # UNO: builds the shuffled deck (standard + custom cards)
│       ├── validators.js  # UNO: legal-move checking
│       │
│       ├── tdCards.js     # Truth or Dare: truth/dare prompt text
│       ├── skWords.js     # Sketch & Draw: word bank
│       ├── iqQuestions.js # IQ Test: general-knowledge MCQ bank
│       │
│       ├── handlers/      # one file per Socket.io event namespace
│       │   ├── roomHandlers.js  # room:create/join/leave/kick/add_bot/reconnect
│       │   ├── chatHandlers.js  # chat:send
│       │   ├── gameHandlers.js  # game:* — UNO play/draw/pass/color-pick/challenge/...
│       │   ├── tdHandlers.js    # td:* — Truth or Dare spin/next_turn/end
│       │   ├── skHandlers.js    # sk:* — Sketch & Draw word-pick/draw/guess/end
│       │   └── iqHandlers.js    # iq:* — IQ Test start/answer/end
│       └── utils/         # shuffle, room-code generation, bot-id helpers, timers
│
└── client/                 # React + Vite frontend
    ├── package.json
    ├── vite.config.js      # dev server + /socket.io proxy to the backend
    └── src/
        ├── main.jsx, App.jsx   # entry + route table (react-router-dom)
        ├── socket.js            # shared Socket.io client instance
        ├── hooks/
        │   ├── useSocket.js     # registers all socket.on(...) listeners, drives navigation
        │   ├── useGame.js       # derived UNO game-state selectors
        │   └── useTurnTimer.js
        ├── store/               # zustand stores, one per concern
        │   ├── roomStore.js     # room/players/myId (shared across all games)
        │   ├── gameStore.js     # UNO game state + hand
        │   ├── tdStore.js       # Truth or Dare state
        │   ├── skStore.js       # Sketch & Draw state
        │   ├── iqStore.js       # IQ Test state
        │   ├── chatStore.js
        │   └── uiStore.js       # modals/toasts
        ├── pages/               # one lobby + one game page per game type
        │   ├── LandingPage.jsx  # create/join/spectate + game picker
        │   ├── LobbyPage.jsx, GamePage.jsx, SpectatorPage.jsx       # UNO
        │   ├── TDLobbyPage.jsx, TDGamePage.jsx                     # Truth or Dare
        │   ├── SkLobbyPage.jsx, SkGamePage.jsx                     # Sketch & Draw
        │   └── IqLobbyPage.jsx, IqGamePage.jsx                     # IQ Test
        ├── components/
        │   ├── lobby/   # PlayerList, RoomCode (shared across all lobbies)
        │   ├── shared/  # Card, Modal, Toast, LeaveButton, Spinner
        │   ├── chat/    # ChatSidebar, ChatMessage
        │   ├── game/    # UNO board pieces (GameBoard, PlayerHand, pickers, WinScreen, ...)
        │   ├── td/      # SpinWheel, TDCard, CardReveal
        │   └── sk/      # DrawingCanvas, GuessList, WordChoicePicker, Scoreboard
        └── styles/      # tokens.css (colors/spacing), global.css, card.css, animations.css
```

**Adding a new game** follows the same shape each time: a `server/src/<x>Handlers.js` registered in `server/src/index.js`, a `client/src/store/<x>Store.js`, an `<X>LobbyPage.jsx` + `<X>GamePage.jsx` pair wired into `App.jsx`'s routes, socket listeners added to `useSocket.js`, and an entry in `LandingPage.jsx`'s `GAMES` list.

## Production

From the repo root:

```bash
npm start
```

This runs the server (`server/src/index.js`, no auto-reload) on port 3001.

For the client, build static assets and preview them:

```bash
cd client
npm run build
npm run preview
```

## Environment variables

| Variable          | Used by | Default                   | Purpose                                                  |
|--------------------|---------|----------------------------|-----------------------------------------------------------|
| `PORT`             | server  | `3001`                      | Port the Socket.io/Express server listens on             |
| `CORS_ORIGINS`     | server  | `http://localhost:5173`     | Comma-separated list of origins allowed to connect        |
| `VITE_SERVER_URL`  | client  | `http://localhost:3001`     | Base URL the client connects to for the Socket.io server |

## Deploying online (Render)

This repo includes a `render.yaml` blueprint that deploys the server and client as two separate Render services — a Node web service for the Socket.io backend, and a static site for the React frontend.

1. Push this repo to GitHub (or GitLab/Bitbucket).
2. In the [Render dashboard](https://dashboard.render.com), choose **New > Blueprint** and point it at the repo. Render reads `render.yaml` and creates both services:
   - `uno-server` — Node web service, runs `npm start` from `server/`
   - `uno-client` — static site, runs `npm run build` from `client/`, publishes `client/dist`
3. After the first deploy, note each service's public URL (e.g. `https://uno-server-xxxx.onrender.com` and `https://uno-client-xxxx.onrender.com`).
4. Update `render.yaml`'s `CORS_ORIGINS` (server) and `VITE_SERVER_URL` (client) env vars to match those actual URLs, then redeploy — Render's auto-generated URLs include a random suffix that can't be known ahead of time.
5. Share the client's URL — anyone with the link can open it in a browser, create or join a room, and play.

**Notes:**
- Game/room state lives in server memory (see `server/src/roomManager.js`) — it resets on every server restart or redeploy, and only works with a single server instance (no horizontal scaling).
- Render's free tier spins services down after inactivity; the first request after idling will be slow to wake up.
- For a quick one-off playtest without deploying anywhere, you can instead tunnel your local server with a tool like `ngrok` and point `VITE_SERVER_URL` at the tunnel URL — ask if you'd like that walked through instead.
