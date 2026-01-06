
import { Zap } from "lucide-react";

interface MapLegendsProps {
  isDayMode: boolean;
}

export const MapLegends = ({ isDayMode }: MapLegendsProps) => {
  return (
    <>
      {/* Vehicle Status Legend */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 space-y-2 z-30">
        <h4 className="font-semibold text-sm text-gray-900">Vehicle Status</h4>
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-xs text-gray-700">Available</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-xs text-gray-700">Dispatched</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
            <span className="text-xs text-gray-700">Working</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span className="text-xs text-gray-700">Idle</span>
          </div>
        </div>
      </div>

      {/* Fault Severity Legend */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 space-y-2 z-30">
        <h4 className="font-semibold text-sm text-gray-900">Fault Severity</h4>
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-red-500" />
            <span className="text-xs text-gray-700">Critical</span>
          </div>
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-orange-500" />
            <span className="text-xs text-gray-700">High</span>
          </div>
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            <span className="text-xs text-gray-700">Medium</span>
          </div>
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-gray-700">Low</span>
          </div>
        </div>
      </div>
    </>
  );
};
