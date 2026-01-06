
import { Card } from "@/components/ui/card";
import { Vehicle, Fault } from "@/services/aiDispatchService";
import { MapHeaderControls } from "./map/MapHeaderControls";
import { MapLegends } from "./map/MapLegends";
import { MapStatistics } from "./map/MapStatistics";
import { VehicleOverlay } from "./map/VehicleOverlay";
import { FaultOverlay } from "./map/FaultOverlay";
import { useMapFullscreen } from "./map/useMapFullscreen";
import { useMapData } from "./map/useMapData";
import { InteractiveMap } from "./map/InteractiveMap";
import { createContext, useContext } from "react";

interface MapAreaProps {
  isPlaying: boolean;
  speed: number;
  isDayMode: boolean;
  onDataUpdate: (vehicles: Vehicle[], faults: Fault[]) => void;
}

// Context to provide the Card container for portaling hover cards
const MapCardContext = createContext<React.RefObject<HTMLElement> | null>(null);

export const useMapCard = () => useContext(MapCardContext);

export const MapArea = ({ isPlaying, speed, isDayMode, onDataUpdate }: MapAreaProps) => {
  const { isFullscreen, mapContainerRef, toggleFullscreen } = useMapFullscreen();
  const { vehicles, faults, handleManualDispatch } = useMapData({
    isPlaying,
    speed,
    onDataUpdate
  });

  return (
    <div className="flex-1 p-4 flex flex-col min-h-0">
      <MapCardContext.Provider value={mapContainerRef}>
        <Card ref={mapContainerRef} className={`flex-1 flex flex-col min-h-0 transition-all duration-500 ${
          isDayMode ? 'bg-white' : 'bg-slate-800 border-slate-700'
        } ${isFullscreen ? 'fixed inset-0 z-50 p-0 m-0 rounded-none' : ''}`}>
          <MapHeaderControls
            isDayMode={isDayMode}
            isPlaying={isPlaying}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
          />
          
          <div className="relative flex-1 min-h-0 overflow-hidden map-area-container">
            {/* Interactive Map */}
            <InteractiveMap isDayMode={isDayMode}>
              <VehicleOverlay vehicles={vehicles} />
              <FaultOverlay 
                faults={faults} 
                vehicles={vehicles} 
                isDayMode={isDayMode} 
                onManualDispatch={handleManualDispatch} 
              />
            </InteractiveMap>
            
            <MapLegends isDayMode={isDayMode} />
            <MapStatistics vehicles={vehicles} faults={faults} />
          </div>
        </Card>
      </MapCardContext.Provider>
    </div>
  );
};
