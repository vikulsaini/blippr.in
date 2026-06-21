import { socketAuth } from './auth.socket.js';

export function registerSockets(io) {
  io.use(socketAuth);

  io.use(async (socket, next) => {
    try {
      const userId = socket.user?._id?.toString();
      if (userId) {
        const activeSockets = await io.in(`user:${userId}`).fetchSockets();
        if (activeSockets.length >= 5) {
          return next(new Error('Connection limit exceeded. Please close some tabs.'));
        }
      }
      next();
    } catch (err) {
      next(err);
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    socket.join(`user:${userId}`);
  });
}
