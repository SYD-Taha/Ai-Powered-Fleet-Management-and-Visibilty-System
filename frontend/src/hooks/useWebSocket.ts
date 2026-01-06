import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket, disconnectSocket } from '../services/socketService';

interface UseWebSocketOptions {
  onVehicleGPSUpdate?: (data: {
    vehicleId: string;
    latitude: number;
    longitude: number;
    speed: number;
    timestamp: Date;
  }) => void;
  onVehicleStatusChange?: (data: {
    vehicleId: string;
    status: string;
    updatedFields?: any;
  }) => void;
  onVehicleUpdate?: (data: {
    vehicleId: string;
    vehicle: any;
    updatedFields?: any;
  }) => void;
  onFaultCreated?: (data: { fault: any }) => void;
  onFaultUpdated?: (data: { fault: any }) => void;
  onFaultDispatched?: (data: {
    faultId: string;
    vehicleId: string;
    vehicleNumber: string;
    status: string;
    faultLatitude?: number;
    faultLongitude?: number;
    vehicleLatitude?: number;
    vehicleLongitude?: number;
    route?: {
      waypoints: [number, number][];
      distance: number;
      duration: number;
      isFallback?: boolean;
      calculatedAt?: number;
      source?: 'osrm' | 'haversine';
    } | null;
  }) => void;
  onDispatchComplete?: (data: {
    faultId: string;
    vehicleId: string;
    vehicleNumber: string;
    dispatchResult: any;
  }) => void;
  onVehicleConfirmation?: (data: {
    vehicleId: string;
    vehicleNumber: string;
    faultId: string;
    status: string;
  }) => void;
  onVehicleResolved?: (data: {
    vehicleId: string;
    vehicleNumber: string;
    faultId: string;
    status: string;
  }) => void;
  onVehicleArrived?: (data: {
    vehicleId: string;
    faultId: string;
    status: string;
  }) => void;
  onRouteUpdated?: (data: {
    vehicleId: string;
    faultId: string;
    route: {
      waypoints: [number, number][];
      distance: number;
      duration: number;
      isFallback?: boolean;
      calculatedAt?: number;
      routeStartTime?: number; // Current time when route update happens (for recalculation)
      source?: 'osrm' | 'haversine';
    };
  }) => void;
}

interface UseWebSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
}

export const useWebSocket = (options: UseWebSocketOptions = {}): UseWebSocketReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const optionsRef = useRef(options);

  // Update options ref when options change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      return;
    }

    const socket = getSocket();
    if (!socket) {
      console.error('Failed to initialize WebSocket');
      return;
    }

    socketRef.current = socket;

    // Connection status handlers
    socket.on('connect', () => {
      setIsConnected(true);
      console.log('✅ WebSocket connected in hook');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('⚠️ WebSocket disconnected in hook');
    });

    // Event handlers
    if (optionsRef.current.onVehicleGPSUpdate) {
      socket.on('vehicle:gps-update', (data) => {
        optionsRef.current.onVehicleGPSUpdate?.(data);
      });
    }

    if (optionsRef.current.onVehicleStatusChange) {
      socket.on('vehicle:status-change', (data) => {
        optionsRef.current.onVehicleStatusChange?.(data);
      });
    }

    if (optionsRef.current.onVehicleUpdate) {
      socket.on('vehicle:update', (data) => {
        optionsRef.current.onVehicleUpdate?.(data);
      });
    }

    if (optionsRef.current.onFaultCreated) {
      socket.on('fault:created', (data) => {
        optionsRef.current.onFaultCreated?.(data);
      });
    }

    if (optionsRef.current.onFaultUpdated) {
      socket.on('fault:updated', (data) => {
        optionsRef.current.onFaultUpdated?.(data);
      });
    }

    if (optionsRef.current.onFaultDispatched) {
      socket.on('fault:dispatched', (data) => {
        optionsRef.current.onFaultDispatched?.(data);
      });
    }

    if (optionsRef.current.onDispatchComplete) {
      socket.on('dispatch:complete', (data) => {
        optionsRef.current.onDispatchComplete?.(data);
      });
    }

    if (optionsRef.current.onVehicleConfirmation) {
      socket.on('vehicle:confirmation', (data) => {
        optionsRef.current.onVehicleConfirmation?.(data);
      });
    }

    if (optionsRef.current.onVehicleResolved) {
      socket.on('vehicle:resolved', (data) => {
        optionsRef.current.onVehicleResolved?.(data);
      });
    }

    if (optionsRef.current.onVehicleArrived) {
      socket.on('vehicle:arrived', (data) => {
        optionsRef.current.onVehicleArrived?.(data);
      });
    }

    if (optionsRef.current.onRouteUpdated) {
      socket.on('route:updated', (data) => {
        optionsRef.current.onRouteUpdated?.(data);
      });
    }

    // Set initial connection status
    setIsConnected(socket.connected);
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current = null;
    }
    disconnectSocket();
    setIsConnected(false);
  }, []);

  // Connect on mount
  useEffect(() => {
    connect();

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
      }
    };
  }, [connect]);

  return {
    socket: socketRef.current,
    isConnected,
    connect,
    disconnect,
  };
};

