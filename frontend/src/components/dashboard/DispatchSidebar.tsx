import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, AlertTriangle, Clock, CheckCircle, XCircle, Play, Pause, ChevronLeft, ChevronRight, Truck, MapPin } from "lucide-react";
import { useState, useEffect } from "react";
import { AIDispatchService, Vehicle, Fault } from "@/services/aiDispatchService";
import { VehicleSelector } from "./VehicleSelector";
import { calculateHaversineDistance } from "./map/coordinateUtils";

interface DispatchSidebarProps {
  isExpanded: boolean;
  onToggle: () => void;
  isDayMode: boolean;
  vehicles: Vehicle[];
  faults: Fault[];
}

export const DispatchSidebar = ({ isExpanded, onToggle, isDayMode, vehicles, faults }: DispatchSidebarProps) => {
  const [aiDispatch] = useState(() => AIDispatchService.getInstance());
  const [dispatchLogs, setDispatchLogs] = useState(aiDispatch.getDispatchLogs());
  const [isAIActive, setIsAIActive] = useState(aiDispatch.isAIActive());

  // Update logs every second
  useEffect(() => {
    const interval = setInterval(() => {
      setDispatchLogs([...aiDispatch.getDispatchLogs()]);
      setIsAIActive(aiDispatch.isAIActive());
    }, 1000);

    return () => clearInterval(interval);
  }, [aiDispatch]);

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "critical": return "bg-red-500";
      case "high": return "bg-orange-500";
      case "medium": return "bg-yellow-500";
      case "low": return "bg-green-500";
      default: return "bg-gray-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success": return <CheckCircle className="w-3 h-3 text-green-500" />;
      case "waiting": return <Clock className="w-3 h-3 text-yellow-500" />;
      case "pending_confirmation": return <Clock className="w-3 h-3 text-orange-500" />;
      case "failed": return <XCircle className="w-3 h-3 text-red-500" />;
      default: return <Clock className="w-3 h-3 text-gray-500" />;
    }
  };

  const handleToggleAI = () => {
    aiDispatch.toggleAI();
    setIsAIActive(aiDispatch.isAIActive());
  };

  const getLocationName = (x: number, y: number): string => {
    // Map coordinates to Karachi areas
    if (x < 30 && y < 40) return "Gulshan-e-Iqbal";
    if (x > 70 && y < 40) return "DHA Phase II";
    if (x > 60 && y > 60) return "Clifton";
    if (x < 40 && y > 60) return "Korangi";
    if (x > 40 && x < 70 && y > 30 && y < 70) return "Saddar";
    return "Central Karachi";
  };

  const calculateETA = (fault: Fault, assignedVehicle?: Vehicle): string => {
    if (!assignedVehicle) return "N/A";
    
    // Use route duration if available (from backend-calculated route)
    if (assignedVehicle.routeDuration && assignedVehicle.routeStartTime) {
      const elapsed = (Date.now() - assignedVehicle.routeStartTime) / 1000; // seconds
      const remaining = Math.max(0, assignedVehicle.routeDuration - elapsed);
      return `${Math.ceil(remaining / 60)} min`;
    }
    
    // If route duration is available but no start time, use it directly
    if (assignedVehicle.routeDuration) {
      return `${Math.ceil(assignedVehicle.routeDuration / 60)} min`;
    }
    
    // Final fallback: Use Haversine distance if lat/lng available, otherwise x/y Euclidean
    if (assignedVehicle.latitude && assignedVehicle.longitude && fault.latitude && fault.longitude) {
      // Use Haversine distance for more accurate ETA
      const distanceKm = calculateHaversineDistance(
        assignedVehicle.latitude,
        assignedVehicle.longitude,
        fault.latitude,
        fault.longitude
      ) / 1000; // Convert meters to km
      const avgSpeedKmh = assignedVehicle.speed || 40; // Default 40 km/h
      const timeInMinutes = (distanceKm / avgSpeedKmh) * 60;
      return `${Math.round(timeInMinutes)} min`;
    }
    
    // Last resort: If no coordinates available, return N/A
    // Note: x/y coordinates are deprecated - use lat/lng only
    
    return "N/A";
  };

  const getVehicleForFault = (faultId: string): Vehicle | undefined => {
    return vehicles.find(v => v.assignedJob === faultId);
  };

  const handleManualDispatch = (vehicleId: string, faultId: string) => {
    // This will trigger a manual dispatch
    // We need to pass this up to the parent component to update the state
    const result = aiDispatch.manualDispatch(vehicleId, faultId, vehicles, faults);
    // Note: This would need to be connected to the parent's state update mechanism
    console.log('Manual dispatch triggered:', result);
  };

  return (
    <div className={`relative flex transition-all duration-300 ease-in-out ${
      isExpanded ? 'w-80' : 'w-12'
    } ${isDayMode ? 'bg-white' : 'bg-slate-900'} border-l ${
      isDayMode ? 'border-gray-200' : 'border-slate-700'
    }`}>
      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className={`absolute top-4 -left-3 z-10 h-6 w-6 rounded-full shadow-lg border transition-all duration-200 hover:scale-110 ${
          isDayMode 
            ? 'bg-white border-gray-200 hover:bg-gray-50' 
            : 'bg-slate-800 border-slate-600 hover:bg-slate-700'
        }`}
      >
        {isExpanded ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </Button>

      {/* Sidebar Content */}
      {isExpanded && (
        <div className="w-full flex flex-col h-full">
          <ScrollArea className="flex-1">
            {/* AI Status and Control */}
            <Card className={`rounded-none border-x-0 border-t-0 ${
              isDayMode ? 'bg-white' : 'bg-slate-900 border-slate-700'
            }`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className={`text-lg font-semibold flex items-center space-x-2 ${
                    isDayMode ? 'text-gray-900' : 'text-white'
                  }`}>
                    <Bot className="w-5 h-5 text-blue-600" />
                    <span>AI Dispatch System</span>
                  </CardTitle>
                  <Button 
                    variant={isAIActive ? "default" : "outline"} 
                    size="sm"
                    onClick={handleToggleAI}
                    className="flex items-center space-x-1"
                  >
                    {isAIActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    <span>{isAIActive ? "Active" : "Inactive"}</span>
                  </Button>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${isAIActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                  <span className={`text-sm ${
                    isDayMode ? 'text-gray-600' : 'text-gray-400'
                  }`}>
                    Status: {isAIActive ? "AUTO-DISPATCHING" : "MANUAL MODE"}
                  </span>
                </div>
              </CardHeader>
            </Card>

            <Separator className={isDayMode ? 'bg-gray-200' : 'bg-slate-700'} />

            {/* AI Dispatching Logs */}
            <Card className={`rounded-none border-x-0 border-t-0 ${
              isDayMode ? 'bg-white' : 'bg-slate-900 border-slate-700'
            }`}>
              <CardHeader className="pb-3">
                <CardTitle className={`text-lg font-semibold flex items-center space-x-2 ${
                  isDayMode ? 'text-gray-900' : 'text-white'
                }`}>
                  <Clock className="w-5 h-5 text-green-600" />
                  <span>Live Dispatch Logs</span>
                  <Badge variant="outline" className="ml-auto">
                    {dispatchLogs.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {dispatchLogs.length === 0 ? (
                  <div className={`text-center py-4 text-sm ${
                    isDayMode ? 'text-gray-500' : 'text-gray-400'
                  }`}>
                    No dispatch activity yet...
                    {!isAIActive && <div className="mt-1">Use manual dispatch buttons below</div>}
                  </div>
                ) : (
                  dispatchLogs.map((log) => {
                    const assignedVehicle = log.vehicleId !== 'SYSTEM' && log.vehicleId !== 'N/A' ? vehicles.find(v => v.id === log.vehicleId) : null;
                    const assignedFault = log.faultId !== 'N/A' ? faults.find(f => f.id === log.faultId) : null;
                    
                    return (
                      <div key={log.id} className={`p-3 rounded-lg space-y-2 ${
                        isDayMode ? 'bg-slate-50' : 'bg-slate-800'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-mono ${
                            isDayMode ? 'text-gray-500' : 'text-gray-400'
                          }`}>{log.timestamp}</span>
                          <div className="flex items-center space-x-1">
                            {getStatusIcon(log.status)}
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${getPriorityColor(log.priority)} text-white border-0`}
                            >
                              {log.priority}
                            </Badge>
                          </div>
                        </div>
                        <p className={`text-sm ${
                          isDayMode ? 'text-gray-700' : 'text-gray-300'
                        }`}>{log.action}</p>
                        
                        {/* Vehicle-Fault Assignment Info */}
                        {assignedVehicle && assignedFault && (
                          <div className={`p-2 rounded border ${
                            isDayMode ? 'bg-blue-50 border-blue-200' : 'bg-blue-900/20 border-blue-700'
                          }`}>
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center space-x-1">
                                <Truck className="w-3 h-3 text-blue-600" />
                                <span className="font-semibold">{assignedVehicle.vehicle_number || assignedVehicle.id || assignedVehicle.vehicle || 'Unknown'}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <MapPin className="w-3 h-3 text-red-600" />
                                <span className="font-semibold">{assignedFault.description || `Fault ${assignedFault.id.substring(0, 8)}`}</span>
                              </div>
                            </div>
                            <div className="mt-1 text-xs text-blue-600">
                              Vehicle Status: {assignedVehicle.status} | Fault Status: {assignedFault.status}
                            </div>
                          </div>
                        )}
                        
                        {log.eta !== "N/A" && (
                          <p className="text-xs text-blue-600">ETA: {log.eta}</p>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Separator className={isDayMode ? 'bg-gray-200' : 'bg-slate-700'} />

            {/* Active Fault Queue */}
            <Card className={`rounded-none border-x-0 border-t-0 ${
              isDayMode ? 'bg-white' : 'bg-slate-900 border-slate-700'
            }`}>
              <CardHeader className="pb-3">
                <CardTitle className={`text-lg font-semibold flex items-center space-x-2 ${
                  isDayMode ? 'text-gray-900' : 'text-white'
                }`}>
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <span>Active Fault Queue</span>
                  <Badge variant="destructive" className="ml-auto">
                    {faults.filter(f => f.status !== 'resolved').length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {faults.filter(f => f.status !== 'resolved').length > 0 ? (
                  faults.filter(f => f.status !== 'resolved').map((fault) => {
                    const assignedVehicle = fault.assignedVehicle ? vehicles.find(v => v.id === fault.assignedVehicle) : getVehicleForFault(fault.id);
                    const eta = assignedVehicle ? calculateETA(fault, assignedVehicle) : "N/A";
                    const location = getLocationName(fault.x, fault.y);

                    return (
                      <div key={fault.id} className={`p-4 border rounded-lg space-y-3 ${
                        isDayMode ? 'border-gray-200' : 'border-slate-600'
                      }`}>
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className={`font-semibold text-sm ${
                              isDayMode ? 'text-gray-900' : 'text-white'
                            }`}>{fault.description || `Fault ${fault.id.substring(0, 8)}`}</h4>
                            <p className={`text-xs ${
                              isDayMode ? 'text-gray-600' : 'text-gray-400'
                            }`}>{location}</p>
                          </div>
                          <Badge 
                            variant="outline"
                            className={`${getPriorityColor(fault.severity)} text-white border-0`}
                          >
                            {fault.severity}
                          </Badge>
                        </div>
                        
                        <div className="space-y-1">
                          <p className={`text-sm font-medium ${
                            isDayMode ? 'text-gray-700' : 'text-gray-300'
                          }`}>{fault.description}</p>
                          
                          {/* Vehicle Assignment Display */}
                          <div className={`p-2 rounded ${
                            assignedVehicle 
                              ? (isDayMode ? 'bg-green-50 border border-green-200' : 'bg-green-900/20 border border-green-700')
                              : (isDayMode ? 'bg-orange-50 border border-orange-200' : 'bg-orange-900/20 border border-orange-700')
                          }`}>
                            <div className="flex items-center justify-between text-xs">
                              <span className={isDayMode ? 'text-gray-500' : 'text-gray-400'}>Assigned Vehicle:</span>
                              <div className="flex items-center space-x-1">
                                <Truck className={`w-3 h-3 ${assignedVehicle ? 'text-green-600' : 'text-orange-600'}`} />
                                <span className={`font-semibold ${assignedVehicle ? 'text-green-600' : 'text-orange-600'}`}>
                                  {assignedVehicle ? (assignedVehicle.vehicle_number || assignedVehicle.id || assignedVehicle.vehicle || 'Unknown') : "Unassigned"}
                                </span>
                              </div>
                            </div>
                            {assignedVehicle && (
                              <div className="mt-2 space-y-1">
                                <div className="text-xs text-green-600">
                                  Status: {assignedVehicle.status} | Fuel: {assignedVehicle.fuelLevel}%
                                </div>
                                <div className="text-xs text-green-600">
                                  Expertise: {assignedVehicle.teamExpertiseLevel}/10 | Performance: {assignedVehicle.pastPerformance}%
                                </div>
                                <div className="text-xs text-green-600">
                                  Fatigue Level: {assignedVehicle.teamFatigueLevel}/10
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between text-xs">
                            <span className={isDayMode ? 'text-gray-500' : 'text-gray-400'}>ETA:</span>
                            <span className={isDayMode ? 'text-gray-700' : 'text-gray-300'}>{eta}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className={isDayMode ? 'text-gray-500' : 'text-gray-400'}>Status:</span>
                            <Badge variant="secondary" className="text-xs capitalize">
                              {fault.status}
                            </Badge>
                          </div>
                        </div>

                        {/* Manual Dispatch Button - Only show when AI is inactive and fault is pending */}
                        {!isAIActive && fault.status === 'waiting' && !assignedVehicle && (
                          <VehicleSelector
                            vehicles={vehicles}
                            onSelectVehicle={(vehicleId) => handleManualDispatch(vehicleId, fault.id)}
                            isDayMode={isDayMode}
                          />
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className={`text-center py-8 ${
                    isDayMode ? 'text-gray-500' : 'text-gray-400'
                  }`}>
                    <p className="text-sm">No active faults</p>
                    <p className="text-xs mt-1">New faults will appear automatically</p>
                  </div>
                )}
                
                {isAIActive ? (
                  <div className={`p-3 border rounded-lg ${
                    isDayMode ? 'bg-green-50 border-green-200' : 'bg-green-900/20 border-green-700'
                  }`}>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className={`text-sm font-medium ${
                        isDayMode ? 'text-green-700' : 'text-green-400'
                      }`}>
                        AI is actively monitoring and auto-dispatching vehicles...
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className={`p-3 border rounded-lg ${
                    isDayMode ? 'bg-blue-50 border-blue-200' : 'bg-blue-900/20 border-blue-700'
                  }`}>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className={`text-sm font-medium ${
                        isDayMode ? 'text-blue-700' : 'text-blue-400'
                      }`}>
                        Manual Mode: Use dispatch buttons to assign vehicles to faults
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </ScrollArea>
        </div>
      )}
    </div>
  );
};
