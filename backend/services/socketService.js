import { Server } from 'socket.io';
import logger from './logger.js';

let io = null;

/**
 * Initialize Socket.io server
 * @param {http.Server} httpServer - HTTP server instance
 * @returns {Server} Socket.io server instance
 */
export const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  io.on('connection', (socket) => {
    logger.info('WebSocket client connected', { socketId: socket.id });

    socket.on('disconnect', (reason) => {
      logger.info('WebSocket client disconnected', { socketId: socket.id, reason });
    });

    socket.on('error', (error) => {
      logger.error('WebSocket error', { socketId: socket.id, error: error.message });
    });
  });

  logger.info('Socket.io server initialized');
  return io;
};

/**
 * Get Socket.io instance
 * @returns {Server|null} Socket.io server instance
 */
export const getIO = () => {
  if (!io) {
    logger.warn('Socket.io not initialized. Call initializeSocket first.');
  }
  return io;
};

/**
 * Emit event to all connected clients
 * @param {string} event - Event name
 * @param {any} data - Event data
 */
export const emitToAll = (event, data) => {
  if (io) {
    io.emit(event, data);
    logger.debug('Emitted event to all clients', { event, dataKeys: Object.keys(data || {}) });
  } else {
    logger.warn('Cannot emit event: Socket.io not initialized', { event });
  }
};

/**
 * Emit event to specific room
 * @param {string} room - Room name
 * @param {string} event - Event name
 * @param {any} data - Event data
 */
export const emitToRoom = (room, event, data) => {
  if (io) {
    io.to(room).emit(event, data);
    logger.debug('Emitted event to room', { room, event, dataKeys: Object.keys(data || {}) });
  } else {
    logger.warn('Cannot emit event: Socket.io not initialized', { room, event });
  }
};

export default { initializeSocket, getIO, emitToAll, emitToRoom };

