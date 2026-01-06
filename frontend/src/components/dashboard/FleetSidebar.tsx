import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrendingUp, TrendingDown, Filter, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useMemo } from "react";
import { Vehicle } from "@/services/aiDispatchService";

interface FleetSidebarProps {
  isExpanded: boolean;
  onToggle: () => void;
  isDayMode: boolean;
  vehicles: Vehicle[];
}

export const FleetSidebar = ({ isExpanded, onToggle, isDayMode, vehicles }: FleetSidebarProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilters, setStatusFilters] = useState({
    available: true,
    dispatched: true,
    working: true,
    idle: true,
  });

  const fleetStats = useMemo(() => {
    const totalVehicles = vehicles.length;
    const available = vehicles.filter(v => v.status === "available").length;
    const dispatched = vehicles.filter(v => v.status === "onRoute").length;
    const working = vehicles.filter(v => v.status === "working").length;
    const idle = vehicles.filter(v => v.status === "idle").length;

    return [
      { label: "Total Vehicles", value: totalVehicles.toString(), change: "0", trend: "neutral" },
      { label: "Available", value: available.toString(), change: "+1", trend: "up" },
      { label: "Dispatched", value: dispatched.toString(), change: "+2", trend: "up" },
      { label: "Working", value: working.toString(), change: "+1", trend: "up" },
      { label: "Idle", value: idle.toString(), change: "-1", trend: "down" },
    ];
  }, [vehicles]);

  // ✅ Safe filtering (handles missing fields)
  const filteredVehicles = useMemo(() => {
    return vehicles.filter(vehicle => {
      const idValue = (vehicle.vehicle_number || vehicle.id || vehicle._id || "").toString().toLowerCase();
      const searchMatch = idValue.includes(searchQuery.toLowerCase());
      const statusKey = vehicle.status as keyof typeof statusFilters;
      const statusMatch = statusKey ? statusFilters[statusKey] : false;
      return searchMatch && statusMatch;
    });
  }, [vehicles, searchQuery, statusFilters]);

  // Update the filter checkbox labels section (around line 183)
  {Object.entries(statusFilters).map(([status, checked]) => {
    // Map filter key to display label
    const displayLabel = status === "onRoute" ? "Dispatched" : status.charAt(0).toUpperCase() + status.slice(1);
    
    return (
      <div key={status} className="flex items-center space-x-2">
        <Checkbox
          id={status}
          checked={checked}
          onCheckedChange={(checked) => handleStatusFilterChange(status, !!checked)}
        />
        <Label htmlFor={status} className={`text-sm capitalize cursor-pointer ${
          isDayMode ? 'text-gray-700' : 'text-gray-300'
        }`}>
          {displayLabel}
        </Label>
        <Badge variant="outline" className="text-xs ml-auto">
          {status === "onRoute" 
            ? vehicles.filter(v => v.status === "onRoute" || v.status === "dispatched").length
            : vehicles.filter(v => v.status === status).length
          }
        </Badge>
      </div>
    );
  })}

  const handleStatusFilterChange = (status: string, checked: boolean) => {
    setStatusFilters(prev => ({
      ...prev,
      [status]: checked
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available": return "bg-green-500";
      case "onRoute": return "bg-blue-500";
      case "working": return "bg-orange-500";
      case "idle": return "bg-yellow-500";
      default: return "bg-gray-500";
    }
  };

  return (
    <div className={`relative flex transition-all duration-300 ease-in-out ${
      isExpanded ? 'w-80' : 'w-12'
    } ${isDayMode ? 'bg-white' : 'bg-slate-900'} border-r ${
      isDayMode ? 'border-gray-200' : 'border-slate-700'
    }`}>
      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className={`absolute top-4 -right-3 z-10 h-6 w-6 rounded-full shadow-lg border transition-all duration-200 hover:scale-110 ${
          isDayMode 
            ? 'bg-white border-gray-200 hover:bg-gray-50' 
            : 'bg-slate-800 border-slate-600 hover:bg-slate-700'
        }`}
      >
        {isExpanded ? (
          <ChevronLeft className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
      </Button>

      {/* Sidebar Content */}
      {isExpanded && (
        <div className="w-full flex flex-col h-full">
          <ScrollArea className="flex-1">
            {/* Fleet Statistics */}
            <Card className={`rounded-none border-x-0 border-t-0 ${
              isDayMode ? 'bg-white' : 'bg-slate-900 border-slate-700'
            }`}>
              <CardHeader className="pb-3">
                <CardTitle className={`text-lg font-semibold ${
                  isDayMode ? 'text-gray-900' : 'text-white'
                }`}>Fleet Overview</CardTitle>
                <p className={`text-sm ${
                  isDayMode ? 'text-gray-600' : 'text-gray-400'
                }`}>Maintenance Vehicle Fleet</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {fleetStats.map((stat, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm ${
                        isDayMode ? 'text-gray-600' : 'text-gray-400'
                      }`}>{stat.label}</p>
                      <p className={`text-2xl font-bold ${
                        isDayMode ? 'text-gray-900' : 'text-white'
                      }`}>{stat.value}</p>
                    </div>
                    <div className="flex items-center space-x-1">
                      {stat.trend === "up" ? (
                        <TrendingUp className="w-4 h-4 text-green-500" />
                      ) : stat.trend === "down" ? (
                        <TrendingDown className="w-4 h-4 text-red-500" />
                      ) : null}
                      <span className={`text-sm font-medium ${
                        stat.trend === "up" ? "text-green-600" : 
                        stat.trend === "down" ? "text-red-600" : 
                        isDayMode ? "text-gray-600" : "text-gray-400"
                      }`}>
                        {stat.change}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Separator className={isDayMode ? 'bg-gray-200' : 'bg-slate-700'} />

            {/* Search + Filters */}
            <Card className={`rounded-none border-x-0 border-t-0 border-b-0 ${
              isDayMode ? 'bg-white' : 'bg-slate-900 border-slate-700'
            }`}>
              <CardHeader className="pb-3">
                <CardTitle className={`text-lg font-semibold flex items-center space-x-2 ${
                  isDayMode ? 'text-gray-900' : 'text-white'
                }`}>
                  <Filter className="w-4 h-4" />
                  <span>Filters</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search */}
                <div className="space-y-2">
                  <Label htmlFor="search" className={`text-sm font-medium ${
                    isDayMode ? 'text-gray-700' : 'text-gray-300'
                  }`}>Search Vehicles</Label>
                  <div className="relative">
                    <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${
                      isDayMode ? 'text-gray-400' : 'text-gray-500'
                    }`} />
                    <Input
                      id="search"
                      placeholder="Search by Vehicle Number (e.g., MT-001)"
                      className="h-8 pl-9"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                {/* Status Filters */}
                <div className="space-y-2">
                  <Label className={`text-sm font-medium ${
                    isDayMode ? 'text-gray-700' : 'text-gray-300'
                  }`}>Status</Label>
                  <div className="space-y-2">
                    {Object.entries(statusFilters).map(([status, checked]) => (
                      <div key={status} className="flex items-center space-x-2">
                        <Checkbox
                          id={status}
                          checked={checked}
                          onCheckedChange={(checked) => handleStatusFilterChange(status, !!checked)}
                        />
                        <Label htmlFor={status} className={`text-sm capitalize cursor-pointer ${
                          isDayMode ? 'text-gray-700' : 'text-gray-300'
                        }`}>
                          {status}
                        </Label>
                        <Badge variant="outline" className="text-xs ml-auto">
                          {vehicles.filter(v => v.status === status).length}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Separator className={isDayMode ? 'bg-gray-200' : 'bg-slate-700'} />

            {/* Vehicle List */}
            <Card className={`rounded-none border-x-0 border-t-0 border-b-0 ${
              isDayMode ? 'bg-white' : 'bg-slate-900 border-slate-700'
            }`}>
              <CardHeader className="pb-3">
                <CardTitle className={`text-lg font-semibold ${
                  isDayMode ? 'text-gray-900' : 'text-white'
                }`}>
                  Vehicle List ({filteredVehicles.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-80 overflow-y-auto">
                {filteredVehicles.length > 0 ? (
                  filteredVehicles.map((vehicle) => (
                    <div
                      key={vehicle._id || vehicle.id}
                      className={`p-3 rounded-lg border transition-all duration-200 hover:shadow-md ${
                        isDayMode 
                          ? 'bg-gray-50 border-gray-200 hover:bg-gray-100' 
                          : 'bg-slate-800 border-slate-600 hover:bg-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${getStatusColor(vehicle.status)}`}></div>
                          <div>
                            <p className={`font-medium text-sm ${
                              isDayMode ? 'text-gray-900' : 'text-white'
                            }`}>
                              {vehicle.vehicle_number 
                              ? vehicle.vehicle_number
                              : vehicle.id || vehicle._id || "Unknown"}
                            </p>
                            <p className={`text-xs capitalize ${
                              isDayMode ? 'text-gray-600' : 'text-gray-400'
                            }`}>
                              {vehicle.status || "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge 
                            variant="outline" 
                            className={`text-xs mb-1 ${
                              vehicle.status === 'available' ? 'text-green-600 border-green-600' :
                              vehicle.status === 'onRoute' ? 'text-blue-600 border-blue-600' :
                              vehicle.status === 'working' ? 'text-orange-600 border-orange-600' :
                              vehicle.status === 'idle' ? 'text-yellow-600 border-yellow-600' :
                              'text-red-600 border-red-600'
                            }`}
                          >
                            {vehicle.type || "Maintenance Truck"}
                          </Badge>
                          <div className={`text-xs space-y-1 ${
                            isDayMode ? 'text-gray-600' : 'text-gray-400'
                          }`}>
                            <div>Fuel: {vehicle.fuelLevel ?? 0}%</div>
                            <div>Expertise: {vehicle.teamExpertiseLevel ?? 0}/10</div>
                            <div>Fatigue: {vehicle.teamFatigueLevel ?? 0}/10</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={`text-center py-8 ${
                    isDayMode ? 'text-gray-500' : 'text-gray-400'
                  }`}>
                    <p className="text-sm">No vehicles match the current filters</p>
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
