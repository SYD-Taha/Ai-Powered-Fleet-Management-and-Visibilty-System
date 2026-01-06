export interface Vehicle {
  _id?: string;
  id?: string;
  vehicle?: string;        // when populated from GPS or Mongo
  vehicle_id?: string;     // fallback key
  vehicle_number: string;
  type: string;
  status: string;
  speed: number;
  fuelLevel: number;
  latitude?: number;
  longitude?: number;
  routeWaypoints?: [number, number][]; // Array of [lat, lng] pairs for route path
  routeStartTime?: number; // Timestamp when route started
  routeTotalDistance?: number; // Route distance in meters
  routeDuration?: number; // Route duration in seconds
  routeSource?: 'osrm' | 'haversine' | 'backend'; // Source of route calculation
  routeIsFallback?: boolean; // Whether route is a fallback (straight-line)
  x?: number; // Optional for backward compatibility
  y?: number; // Optional for backward compatibility
  targetX?: number;
  targetY?: number;
  teamExpertiseLevel?: number;
  pastPerformance?: number;
  teamFatigueLevel?: number;
  assignedJob?: string | null;
  icon?: React.ElementType;
}


export interface Fault {
  id: string;
  _id?: string;
  latitude?: number;
  longitude?: number;
  x?: number; // Optional for backward compatibility
  y?: number; // Optional for backward compatibility
  severity: string;
  description: string;
  assignedVehicle?: string;
  status: 'waiting' | 'pending_confirmation' | 'assigned' | 'resolved'; // Match backend status values
}

export interface DispatchLog {
  id: string;
  timestamp: string;
  action: string;
  vehicleId: string;
  faultId: string;
  location: string;
  eta: string;
  status: 'success' | 'pending' | 'failed';
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export class AIDispatchService {
  private static instance: AIDispatchService;
  private isActive: boolean = true;
  private dispatchLogs: DispatchLog[] = [];
  private lastDispatchTime: number = 0;
  private readonly DISPATCH_INTERVAL = 2000; // 2 seconds between dispatches

  static getInstance(): AIDispatchService {
    if (!AIDispatchService.instance) {
      AIDispatchService.instance = new AIDispatchService();
    }
    return AIDispatchService.instance;
  }

  private calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }

  private calculateETA(distance: number, speed: number): string {
    if (speed === 0) return "N/A";
    const timeInMinutes = (distance * 0.8) / (speed / 60); // Adjusted for slower speeds
    return `${Math.round(timeInMinutes)} min`;
  }

  private getLocationName(x: number, y: number): string {
    // Map coordinates to Karachi areas
    if (x < 30 && y < 40) return "Gulshan-e-Iqbal";
    if (x > 70 && y < 40) return "DHA Phase II";
    if (x > 60 && y > 60) return "Clifton";
    if (x < 40 && y > 60) return "Korangi";
    if (x > 40 && x < 70 && y > 30 && y < 70) return "Saddar";
    return "Central Karachi";
  }

  private addDispatchLog(vehicleId: string, faultId: string, action: string, eta: string, priority: string, status: 'success' | 'pending' | 'failed' = 'success') {
    // Shorten action message - extract key info only
    let shortAction = action;
    if (action.includes('DISPATCHED:')) {
      const match = action.match(/(\w+) → (\w+)/);
      shortAction = match ? `Dispatch: ${match[1]} → ${match[2]}` : action.split(':')[1]?.trim() || action;
    } else if (action.includes('RESOLVED:')) {
      shortAction = `Resolved: ${faultId}`;
    } else if (action.includes('ARRIVED:')) {
      shortAction = `Arrived: ${vehicleId}`;
    } else if (action.includes('JOB COMPLETE:')) {
      shortAction = `Complete: ${vehicleId}`;
    } else if (action.includes('MANUAL DISPATCH')) {
      const match = action.match(/(\w+) → (\w+)/);
      shortAction = match ? `Manual: ${match[1]} → ${match[2]}` : 'Manual dispatch';
    } else if (action.includes('LOW FUEL:')) {
      shortAction = `Low fuel: ${vehicleId}`;
    } else if (action.includes('STATUS CHANGE:')) {
      shortAction = `Status: ${vehicleId}`;
    } else if (action.includes('AI DISPATCH SYSTEM')) {
      shortAction = action.includes('ACTIVATED') ? 'AI: ON' : 'AI: OFF';
    } else if (action.includes('No available vehicles')) {
      shortAction = `No vehicles: ${faultId}`;
    } else if (action.includes('Vehicle') && action.includes('status changed')) {
      const match = action.match(/Vehicle (\w+)/);
      shortAction = match ? `Status: ${match[1]}` : action;
    } else if (action.includes('Fault') && action.includes('status changed')) {
      shortAction = `Fault: ${faultId}`;
    }

    const log: DispatchLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toLocaleTimeString(),
      action: shortAction,
      vehicleId,
      faultId,
      location: this.getLocationName(Math.random() * 100, Math.random() * 100),
      eta,
      status,
      priority: priority as "critical" | "high" | "medium" | "low"
    };

    this.dispatchLogs.unshift(log);
    if (this.dispatchLogs.length > 20) {
      this.dispatchLogs = this.dispatchLogs.slice(0, 20);
    }
  }

  // Manual dispatch method - DEPRECATED: Backend handles all dispatch logic
  // This method is kept for logging purposes only, but should not be used for actual dispatch
  // All dispatch should go through the backend API which will emit WebSocket events
  manualDispatch(vehicleId: string, faultId: string, vehicles: Vehicle[], faults: Fault[]): { updatedVehicles: Vehicle[], updatedFaults: Fault[] } {
    // Log the dispatch attempt (backend will handle actual dispatch)
    this.addDispatchLog(
      vehicleId,
      faultId,
      `Manual dispatch requested: ${vehicleId} → ${faultId}`,
      'N/A',
      'high',
      'pending'
    );
    
    // Return unchanged state - backend will update via WebSocket
    return { updatedVehicles: vehicles, updatedFaults: faults };
  }

  // Auto-dispatch method - DEPRECATED: Backend handles all auto-dispatch
  // This method is disabled and should not be used
  // Backend automatically dispatches when faults are created and runs periodic dispatch
  autoDispatch(vehicles: Vehicle[], faults: Fault[]): { updatedVehicles: Vehicle[], updatedFaults: Fault[] } {
    // DISABLED: Backend handles all dispatch logic
    // Frontend should only display state, not make dispatch decisions
    // Return unchanged state - backend will update via WebSocket events
    return { updatedVehicles: vehicles, updatedFaults: faults };
  }

  getDispatchLogs(): DispatchLog[] {
    return this.dispatchLogs;
  }

  isAIActive(): boolean {
    return this.isActive;
  }

  toggleAI(): void {
    this.isActive = !this.isActive;
    this.addDispatchLog(
      'SYSTEM',
      'N/A',
      this.isActive ? 'AI: ON' : 'AI: OFF',
      'N/A',
      this.isActive ? 'high' : 'medium',
      this.isActive ? 'success' : 'pending'
    );
  }
}
