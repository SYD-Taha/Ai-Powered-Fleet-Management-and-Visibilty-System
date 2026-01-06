import { useState, useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TopNavigation } from "@/components/dashboard/TopNavigation";
import { FleetSidebar } from "@/components/dashboard/FleetSidebar";
import { MapArea } from "@/components/dashboard/MapArea";
import { DispatchSidebar } from "@/components/dashboard/DispatchSidebar";
import { Vehicle, Fault } from "@/services/aiDispatchService";

const Dashboard = () => {
  // 🌙 Day/Night mode toggle
  const [isDayMode, setIsDayMode] = useState(() => {
    const saved = localStorage.getItem("isDayMode");
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem("isDayMode", JSON.stringify(isDayMode));
  }, [isDayMode]);

  // 🎛️ UI + state management
  const [isFleetSidebarExpanded, setIsFleetSidebarExpanded] = useState(true);
  const [isDispatchSidebarExpanded, setIsDispatchSidebarExpanded] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [faults, setFaults] = useState<Fault[]>([]);

  // 🚚 Vehicles and faults are now managed by useMapData hook
  // No need to fetch separately - useMapData handles it

  // 🗺️ Sync map + sidebar when data changes
  const handleMapDataUpdate = (updatedVehicles: Vehicle[], updatedFaults: Fault[]) => {
    setVehicles(updatedVehicles);
    setFaults(updatedFaults);
  };

  return (
    <SidebarProvider>
      <div
        className={`h-screen flex flex-col w-full transition-all duration-500 ${
          isDayMode ? "bg-slate-50" : "bg-slate-900"
        }`}
      >
        {/* 🔝 Top Navigation */}
        <TopNavigation isDayMode={isDayMode} setIsDayMode={setIsDayMode} />

        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* 🚛 Fleet Sidebar */}
          <FleetSidebar
            isExpanded={isFleetSidebarExpanded}
            onToggle={() => setIsFleetSidebarExpanded(!isFleetSidebarExpanded)}
            isDayMode={isDayMode}
            vehicles={vehicles}
          />

          {/* 🗺️ Map Area */}
          <div className="flex-1 flex flex-col min-h-0">
            <MapArea
              isPlaying={isPlaying}
              speed={speed}
              isDayMode={isDayMode}
              onDataUpdate={handleMapDataUpdate}
            />
          </div>

          {/* 🧭 Dispatch Sidebar */}
          <DispatchSidebar
            isExpanded={isDispatchSidebarExpanded}
            onToggle={() => setIsDispatchSidebarExpanded(!isDispatchSidebarExpanded)}
            isDayMode={isDayMode}
            vehicles={vehicles}
            faults={faults}
          />
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;
