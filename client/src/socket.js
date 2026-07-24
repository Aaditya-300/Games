import { io } from 'socket.io-client';

// Same-origin by default: Vite's dev proxy (see vite.config.js) forwards
// /socket.io to the local server, so this works whether accessed via
// localhost or through a tunnel domain. Override with VITE_SERVER_URL
// when the client and server are deployed as separate hosts.
const SERVER_URL = import.meta.env.VITE_SERVER_URL || '/';

const socket = io(SERVER_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
});

export default socket;
