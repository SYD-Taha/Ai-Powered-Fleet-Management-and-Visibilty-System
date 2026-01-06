import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Vehicle } from "@/services/aiDispatchService";
import { Header } from "@/components/shared/Header";
import { useState, useEffect } from "react";
import { getVehicles } from "@/services/api";

// Mock maintenance data - in a real app this would come from a maintenance service
const generateMaintenanceData = (vehicle: Vehicle) => {
  const lastMaintenance = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
  const nextMaintenance = new Date(lastMaintenance.getTime() + (30 + Math.random() * 30) * 24 * 60 * 60 * 1000);
  const daysUntilNextMaintenance = Math.floor((nextMaintenance.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  
  return {
    nextMaintenance: nextMaintenance.toLocaleDateString(),
    daysUntilNextMaintenance,
    maintenanceScore: Math.floor(Math.random() * 30 + 70),
    criticalIssues: Math.floor(Math.random() * 3),
    warningIssues: Math.floor(Math.random() * 5),
  };
};

const MaintenanceEngine = () => {
  const navigate = useNavigate();
  
  // Get day/night mode from localStorage and sync across the site
  const [isDayMode, setIsDayMode] = useState(() => {
    const saved = localStorage.getItem('isDayMode');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Save day/night mode to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('isDayMode', JSON.stringify(isDayMode));
  }, [isDayMode]);
  
  // State for vehicles and loading
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch vehicles from backend API
  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch vehicles from backend API
        // Backend returns: _id, vehicle_number, status, latitude, longitude, speed (from GPS)
        const backendVehicles = await getVehicles();
        
        // Ensure backendVehicles is an array
        if (!Array.isArray(backendVehicles)) {
          console.warn('Expected array from getVehicles, got:', typeof backendVehicles);
          setVehicles([]);
          return;
        }
        
        // Transform backend vehicle data to match Vehicle interface
        const transformedVehicles: Vehicle[] = backendVehicles.map((v: any) => {
          // Determine vehicle type from vehicle_number if not present in backend
          // Backend schema doesn't have a 'type' field, so infer from naming convention
          let vehicleType = 'maintenance'; // default
          const vehicleNum = v.vehicle_number?.toUpperCase() || '';
          if (vehicleNum.includes('EMERGENCY') || vehicleNum.includes('E-')) {
            vehicleType = 'emergency';
          } else if (vehicleNum.includes('INSPECTION') || vehicleNum.includes('I-')) {
            vehicleType = 'inspection';
          }

          return {
            _id: v._id,
            id: v._id || v.vehicle_number, // Use _id as primary id
            vehicle_number: v.vehicle_number || 'Unknown',
            type: v.type || vehicleType, // Use type from backend or inferred type
            status: v.status || 'available', // Backend status: available, idle, onRoute, working
            speed: v.speed || 0, // From latest GPS data
            fuelLevel: v.fuelLevel || 85, // Default fuel level (backend doesn't have this field)
            latitude: v.latitude, // From latest GPS data
            longitude: v.longitude, // From latest GPS data
            assignedJob: null, // Not used in maintenance view
            icon: null, // Not used in maintenance view
            // Optional fields with defaults (not in backend schema)
            teamExpertiseLevel: v.teamExpertiseLevel || 7,
            pastPerformance: v.pastPerformance || 85,
            teamFatigueLevel: v.teamFatigueLevel || 0,
          };
        });

        setVehicles(transformedVehicles);
      } catch (err: any) {
        console.error('Failed to fetch vehicles:', err);
        // Extract error message from axios error response if available
        const errorMessage = err.response?.data?.error || err.message || 'Failed to load vehicles';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchVehicles();
  }, []);

  const getMaintenanceScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 75) return "text-yellow-600";
    return "text-red-600";
  };

  const getMaintenanceScoreBg = (score: number) => {
    if (score >= 90) return "bg-green-100";
    if (score >= 75) return "bg-yellow-100";
    return "bg-red-100";
  };

  const getVehicleTypeColor = (type: string) => {
    switch (type) {
      case 'maintenance': return 'bg-blue-100 text-blue-800';
      case 'emergency': return 'bg-red-100 text-red-800';
      case 'inspection': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className={`min-h-screen transition-all duration-500 ${
      isDayMode ? 'bg-gray-50' : 'bg-slate-900'
    }`}>
      <Header 
        isDayMode={isDayMode}
        setIsDayMode={setIsDayMode}
        showModeToggle={true}
      />
      
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard')}
              className={`rounded-full transition-all duration-300 ${
                isDayMode 
                  ? 'hover:bg-gray-100' 
                  : 'hover:bg-slate-800 text-slate-300'
              }`}
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Badge 
              variant="outline" 
              className={`px-3 py-1 transition-colors ${
                isDayMode 
                  ? 'border-gray-300 text-gray-700' 
                  : 'border-slate-600 text-slate-300'
              }`}
            >
              {loading ? 'Loading...' : `${vehicles.length} Vehicles`}
            </Badge>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className={`ml-3 text-lg transition-colors ${
              isDayMode ? 'text-gray-700' : 'text-slate-300'
            }`}>
              Loading vehicles...
            </span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <div className={`text-center p-6 rounded-lg ${
              isDayMode ? 'bg-red-50 border border-red-200' : 'bg-red-900/20 border border-red-800'
            }`}>
              <AlertTriangle className={`w-8 h-8 mx-auto mb-2 ${
                isDayMode ? 'text-red-600' : 'text-red-400'
              }`} />
              <p className={`text-lg font-medium transition-colors ${
                isDayMode ? 'text-red-900' : 'text-red-300'
              }`}>
                Error loading vehicles
              </p>
              <p className={`text-sm mt-1 transition-colors ${
                isDayMode ? 'text-red-700' : 'text-red-400'
              }`}>
                {error}
              </p>
            </div>
          </div>
        ) : vehicles.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className={`text-center p-6 rounded-lg ${
              isDayMode ? 'bg-gray-50 border border-gray-200' : 'bg-slate-800 border border-slate-700'
            }`}>
              <p className={`text-lg font-medium transition-colors ${
                isDayMode ? 'text-gray-900' : 'text-slate-200'
              }`}>
                No vehicles found
              </p>
              <p className={`text-sm mt-1 transition-colors ${
                isDayMode ? 'text-gray-600' : 'text-slate-400'
              }`}>
                Add vehicles to see them here
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {vehicles.map((vehicle) => {
              const maintenanceData = generateMaintenanceData(vehicle);
              
              return (
                <Card 
                  key={vehicle.id || vehicle._id} 
                  className={`hover:shadow-lg transition-all cursor-pointer hover:scale-105 ${
                    isDayMode 
                      ? 'bg-white border-gray-200 hover:shadow-gray-200' 
                      : 'bg-slate-800 border-slate-700 hover:shadow-slate-700'
                  }`}
                  onClick={() => navigate(`/maintenance/${vehicle._id || vehicle.id || vehicle.vehicle_number}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className={`text-lg font-semibold transition-colors ${
                        isDayMode ? 'text-gray-900' : 'text-white'
                      }`}>
                        {vehicle.vehicle_number || vehicle.id || vehicle._id}
                      </CardTitle>
                    <div className="flex flex-col items-end space-y-1">
                      <Badge className={getVehicleTypeColor(vehicle.type)}>
                        {vehicle.type}
                      </Badge>
                      <Badge 
                        variant="outline"
                        className={`text-xs ${
                          vehicle.status === 'available' ? 'text-green-600 border-green-600' :
                          vehicle.status === 'dispatched' || vehicle.status === 'onRoute' ? 'text-blue-600 border-blue-600' :
                          vehicle.status === 'working' ? 'text-orange-600 border-orange-600' :
                          vehicle.status === 'idle' ? 'text-yellow-600 border-yellow-600' :
                          'text-red-600 border-red-600'
                        }`}
                      >
                        {vehicle.status || 'available'}
                      </Badge>
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${getMaintenanceScoreBg(maintenanceData.maintenanceScore)} ${getMaintenanceScoreColor(maintenanceData.maintenanceScore)}`}>
                    {maintenanceData.maintenanceScore}% Health
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  {/* Next Maintenance Prediction */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <CalendarDays className={`w-4 h-4 transition-colors ${
                        isDayMode ? 'text-gray-500' : 'text-slate-400'
                      }`} />
                      <span className={`text-sm font-medium transition-colors ${
                        isDayMode ? 'text-gray-900' : 'text-slate-200'
                      }`}>
                        Next Maintenance
                      </span>
                    </div>
                    <div className={`text-sm ${
                      maintenanceData.daysUntilNextMaintenance < 7 
                        ? 'text-red-600 font-medium' 
                        : isDayMode ? 'text-gray-700' : 'text-slate-300'
                    }`}>
                      {maintenanceData.nextMaintenance}
                    </div>
                    <div className={`text-xs ${
                      maintenanceData.daysUntilNextMaintenance < 7 
                        ? 'text-red-500' 
                        : isDayMode ? 'text-gray-500' : 'text-slate-400'
                    }`}>
                      {maintenanceData.daysUntilNextMaintenance} days remaining
                    </div>
                  </div>

                  {/* Issues Summary */}
                  {(maintenanceData.criticalIssues > 0 || maintenanceData.warningIssues > 0) && (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className={`w-4 h-4 transition-colors ${
                          isDayMode ? 'text-gray-500' : 'text-slate-400'
                        }`} />
                        <span className={`text-sm font-medium transition-colors ${
                          isDayMode ? 'text-gray-900' : 'text-slate-200'
                        }`}>
                          Issues
                        </span>
                      </div>
                      <div className="flex space-x-3 text-xs">
                        {maintenanceData.criticalIssues > 0 && (
                          <div className="flex items-center space-x-1">
                            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                            <span className={isDayMode ? 'text-gray-700' : 'text-slate-300'}>
                              {maintenanceData.criticalIssues} Critical
                            </span>
                          </div>
                        )}
                        {maintenanceData.warningIssues > 0 && (
                          <div className="flex items-center space-x-1">
                            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                            <span className={isDayMode ? 'text-gray-700' : 'text-slate-300'}>
                              {maintenanceData.warningIssues} Warnings
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className={`pt-2 border-t transition-colors ${
                    isDayMode ? 'border-gray-200' : 'border-slate-700'
                  }`}>
                    <p className={`text-xs transition-colors ${
                      isDayMode ? 'text-gray-500' : 'text-slate-400'
                    }`}>
                      Click for detailed maintenance info
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        )}
      </div>
    </div>
  );
};

export default MaintenanceEngine;
