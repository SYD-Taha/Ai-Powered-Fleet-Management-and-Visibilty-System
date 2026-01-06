
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, X, AlertTriangle, Info, CheckCircle, Fuel, Clock } from "lucide-react";

interface AlertBarProps {
  vehicles: any[];
  faults: any[];
  isDayMode: boolean;
}

export const AlertBar = ({ vehicles, faults, isDayMode }: AlertBarProps) => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [currentAlert, setCurrentAlert] = useState(0);

  // Generate dynamic alerts based on vehicle and fault states
  useEffect(() => {
    const newAlerts: any[] = [];

    // Check for low fuel vehicles
    vehicles.forEach(vehicle => {
      if (vehicle.fuelLevel < 20) {
        const vehicleName = vehicle.vehicle_number || vehicle.id || vehicle.vehicle || 'Unknown';
        newAlerts.push({
          id: `fuel-${vehicle.id}`,
          type: "warning",
          message: `Vehicle ${vehicleName} low fuel (${vehicle.fuelLevel}%) - Needs refueling`,
          time: "now",
          icon: Fuel
        });
      }
    });

    // Check for unassigned critical faults
    const criticalFaults = faults.filter(f => f.severity === "critical" && f.status === "waiting");
    const availableVehicles = vehicles.filter(v => v.status === "available");
    
    criticalFaults.forEach(fault => {
      if (availableVehicles.length === 0) {
        const faultName = fault.description || `Fault ${fault.id.substring(0, 8)}`;
        newAlerts.push({
          id: `no-vehicle-${fault.id}`,
          type: "critical",
          message: `No vehicle available for ${faultName}`,
          time: "now",
          icon: AlertTriangle
        });
      }
    });

    // Check for idle vehicles
    const idleVehicles = vehicles.filter(v => v.status === "idle");
    if (idleVehicles.length > 3) {
      newAlerts.push({
        id: "too-many-idle",
        type: "info",
        message: `${idleVehicles.length} vehicles idle - Consider reassignment`,
        time: "now",
        icon: Clock
      });
    }

    // Add successful dispatches
    const dispatchedVehicles = vehicles.filter(v => v.status === "onRoute");
    if (dispatchedVehicles.length > 0) {
      dispatchedVehicles.slice(0, 2).forEach(vehicle => {
        const assignedFault = faults.find(f => f.id === vehicle.assignedJob);
        if (assignedFault) {
          const vehicleName = vehicle.vehicle_number || vehicle.id || vehicle.vehicle || 'Unknown';
          const faultName = assignedFault.description || `Fault ${assignedFault.id.substring(0, 8)}`;
          newAlerts.push({
            id: `dispatch-${vehicle.id}`,
            type: "success",
            message: `${vehicleName} dispatched to ${faultName} - ETA ${Math.floor(Math.random() * 10 + 3)} mins`,
            time: "now",
            icon: CheckCircle
          });
        }
      });
    }

    // Keep some static alerts for demo
    if (newAlerts.length === 0) {
      newAlerts.push({
        id: 1,
        type: "info",
        message: "All systems operational - Fleet monitoring active",
        time: "now",
        icon: Info
      });
    }

    setAlerts(newAlerts);
    // Reset currentAlert if it's out of bounds
    setCurrentAlert(prev => prev >= newAlerts.length ? 0 : prev);
  }, [vehicles, faults]);

  useEffect(() => {
    if (alerts.length > 0) {
      const interval = setInterval(() => {
        setCurrentAlert((prev) => (prev + 1) % alerts.length);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [alerts.length]);

  const getAlertColor = (type: string) => {
    switch (type) {
      case "critical": return "border-red-500 bg-red-50";
      case "warning": return "border-yellow-500 bg-yellow-50";
      case "success": return "border-green-500 bg-green-50";
      default: return "border-blue-500 bg-blue-50";
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case "critical": return "text-red-600";
      case "warning": return "text-yellow-600";
      case "success": return "text-green-600";
      default: return "text-blue-600";
    }
  };

  const dismissAlert = (id: string | number) => {
    setAlerts(alerts.filter(alert => alert.id !== id));
  };

  if (alerts.length === 0) return null;

  const alert = alerts[currentAlert];
  
  // Safety check to prevent the error
  if (!alert) return null;

  const IconComponent = alert.icon;

  return (
    <div className="border-t">
      <Card className={`mx-4 my-2 border-l-4 ${getAlertColor(alert.type)} transition-all duration-500 transform animate-fade-in ${
        isDayMode ? '' : 'bg-slate-800 border-slate-600'
      }`}>
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center space-x-3 flex-1">
            <div className="animate-pulse">
              <IconComponent className={`w-5 h-5 ${getIconColor(alert.type)}`} />
            </div>
            <div className="flex items-center space-x-2">
              <Bell className={`w-4 h-4 transition-colors ${isDayMode ? 'text-gray-500' : 'text-gray-400'}`} />
              <Badge variant="outline" className="text-xs animate-scale-in">
                {alert.type.toUpperCase()}
              </Badge>
            </div>
            <p className={`text-sm flex-1 transition-colors animate-slide-in-right ${
              isDayMode ? 'text-gray-700' : 'text-gray-300'
            }`}>
              {alert.message}
            </p>
            <span className={`text-xs transition-colors ${isDayMode ? 'text-gray-500' : 'text-gray-400'}`}>
              {alert.time}
            </span>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="flex space-x-1">
              {alerts.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === currentAlert ? "bg-blue-500 animate-pulse" : isDayMode ? "bg-gray-300" : "bg-gray-600"
                  }`}
                />
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => dismissAlert(alert.id)}
              className="h-6 w-6 p-0 transition-all duration-200 hover:scale-110"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
