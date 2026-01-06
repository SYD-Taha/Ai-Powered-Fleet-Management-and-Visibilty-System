
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Vehicle } from "@/services/aiDispatchService";
import { Truck, ChevronDown, Fuel, MapPin } from "lucide-react";

interface VehicleSelectorProps {
  vehicles: Vehicle[];
  onSelectVehicle: (vehicleId: string) => void;
  disabled?: boolean;
  isDayMode?: boolean;
}

export const VehicleSelector = ({ vehicles, onSelectVehicle, disabled = false, isDayMode = true }: VehicleSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const availableVehicles = vehicles.filter(vehicle => 
    vehicle.status === 'available' && vehicle.fuelLevel > 20
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available": return "bg-green-500";
      case "onRoute": return "bg-blue-500";
      case "working": return "bg-orange-500";
      case "refueling": return "bg-purple-500";
      case "idle": return "bg-gray-500";
      default: return "bg-gray-500";
    }
  };

  const handleVehicleSelect = (vehicleId: string) => {
    onSelectVehicle(vehicleId);
    setIsOpen(false);
  };

  if (availableVehicles.length === 0) {
    return (
      <Button disabled size="sm" className="w-full text-xs">
        No Available Vehicles
      </Button>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full text-xs justify-between"
          disabled={disabled}
        >
          <div className="flex items-center space-x-1">
            <Truck className="w-3 h-3" />
            <span>Dispatch Vehicle</span>
          </div>
          <ChevronDown className="w-3 h-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Card className="border-0 shadow-none">
          <CardContent className="p-3">
            <div className="space-y-2">
              <h4 className="text-sm font-semibold mb-3">Select Vehicle to Dispatch</h4>
              <ScrollArea className="h-80">
                <div className="space-y-2 pr-4">
                  {availableVehicles.map((vehicle) => (
                    <div
                      key={vehicle.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-accent ${
                        isDayMode ? 'border-gray-200' : 'border-slate-600'
                      }`}
                      onClick={() => handleVehicleSelect(vehicle.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Truck className="w-4 h-4 text-blue-600" />
                          <span className="font-semibold text-sm">{vehicle.vehicle_number || vehicle.id || vehicle.vehicle || 'Unknown'}</span>
                        </div>
                        <Badge 
                          variant="outline"
                          className={`text-xs ${getStatusColor(vehicle.status)} text-white border-0`}
                        >
                          {vehicle.status}
                        </Badge>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center space-x-1">
                            <Fuel className="w-3 h-3" />
                            <span>Fuel:</span>
                          </span>
                          <span className={`font-medium ${
                            vehicle.fuelLevel > 50 ? 'text-green-600' : 
                            vehicle.fuelLevel > 20 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {vehicle.fuelLevel}%
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center space-x-1">
                            <MapPin className="w-3 h-3" />
                            <span>Position:</span>
                          </span>
                          <span className="text-gray-600">
                            ({Math.round(vehicle.x)}, {Math.round(vehicle.y)})
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs">
                          <span>Expertise:</span>
                          <span className="text-gray-600">{vehicle.teamExpertiseLevel}/10</span>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs">
                          <span>Performance:</span>
                          <span className="text-gray-600">{vehicle.pastPerformance}%</span>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs">
                          <span>Fatigue:</span>
                          <span className={`font-medium ${
                            vehicle.teamFatigueLevel < 3 ? 'text-green-600' : 
                            vehicle.teamFatigueLevel < 6 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {vehicle.teamFatigueLevel}/10
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs">
                          <span>Type:</span>
                          <span className="capitalize text-gray-600">{vehicle.type}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
};
