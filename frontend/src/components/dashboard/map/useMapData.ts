import { useState, useEffect, useRef } from "react";
import { Vehicle, Fault, AIDispatchService } from "@/services/aiDispatchService";
import { Truck } from "lucide-react";
import { faultTypes, karachiAreas } from "./mapConfig";
import { calculateRoute } from "@/services/routeService";
import { sendGPSUpdate, calculateCurrentPosition } from "@/services/gpsSimulationService";
import { getVehicles, getVehicleLocation, getFaults } from "@/services/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import { 
  generateRandomKarachiCoordinates, 
  calculateHaversineDistance,
  calculatePositionAlongRoute,
  KARACHI_CENTER
} from "./coordinateUtils";

interface UseMapDataProps {
  isPlaying: boolean;
  speed: number;
  onDataUpdate: (vehicles: Vehicle[], faults: Fault[]) => void;
}

export const useMapData = ({ isPlaying, speed, onDataUpdate }: UseMapDataProps) => {
  const aiDispatch = AIDispatchService.getInstance();
  const gpsUpdateIntervalRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const errorCountRef = useRef(0);
  
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [faults, setFaults] = useState<Fault[]>([]);
  const [lastFaultTime, setLastFaultTime] = useState(Date.now());

  // Refs to access current state in async callbacks (WebSocket handlers)
  const vehiclesRef = useRef<Vehicle[]>([]);
  const faultsRef = useRef<Fault[]>([]);

  // Keep refs in sync with state
  useEffect(() => {
    vehiclesRef.current = vehicles;
    faultsRef.current = faults;
  }, [vehicles, faults]);

  // WebSocket integration for real-time updates
  const { isConnected } = useWebSocket({
    onVehicleGPSUpdate: (data) => {
      setVehicles(prev => prev.map(v => {
        const vehicleId = v._id || v.id;
        if (vehicleId === data.vehicleId || vehicleId?.toString() === data.vehicleId) {
          // If vehicle has an active route, let the animation loop handle position updates
          // Only update speed from GPS, not position (prevents "jumping" every 3 seconds)
          if (v.routeWaypoints && v.routeStartTime && v.routeTotalDistance) {
            // Vehicle is on a route - animation loop handles smooth position updates
            // Only update speed from GPS data
            return {
              ...v,
              speed: data.speed || v.speed
            };
          }
          
          // Vehicle is not on a route - update position from GPS (for stationary vehicles)
          return {
            ...v,
            latitude: data.latitude,
            longitude: data.longitude,
            speed: data.speed || v.speed
          };
        }
        return v;
      }));
    },
    onVehicleStatusChange: (data) => {
      setVehicles(prev => prev.map(v => {
        const vehicleId = v._id || v.id;
        if (vehicleId === data.vehicleId || vehicleId?.toString() === data.vehicleId) {
          const newStatus = mapStatus(data.status) as any;
          
          // If status changed to 'onRoute' and vehicle has assignedJob but no route, calculate it
          if (newStatus === 'onRoute' && v.assignedJob && !v.routeWaypoints) {
            // Get fault from current state
            const fault = faultsRef.current.find(f => 
              (f.id || f._id)?.toString() === v.assignedJob
            );
            
            if (fault && fault.latitude && fault.longitude && v.latitude && v.longitude) {
              // Calculate route asynchronously
              handleDispatchRoute(vehicleId.toString(), v.assignedJob);
            }
          }

          // Clear route data if status changed to 'available' and clearRoute flag is set
          // This handles stuck vehicle resets from the backend
          const shouldClearRoute = newStatus === 'available' && 
                                   (data.updatedFields?.clearRoute || !v.assignedJob);
          
          if (shouldClearRoute) {
            return {
              ...v,
              status: newStatus,
              routeWaypoints: undefined,
              routeStartTime: undefined,
              routeTotalDistance: undefined,
              assignedJob: v.assignedJob || null
            };
          }

          return {
            ...v,
            status: newStatus
          };
        }
        return v;
      }));
    },
    onVehicleArrived: (data) => {
      setVehicles(prev => prev.map(v => {
        const vehicleId = v._id || v.id;
        if (vehicleId === data.vehicleId || vehicleId?.toString() === data.vehicleId) {
          return {
            ...v,
            status: 'working' as const
          };
        }
        return v;
      }));
    },
    onRouteUpdated: (data) => {
      // Update vehicle route when backend recalculates it
      // IMPORTANT: Use routeStartTime if provided (current time), otherwise fallback to calculatedAt
      // This ensures animation starts from NOW when route is recalculated, not from original calculation time
      const routeStartTime = data.route.routeStartTime || data.route.calculatedAt || Date.now();
      setVehicles(prev => prev.map(v => {
        const vehicleId = v._id || v.id;
        if (vehicleId === data.vehicleId || vehicleId?.toString() === data.vehicleId) {
          return {
            ...v,
            routeWaypoints: data.route.waypoints,
            routeStartTime: routeStartTime, // Use routeStartTime from backend (current time on recalculation)
            routeTotalDistance: data.route.distance,
            routeDuration: data.route.duration,
            routeSource: data.route.source as 'osrm' | 'haversine' | 'backend',
            routeIsFallback: data.route.isFallback || false
          };
        }
        return v;
      }));
    },
    onFaultCreated: (data) => {
      const fault = data.fault;
      const newFault: Fault = {
        id: fault._id,
        _id: fault._id,
        latitude: fault.latitude || KARACHI_CENTER[0],
        longitude: fault.longitude || KARACHI_CENTER[1],
        severity: fault.category === 'High' ? 'critical' : 
                 fault.category === 'Medium' ? 'medium' : 'low',
        description: fault.detail || `${fault.fault_type} at ${fault.fault_location}`,
        // Map backend fault status to frontend display
        status: fault.status === 'waiting' ? 'waiting' : 
               fault.status === 'pending_confirmation' ? 'pending_confirmation' :
               fault.status === 'assigned' ? 'assigned' : 
               fault.status === 'resolved' ? 'resolved' : 'waiting',
        assignedVehicle: fault.assigned_vehicle
      };
      setFaults(prev => [...prev, newFault]);
    },
    onFaultUpdated: (data) => {
      const previousFault = faultsRef.current.find(f => 
        f.id === data.fault._id || f._id === data.fault._id
      );
      const wasAssigned = previousFault?.assignedVehicle;
      const isNowAssigned = data.fault.assigned_vehicle;

      // Update fault
      setFaults(prev => prev.map(f => {
        if (f.id === data.fault._id || f._id === data.fault._id) {
          return {
            ...f,
            // Map backend fault status to frontend display
            status: data.fault.status === 'waiting' ? 'waiting' : 
                   data.fault.status === 'pending_confirmation' ? 'pending_confirmation' :
                   data.fault.status === 'assigned' ? 'assigned' : 
                   data.fault.status === 'resolved' ? 'resolved' : f.status,
            assignedVehicle: data.fault.assigned_vehicle || f.assignedVehicle,
            latitude: data.fault.latitude || f.latitude,
            longitude: data.fault.longitude || f.longitude
          };
        }
        return f;
      }));

      // If fault was just assigned to a vehicle (new assignment), calculate route
      if (isNowAssigned && (!wasAssigned || wasAssigned !== isNowAssigned)) {
        const vehicleId = isNowAssigned.toString();
        const faultId = data.fault._id.toString();
        
        // Check if vehicle already has a route for this fault
        const vehicle = vehiclesRef.current.find(v => {
          const vid = (v._id || v.id)?.toString();
          return vid === vehicleId;
        });

        if (vehicle && (!vehicle.routeWaypoints || vehicle.assignedJob !== faultId)) {
          handleDispatchRoute(vehicleId, faultId);
        }
      }
    },
    onFaultDispatched: (data) => {
      // Update fault status
      setFaults(prev => prev.map(f => {
        if (f.id === data.faultId || f._id === data.faultId) {
          return {
            ...f,
            status: 'assigned' as const,
            assignedVehicle: data.vehicleId,
            // Update coordinates if provided in event
            latitude: data.faultLatitude || f.latitude,
            longitude: data.faultLongitude || f.longitude
          };
        }
        return f;
      }));

      // Use route from backend if available, otherwise calculate on frontend
      if (data.route && data.route.waypoints) {
        // Backend calculated route - use it directly
        setVehicles(prev => prev.map(v => {
          const vehicleId = v._id || v.id;
          if (vehicleId === data.vehicleId || vehicleId?.toString() === data.vehicleId) {
            const updated = {
              ...v,
              status: 'onRoute' as const,
              assignedJob: data.faultId,
              routeWaypoints: data.route.waypoints,
              routeStartTime: data.route.calculatedAt || Date.now(),
              routeTotalDistance: data.route.distance,
              routeDuration: data.route.duration, // Add route duration for ETA calculation
              routeSource: (data.route.source === 'osrm' || data.route.source === 'haversine') ? data.route.source : 'backend' as 'osrm' | 'haversine' | 'backend',
              routeIsFallback: data.route.isFallback || false,
              latitude: data.vehicleLatitude || v.latitude,
              longitude: data.vehicleLongitude || v.longitude
            };
            return updated;
          }
          return v;
        }));
        
        console.log(`✅ Using backend-calculated route for vehicle ${data.vehicleId}`, {
          waypoints: data.route.waypoints.length,
          distance: data.route.distance,
          duration: data.route.duration,
          source: data.route.source
        });
      } else {
        // Fallback: Calculate route on frontend if backend didn't provide one
        console.warn('No route in dispatch event, calculating on frontend', {
          vehicleId: data.vehicleId,
          faultId: data.faultId
        });
        handleDispatchRoute(data.vehicleId, data.faultId, {
          vehicleLatitude: data.vehicleLatitude,
          vehicleLongitude: data.vehicleLongitude,
          faultLatitude: data.faultLatitude,
          faultLongitude: data.faultLongitude
        });
      }
    },
    onVehicleConfirmation: (data) => {
      setVehicles(prev => prev.map(v => {
        const vehicleId = v._id || v.id;
        if (vehicleId === data.vehicleId || vehicleId?.toString() === data.vehicleId) {
          return {
            ...v,
            status: 'working' as const
          };
        }
        return v;
      }));
    },
    onVehicleResolved: (data) => {
      setVehicles(prev => prev.map(v => {
        const vehicleId = v._id || v.id;
        if (vehicleId === data.vehicleId || vehicleId?.toString() === data.vehicleId) {
          // Clear GPS update interval for this vehicle
          const intervalId = gpsUpdateIntervalRef.current.get(v.id);
          if (intervalId) {
            clearInterval(intervalId);
            gpsUpdateIntervalRef.current.delete(v.id);
          }
          
          return {
            ...v,
            status: 'available' as const,
            assignedJob: null,
            routeWaypoints: undefined,
            routeStartTime: undefined,
            routeTotalDistance: undefined
          };
        }
        return v;
      }));
    }
  });

  // Map backend status to frontend status
  // Use backend status values directly - no mapping needed
  // Frontend should use same status values as backend for consistency
  const mapStatus = (backendStatus: string): string => {
    const statusMap: Record<string, string> = {
      'available': 'available',
      'idle': 'available', // Convert idle to available in prototype mode
      'onRoute': 'onRoute', // Use backend status directly
      'working': 'working',
    };
    return statusMap[backendStatus] || 'available';
  };

  // Helper function to calculate route and update vehicle when dispatched
  // Optionally accepts coordinates from WebSocket event for more reliable route calculation
  const handleDispatchRoute = async (
    vehicleId: string, 
    faultId: string,
    eventCoordinates?: {
      vehicleLatitude?: number;
      vehicleLongitude?: number;
      faultLatitude?: number;
      faultLongitude?: number;
    }
  ) => {
    // Get current state from refs (avoids stale closure issues)
    const currentVehicles = vehiclesRef.current;
    const currentFaults = faultsRef.current;

    // Find vehicle and fault
    const vehicle = currentVehicles.find(v => {
      const vid = (v._id || v.id)?.toString();
      return vid === vehicleId;
    });

    const fault = currentFaults.find(f => {
      const fid = (f.id || f._id)?.toString();
      return fid === faultId;
    });

    // Validate we have vehicle
    if (!vehicle) {
      console.warn('Cannot calculate route: vehicle not found', vehicleId);
      return;
    }

    // Use coordinates from event if available, otherwise from state
    const vehicleLat = eventCoordinates?.vehicleLatitude ?? vehicle.latitude;
    const vehicleLng = eventCoordinates?.vehicleLongitude ?? vehicle.longitude;
    const faultLat = eventCoordinates?.faultLatitude ?? fault?.latitude;
    const faultLng = eventCoordinates?.faultLongitude ?? fault?.longitude;

    // Validate we have all required coordinates
    if (!vehicleLat || !vehicleLng) {
      console.warn('Cannot calculate route: vehicle missing coordinates', vehicleId);
      // Still update vehicle status even without route
      setVehicles(prev => prev.map(v => {
        const vid = (v._id || v.id)?.toString();
        if (vid === vehicleId) {
          return {
            ...v,
                status: 'onRoute' as const,
            assignedJob: faultId
          };
        }
        return v;
      }));
      return;
    }

    if (!faultLat || !faultLng) {
      console.warn('Cannot calculate route: fault missing coordinates', faultId);
      // Still update vehicle status even without route
      setVehicles(prev => prev.map(v => {
        const vid = (v._id || v.id)?.toString();
        if (vid === vehicleId) {
          return {
            ...v,
                status: 'onRoute' as const,
            assignedJob: faultId
          };
        }
        return v;
      }));
      return;
    }

    // Check if vehicle already has a route (prevent duplicate calculations)
    if (vehicle.routeWaypoints && vehicle.assignedJob === faultId) {
      console.log('Vehicle already has route for this fault, skipping calculation');
      return;
    }

    try {
      // Calculate route from vehicle to fault
      const route = await calculateRoute(
        vehicleLat,
        vehicleLng,
        faultLat,
        faultLng
      );

      // Update vehicle with route and status
      setVehicles(prev => prev.map(v => {
        const vid = (v._id || v.id)?.toString();
        if (vid === vehicleId) {
          return {
            ...v,
                status: 'onRoute' as const,
            assignedJob: faultId,
            routeWaypoints: route.waypoints,
            routeStartTime: Date.now(),
            routeTotalDistance: route.distance,
            routeDuration: route.duration,
            routeSource: route.source || 'osrm',
            routeIsFallback: route.isFallback || false
          };
        }
        return v;
      }));

      console.log(`✅ Route calculated for vehicle ${vehicleId} to fault ${faultId}`, {
        waypoints: route.waypoints.length,
        distance: route.distance,
        duration: route.duration
      });
    } catch (error) {
      console.error('Error calculating route for dispatch:', error);
      // Still update vehicle status even if route calculation fails
      setVehicles(prev => prev.map(v => {
        const vid = (v._id || v.id)?.toString();
        if (vid === vehicleId) {
          return {
            ...v,
                status: 'onRoute' as const,
            assignedJob: faultId
          };
        }
        return v;
      }));
    }
  };

  // Fetch vehicles from backend and initialize with GPS or random coordinates
  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        // Use API service instead of direct fetch
        const data = await getVehicles();

        const initializedVehicles = await Promise.all(
          data.map(async (v: any) => {
            // Get vehicle ID
            const vehicleId = v._id || v.id || `vehicle-${v.vehicle_number}`;
            
            // Get GPS coordinates (from vehicle data or fetch separately)
            let lat = v.latitude;
            let lng = v.longitude;
            let speed = v.speed;

            // If no GPS data in vehicle response, try to get latest GPS
            if (!lat || !lng) {
              try {
                const gps = await getVehicleLocation(vehicleId);
                if (gps) {
                  lat = gps.latitude;
                  lng = gps.longitude;
                  speed = gps.speed || speed;
                }
              } catch (err) {
                console.warn(`Could not fetch GPS for vehicle ${vehicleId}:`, err);
              }
            }

            // If still no coordinates, use default Karachi center (deterministic)
            // This ensures vehicles without GPS always spawn in the same location
            // GPS updates will save their actual position once they start moving
            if (!lat || !lng) {
              // Use default Karachi center instead of random coordinates
              // This ensures vehicles spawn in the same place every time
              lat = KARACHI_CENTER[0];
              lng = KARACHI_CENTER[1];
              
              // Only send GPS update if we have a valid MongoDB ObjectId
              // Skip if vehicleId is a fallback string like "vehicle-V001"
              const isValidObjectId = vehicleId && /^[0-9a-fA-F]{24}$/.test(vehicleId);
              if (isValidObjectId) {
                try {
                  await sendGPSUpdate(vehicleId, lat, lng, speed || 15);
                } catch (err) {
                  console.warn(`Failed to save default GPS for vehicle ${vehicleId}:`, err);
                }
              }
            }

            // Map backend vehicle to frontend Vehicle interface with defaults
            return {
              _id: v._id,
              id: vehicleId,
              vehicle_number: v.vehicle_number ?? "N/A",
              type: v.type || 'maintenance', // Default type
              status: mapStatus(v.status || 'available'), // Map backend status to frontend
              speed: speed || 15, // Default speed
              fuelLevel: v.fuelLevel || 80, // Default fuel level
              latitude: lat,
              longitude: lng,
              icon: Truck,
              // Default team metrics
              teamExpertiseLevel: v.teamExpertiseLevel || 5,
              pastPerformance: v.pastPerformance || 75,
              teamFatigueLevel: v.teamFatigueLevel || 3,
              // Optional fields
              assignedJob: v.assignedJob || null,
              routeWaypoints: v.routeWaypoints,
              routeStartTime: v.routeStartTime,
              routeTotalDistance: v.routeTotalDistance,
            } as Vehicle;
          })
        );

        // Ensure all vehicles are loaded (no filtering)
        setVehicles(initializedVehicles);
      } catch (err) {
        console.error("❌ Error fetching vehicles:", err);
        // Don't create mock vehicles - let the API handle it
      }
    };

    fetchVehicles();
  }, []);

  // Fetch faults from backend
  useEffect(() => {
    const fetchFaults = async () => {
      try {
        const data = await getFaults();
        
        // Validate response is an array before processing
        if (!Array.isArray(data)) {
          console.warn("⚠️ Faults API returned non-array response:", data);
          // Don't update state if response is invalid - keep existing faults
          return;
        }

        // If empty array, that's valid - just clear faults
        if (data.length === 0) {
          setFaults([]);
          return;
        }

        const mappedFaults: Fault[] = data.map((f) => {
          // Map backend fault to frontend fault format
          let lat = f.latitude;
          let lng = f.longitude;

          // If no coordinates, use Karachi center as fallback
          if (!lat || !lng) {
            lat = KARACHI_CENTER[0];
            lng = KARACHI_CENTER[1];
          }

          // Map category to severity - ensure consistency
          const severityMap: Record<string, string> = {
            High: 'critical', // Map High to critical for consistency
            Medium: 'medium',
            Low: 'low',
          };

          // Also check if severity is already set (for backward compatibility)
          const severity = f.severity || severityMap[f.category] || 'medium';

          return {
            id: f._id || f.id || `fault-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            _id: f._id,
            latitude: lat,
            longitude: lng,
            severity: severity,
            description: f.detail || `${f.fault_type} at ${f.fault_location}`,
            // Map backend fault status to frontend display
            status: f.status === 'waiting' ? 'waiting' : 
                   f.status === 'pending_confirmation' ? 'pending_confirmation' :
                   f.status === 'assigned' ? 'assigned' : 
                   f.status === 'resolved' ? 'resolved' : 'waiting',
            assignedVehicle: f.assigned_vehicle?.id || f.assigned_vehicle?._id,
          };
        });

        // Merge with existing faults to preserve resolved ones that might not be in backend
        setFaults(prev => {
          const existingMap = new Map(prev.map(f => [f.id, f]));
          const newFaults = mappedFaults.map(f => {
            const existing = existingMap.get(f.id);
            // Preserve resolved status if fault was resolved locally
            if (existing && existing.status === 'resolved' && f.status !== 'resolved') {
              return existing;
            }
            return f;
          });
          // Add any resolved faults that are no longer in backend but should still show
          prev.forEach(f => {
            if (f.status === 'resolved' && !newFaults.find(nf => nf.id === f.id)) {
              // Keep resolved faults for a bit longer (5 minutes)
              const resolvedTime = f._id ? parseInt(f._id.split('-')[1]) || 0 : 0;
              if (Date.now() - resolvedTime < 300000) {
                newFaults.push(f);
              }
            }
          });
          return newFaults;
        });
      } catch (err) {
        // Log error but don't throw - allow app to continue functioning
        console.error("❌ Error fetching faults:", err);
        // Don't clear existing faults state on error - preserve UI functionality
      }
    };

    fetchFaults();
    
    // Smart polling: only poll when tab is visible, with exponential backoff on errors
    const baseInterval = 10000; // 10 seconds
    
    const pollFaults = async () => {
      // Only poll if tab is visible
      if (document.visibilityState === 'visible') {
        try {
          await fetchFaults();
          errorCountRef.current = 0; // Reset error count on success
        } catch (err) {
          errorCountRef.current++;
          // Exponential backoff: 10s, 20s, 40s, max 60s
          const backoffInterval = Math.min(baseInterval * Math.pow(2, errorCountRef.current - 1), 60000);
          console.warn(`Fault polling error (attempt ${errorCountRef.current}), backing off to ${backoffInterval}ms`);
          
          // Restart polling with backoff interval
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }
          pollingIntervalRef.current = setInterval(pollFaults, backoffInterval);
        }
      }
    };
    
    // Start polling with base interval
    pollingIntervalRef.current = setInterval(pollFaults, baseInterval);
    
    // Listen for visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Immediately fetch when tab becomes visible
        fetchFaults();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    onDataUpdate(vehicles, faults);
  }, [vehicles, faults, onDataUpdate]);

  const findNearestVehicle = (faultLat: number, faultLng: number, availableVehicles: Vehicle[]) => {
    let nearestVehicle = null;
    let minDistance = Infinity;

    for (const vehicle of availableVehicles) {
      if (!vehicle.latitude || !vehicle.longitude) continue;
      const distance = calculateHaversineDistance(
        vehicle.latitude,
        vehicle.longitude,
        faultLat,
        faultLng
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearestVehicle = vehicle;
      }
    }

    return nearestVehicle;
  };

  const handleManualDispatch = async (vehicleId: string, faultId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    const fault = faults.find(f => f.id === faultId);
    
    if (!vehicle || !fault) {
      console.error("Cannot dispatch: vehicle or fault not found");
      return;
    }

    try {
      // Call backend dispatch API
      // The backend will handle the dispatch logic and emit WebSocket events
      // Frontend will update via WebSocket handlers (onFaultDispatched, etc.)
      const { runDispatchEngine } = await import('@/services/api');
      await runDispatchEngine();
      
      console.log(`Manual dispatch triggered: Backend will process fault ${faultId}`);
      // Note: State updates will come via WebSocket events from backend
    } catch (error) {
      console.error("Error calling dispatch API:", error);
      // Show error to user if needed
    }
  };

  // Animation loop - update vehicle positions along routes
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      const currentTime = Date.now();
      
      // Update vehicle positions along routes
      setVehicles(prevVehicles => {
        const updatedVehicles = prevVehicles.map(vehicle => {
          // If vehicle has a route, update position along route
          if (vehicle.routeWaypoints && vehicle.routeStartTime && vehicle.routeTotalDistance) {
            const currentPos = calculatePositionAlongRoute(
              vehicle.routeWaypoints,
              vehicle.routeStartTime,
              vehicle.routeTotalDistance,
              16.67 // 60 km/h = 16.67 m/s for faster movement
            );

            if (currentPos) {
              const [lat, lng] = currentPos;
              
              // Check if we've reached the destination
              const destination = vehicle.routeWaypoints[vehicle.routeWaypoints.length - 1];
              const distanceToDest = calculateHaversineDistance(
                lat,
                lng,
                destination[0],
                destination[1]
              );

              if (distanceToDest < 50) { // Within 50 meters
                // Stop GPS updates for this vehicle when it reaches destination
                const intervalId = gpsUpdateIntervalRef.current.get(vehicle.id);
                if (intervalId) {
                  clearInterval(intervalId);
                  gpsUpdateIntervalRef.current.delete(vehicle.id);
                }
                
                // If vehicle is available and has no assigned job, clear the route
                // This handles the case where a vehicle reaches a destination but
                // the fault was already resolved or the vehicle was reset
                if (vehicle.status === 'available' && !vehicle.assignedJob) {
                  return {
                    ...vehicle,
                    status: 'available' as const,
                    latitude: destination[0],
                    longitude: destination[1],
                    speed: 0,
                    routeWaypoints: undefined,
                    routeStartTime: undefined,
                    routeTotalDistance: undefined,
                    assignedJob: null
                  };
                }
                
                return {
                  ...vehicle,
                  status: 'working' as const,
                  latitude: destination[0],
                  longitude: destination[1],
                  speed: 0,
                };
              }

              return {
                ...vehicle,
                latitude: lat,
                longitude: lng,
                status: 'onRoute' as const,
              };
            }
          }
          
          // Handle available vehicles without routes
          // If vehicle is available but has stale route data, clear it
          // This prevents vehicles from appearing to go to old destinations
          if (vehicle.status === 'available' && !vehicle.assignedJob) {
            if (vehicle.routeWaypoints || vehicle.routeStartTime || vehicle.routeTotalDistance) {
              return {
                ...vehicle,
                routeWaypoints: undefined,
                routeStartTime: undefined,
                routeTotalDistance: undefined,
                assignedJob: null
              };
            }
          }
          
          return vehicle;
        });
        
        return updatedVehicles;
      });
    }, 100); // Update every 100ms for smooth animation

    return () => clearInterval(interval);
  }, [isPlaying, speed, aiDispatch]);

  // Send GPS updates for ALL vehicles (not just those on routes)
  // This ensures positions are persisted even when vehicles are stationary
  useEffect(() => {
    vehicles.forEach(vehicle => {
      // Send GPS updates for all vehicles with valid coordinates
      if (vehicle.latitude && vehicle.longitude) {
        // Clear existing interval if any
        const existingInterval = gpsUpdateIntervalRef.current.get(vehicle.id);
        if (existingInterval) {
          clearInterval(existingInterval);
        }

        // Set up GPS update interval (every 5 seconds for all vehicles)
        // More frequent (2.5s) for vehicles on routes, less frequent (5s) for stationary
        const updateInterval = (vehicle.routeWaypoints && vehicle.routeStartTime && vehicle.routeTotalDistance) ? 2500 : 5000;
        
        const intervalId = setInterval(() => {
          if (vehicle.latitude && vehicle.longitude) {
            // Ensure we have a valid MongoDB ObjectId before sending
            const vehicleId = vehicle._id || vehicle.id;
            // Validate ObjectId format (24 hex characters)
            const isValidObjectId = vehicleId && /^[0-9a-fA-F]{24}$/.test(vehicleId);
            if (isValidObjectId) {
              sendGPSUpdate(
                vehicleId,
                vehicle.latitude,
                vehicle.longitude,
                vehicle.speed || 40
              );
            }
          }
        }, updateInterval);

        gpsUpdateIntervalRef.current.set(vehicle.id, intervalId);
      } else {
        // Clear interval if vehicle has no coordinates
        const intervalId = gpsUpdateIntervalRef.current.get(vehicle.id);
        if (intervalId) {
          clearInterval(intervalId);
          gpsUpdateIntervalRef.current.delete(vehicle.id);
        }
      }
    });

    // Cleanup on unmount
    return () => {
      gpsUpdateIntervalRef.current.forEach(intervalId => clearInterval(intervalId));
      gpsUpdateIntervalRef.current.clear();
    };
  }, [vehicles]);

  return {
    vehicles,
    faults,
    shufflePositions: () => {}, // No longer needed with real coordinates
    handleManualDispatch
  };
};
