
import { HoverCard, HoverCardContent, HoverCardTrigger, HoverCardPortal } from "@/components/ui/hover-card";
import { Zap, MapPin, Truck } from "lucide-react";
import { Vehicle, Fault } from "@/services/aiDispatchService";
import { getFaultSeverityColor } from "./mapUtils";
import { VehicleSelector } from "../VehicleSelector";
import { AIDispatchService } from "@/services/aiDispatchService";
import { MapMarker } from "./MapMarker";
import { KARACHI_CENTER } from "./coordinateUtils";
import { useMapCard } from "../MapArea";

interface FaultOverlayProps {
  faults: Fault[];
  vehicles: Vehicle[];
  isDayMode: boolean;
  onManualDispatch: (vehicleId: string, faultId: string) => void;
}

export const FaultOverlay = ({ faults, vehicles, isDayMode, onManualDispatch }: FaultOverlayProps) => {
  const aiDispatch = AIDispatchService.getInstance();
  const mapCardRef = useMapCard();

  return (
    <>
      {faults.filter(f => f.status !== 'resolved').map((fault) => {
        const assignedVehicle = fault.assignedVehicle ? vehicles.find(v => v.id === fault.assignedVehicle) : null;
        
        // Use lat/lng if available, otherwise fall back to Karachi center
        const lat = fault.latitude ?? KARACHI_CENTER[0];
        const lng = fault.longitude ?? KARACHI_CENTER[1];

        if (!lat || !lng) return null;
        
        return (
          <MapMarker key={fault.id} latitude={lat} longitude={lng}>
            <HoverCard openDelay={100} closeDelay={100}>
              <HoverCardTrigger asChild>
                <div className="cursor-pointer transform hover:scale-110 transition-all duration-200 relative">
                  <Zap className={`w-6 h-6 ${getFaultSeverityColor(fault.severity)} drop-shadow-lg`} />
                  {fault.severity === 'critical' && (
                    <div className="absolute inset-0 animate-ping">
                      <Zap className="w-6 h-6 text-red-500 opacity-75" />
                    </div>
                  )}
                </div>
              </HoverCardTrigger>
              <HoverCardPortal container={mapCardRef?.current || undefined}>
                <HoverCardContent 
                  className="w-80 !z-[9999]" 
                  side="top" 
                  align="center"
                  sideOffset={10}
                  avoidCollisions={true}
                  collisionPadding={8}
                >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">{fault.description || `Fault ${fault.id.substring(0, 8)}`}</h4>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${
                        fault.severity === 'critical' ? 'bg-red-500' :
                        fault.severity === 'high' ? 'bg-orange-500' :
                        fault.severity === 'medium' ? 'bg-yellow-500' :
                        'bg-blue-500'
                      }`}></div>
                      <span className="text-sm capitalize">{fault.severity}</span>
                    </div>
                  </div>
                  
                  {fault.description && (
                    <p className="text-sm text-gray-600">{fault.description}</p>
                  )}
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center space-x-1">
                      <MapPin className="w-3 h-3" />
                      <span>Status:</span>
                    </span>
                    <span className="capitalize">{fault.status}</span>
                  </div>

                  {/* Show assigned vehicle if any */}
                  {assignedVehicle && (
                    <div className="p-2 border rounded bg-green-50">
                      <div className="flex items-center space-x-2 text-xs">
                        <Truck className="w-3 h-3 text-green-600" />
                        <span className="font-semibold">Assigned: {assignedVehicle.vehicle_number || assignedVehicle.vehicle || assignedVehicle.id || 'Unknown'}</span>
                      </div>
                      <div className="text-xs text-green-600 mt-1">
                        Status: {assignedVehicle.status} | Fuel: {assignedVehicle.fuelLevel}%
                      </div>
                    </div>
                  )}

                  {/* Manual Dispatch Button - Only show when AI is inactive and fault is pending */}
                  {!aiDispatch.isAIActive() && fault.status === 'waiting' && !assignedVehicle && (
                    <div className="pt-2 border-t">
                      <VehicleSelector
                        vehicles={vehicles}
                        onSelectVehicle={(vehicleId) => onManualDispatch(vehicleId, fault.id)}
                        isDayMode={isDayMode}
                      />
                    </div>
                  )}
                </div>
                </HoverCardContent>
              </HoverCardPortal>
            </HoverCard>
          </MapMarker>
        );
      })}
    </>
  );
};
