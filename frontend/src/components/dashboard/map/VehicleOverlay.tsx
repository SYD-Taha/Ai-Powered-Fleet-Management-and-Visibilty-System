
import { HoverCard, HoverCardContent, HoverCardTrigger, HoverCardPortal } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { Vehicle } from "@/services/aiDispatchService";
import { getVehicleColor } from "./mapUtils";
import { AIDispatchService } from "@/services/aiDispatchService";
import { MapMarker } from "./MapMarker";
import { KARACHI_CENTER } from "./coordinateUtils";
import { useMapCard } from "../MapArea";

interface VehicleOverlayProps {
  vehicles: Vehicle[];
}

export const VehicleOverlay = ({ vehicles }: VehicleOverlayProps) => {
  const aiDispatch = AIDispatchService.getInstance();
  const mapCardRef = useMapCard();

  return (
    <>
      {vehicles.map((vehicle) => {
        // Use lat/lng if available, otherwise fall back to Karachi center
        const lat = vehicle.latitude ?? KARACHI_CENTER[0];
        const lng = vehicle.longitude ?? KARACHI_CENTER[1];

        if (!lat || !lng) return null;

        // Get vehicle name/identifier
        const vehicleName = vehicle.vehicle_number || vehicle.vehicle || vehicle.id || 'Unknown Vehicle';

        return (
          <MapMarker key={vehicle.id} latitude={lat} longitude={lng}>
            <HoverCard openDelay={100} closeDelay={100}>
              <HoverCardTrigger asChild>
                <div className="cursor-pointer transform hover:scale-110 transition-all duration-200 relative">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shadow-lg border-2 ${getVehicleColor(vehicle.status)} transition-all duration-200`}>
                    {vehicle.icon && <vehicle.icon className="w-3 h-3 text-white" />}
                  </div>
                  {vehicle.status === 'working' && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full animate-pulse border border-white"></div>
                  )}
                  {vehicle.fuelLevel < 30 && (
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-white"></div>
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
                    <h4 className="text-sm font-semibold">{vehicleName}</h4>
                    <Badge 
                      variant="outline"
                      className={`${getVehicleColor(vehicle.status)} text-white border-0`}
                    >
                      {vehicle.status}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Type:</span>
                      <p className="font-medium capitalize">{vehicle.type}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Fuel Level:</span>
                      <p className={`font-medium ${
                        vehicle.fuelLevel > 50 ? 'text-green-600' : 
                        vehicle.fuelLevel > 20 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {vehicle.fuelLevel}%
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Position:</span>
                      <p className="font-medium text-xs">{lat.toFixed(4)}, {lng.toFixed(4)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Speed:</span>
                      <p className="font-medium">{vehicle.speed} km/h</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Expertise Level:</span>
                      <p className="font-medium">{vehicle.teamExpertiseLevel}/10</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Past Performance:</span>
                      <p className="font-medium">{vehicle.pastPerformance}%</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Team Fatigue:</span>
                      <p className={`font-medium ${
                        vehicle.teamFatigueLevel < 3 ? 'text-green-600' : 
                        vehicle.teamFatigueLevel < 6 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {vehicle.teamFatigueLevel}/10
                      </p>
                    </div>
                  </div>

                  {vehicle.assignedJob && (
                    <div>
                      <span className="text-muted-foreground text-sm">Assigned Job:</span>
                      <p className="font-medium text-sm">{vehicle.assignedJob}</p>
                    </div>
                  )}

                  {/* Manual Dispatch Section - Only show when AI is inactive and vehicle is available */}
                  {!aiDispatch.isAIActive() && vehicle.status === 'available' && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground mb-2">
                        Manual Mode: Use the sidebar to dispatch this vehicle to specific faults
                      </p>
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
