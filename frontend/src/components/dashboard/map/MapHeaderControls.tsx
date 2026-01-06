
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Maximize, Minimize2 } from "lucide-react";
import { AIDispatchService } from "@/services/aiDispatchService";

interface MapHeaderControlsProps {
  isDayMode: boolean;
  isPlaying: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen: () => void;
}

export const MapHeaderControls = ({ 
  isDayMode, 
  isPlaying,
  isFullscreen = false,
  onToggleFullscreen 
}: MapHeaderControlsProps) => {
  const aiDispatch = AIDispatchService.getInstance();

  return (
    <div className={`p-4 border-b flex-shrink-0 transition-colors ${
      isDayMode ? 'border-gray-200' : 'border-slate-600'
    }`}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-xl font-bold transition-colors ${
            isDayMode ? 'text-gray-900' : 'text-white'
          }`}>
            Live Fleet Map - Karachi
          </h2>
          <p className={`text-sm transition-colors ${
            isDayMode ? 'text-gray-600' : 'text-gray-400'
          }`}>
            Real-time maintenance vehicle tracking and fault monitoring
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge 
            variant="outline" 
            className={`flex items-center space-x-1 transition-all duration-200 ${
              isPlaying ? 'animate-pulse' : ''
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${
              isPlaying ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
            }`}></div>
            <span>{isPlaying ? 'Live' : 'Paused'}</span>
          </Badge>
          
          <Badge 
            variant={aiDispatch.isAIActive() ? "default" : "secondary"} 
            className="flex items-center space-x-1 transition-all duration-200"
          >
            <div className={`w-2 h-2 rounded-full ${
              aiDispatch.isAIActive() ? 'bg-green-400 animate-pulse' : 'bg-gray-400'
            }`}></div>
            <span>AI: {aiDispatch.isAIActive() ? 'ACTIVE' : 'INACTIVE'}</span>
          </Badge>
          
          <Button 
            variant="outline" 
            size="sm" 
            className="transition-all duration-200 hover:scale-105"
            onClick={onToggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
