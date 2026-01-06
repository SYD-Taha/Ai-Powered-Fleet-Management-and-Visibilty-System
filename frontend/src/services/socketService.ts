import { io, Socket } from 'socket.io-client';

// Get WebSocket URL from environment or use default
const getSocketURL = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;
  
  // If no env URL, use localhost
  if (!envUrl) {
    return 'http://localhost:5000';
  }
  
  // If URL contains Docker service name, replace with localhost
  if (envUrl.includes('backend:') || envUrl.includes('backend/')) {
    return envUrl.replace(/http:\/\/backend(:\d+)?/, 'http://localhost$1');
  }
  
  return envUrl;
};

let socket: Socket | null = null;

/**
 * Initialize Socket.io client connection
 * @returns {Socket} Socket.io client instance
 */
export const initializeSocket = (): Socket => {
  if (socket?.connected) {
    return socket;
  }

  const socketURL = getSocketURL();
  
  socket = io(socketURL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    timeout: 20000,
  });

  socket.on('connect', () => {
    console.log('✅ WebSocket connected', { socketId: socket?.id });
  });

  socket.on('disconnect', (reason) => {
    console.warn('⚠️ WebSocket disconnected', { reason });
  });

  socket.on('connect_error', (error) => {
    console.error('❌ WebSocket connection error', error);
  });

  socket.on('reconnect', (attemptNumber) => {
    console.log('🔄 WebSocket reconnected', { attemptNumber });
  });

  socket.on('reconnect_error', (error) => {
    console.error('❌ WebSocket reconnection error', error);
  });

  socket.on('reconnect_failed', () => {
    console.error('❌ WebSocket reconnection failed');
  });

  return socket;
};

/**
 * Get Socket.io client instance
 * @returns {Socket|null} Socket.io client instance or null if not initialized
 */
export const getSocket = (): Socket | null => {
  if (!socket) {
    socket = initializeSocket();
  }
  return socket;
};

/**
 * Disconnect Socket.io client
 */
export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log('🔌 WebSocket disconnected');
  }
};

export default { initializeSocket, getSocket, disconnectSocket };

