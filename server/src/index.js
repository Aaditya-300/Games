import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { PORT, CORS_ORIGINS } from './config.js';
import { registerRoomHandlers } from './handlers/roomHandlers.js';
import { registerGameHandlers } from './handlers/gameHandlers.js';
import { registerChatHandlers } from './handlers/chatHandlers.js';
import { registerTdHandlers } from './handlers/tdHandlers.js';
import { registerSkHandlers } from './handlers/skHandlers.js';
import { registerIqHandlers } from './handlers/iqHandlers.js';

const app = express();
app.use(cors({ origin: CORS_ORIGINS }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGINS, methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
});

io.on('connection', socket => {
  registerRoomHandlers(io, socket);
  registerGameHandlers(io, socket);
  registerChatHandlers(io, socket);
  registerTdHandlers(io, socket);
  registerSkHandlers(io, socket);
  registerIqHandlers(io, socket);
});

httpServer.listen(PORT, () => {
  console.log(`UNO server running on http://localhost:${PORT}`);
});
