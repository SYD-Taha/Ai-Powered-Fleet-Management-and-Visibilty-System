
import { Vehicle, Fault } from "@/services/aiDispatchService";

interface MapStatisticsProps {
  vehicles: Vehicle[];
  faults: Fault[];
}

export const MapStatistics = ({ vehicles, faults }: MapStatisticsProps) => {
  // Active vehicles are those that are onRoute or working (not available/idle)
  const activeVehicles = vehicles.filter(v => 
    v.status === 'onRoute' || v.status === 'working'
  ).length;
  
  // Pending faults are those that are waiting or pending_confirmation (not assigned or resolved)
  const pendingFaults = faults.filter(f => 
    f.status === 'waiting' || f.status === 'pending_confirmation'
  ).length;
  
  // Working vehicles are those actively working on a fault
  const workingVehicles = vehicles.filter(v => v.status === 'working').length;
  
  return (
    <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-4 z-30">
      <h4 className="font-semibold text-sm text-gray-900 mb-2">Live Statistics</h4>
      <div className="space-y-1 text-xs">
        <div>Active Vehicles: {activeVehicles}</div>
        <div>Pending Faults: {pendingFaults}</div>
        <div>Working Vehicles: {workingVehicles}</div>
      </div>
    </div>
  );
};
