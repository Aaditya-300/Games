# UNO Online

Multiplayer UNO-like card game. Node.js + Socket.io backend, React + Vite frontend.

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
