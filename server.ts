import http from 'http';

import { parse } from 'url';

import next from 'next';

import { Server as SocketIOServer } from 'socket.io';

import { addUserSocket, removeUserSocket, setIO } from './src/lib/socket/server';
import { authenticateSocketRequest } from './src/lib/socket/auth';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function startServer() {
  try {
    await app.prepare();

    const server = http.createServer((req, res) => {
      try {
        const parsedUrl = parse(req.url || '/', true);
        handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error occurred handling', req.url, err);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });

    const io = new SocketIOServer(server, {
      path: '/api/socket/io',
      addTrailingSlash: false,
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true
      },
      pingTimeout: 30000,
      pingInterval: 25000
    });

    // Store global io instance for API routes and server services
    setIO(io);

    // Strict server-side authentication middleware
    io.use(async (socket, nextMiddleware) => {
      try {
        const user = await authenticateSocketRequest(socket.request);
        if (!user || !user.sub) {
          return nextMiddleware(new Error('Unauthorized: Invalid or missing session token'));
        }

        const userId = user.id || user.sub;
        socket.data.userId = userId;
        socket.data.user = user;
        nextMiddleware();
      } catch (err) {
        console.error('[Socket.IO] Auth middleware error:', err);
        nextMiddleware(new Error('Unauthorized: Authentication error'));
      }
    });

    io.on('connection', (socket) => {
      const userId = socket.data.userId;
      if (!userId) {
        socket.disconnect(true);
        return;
      }

      addUserSocket(userId, socket.id);
      console.log(`[Socket.IO] User ${userId} connected (socket: ${socket.id})`);

      socket.on('disconnect', () => {
        removeUserSocket(userId, socket.id);
        console.log(`[Socket.IO] User ${userId} disconnected (socket: ${socket.id})`);
      });
    });

    server.listen(port, () => {
      console.log(`> Server ready on http://${hostname}:${port}`);
    });
  } catch (err) {
    console.error('Failed to start custom server:', err);
    process.exit(1);
  }
}

startServer();
