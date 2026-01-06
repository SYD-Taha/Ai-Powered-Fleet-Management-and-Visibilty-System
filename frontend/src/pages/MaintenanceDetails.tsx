import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  Calendar, 
  AlertTriangle, 
  Wrench, 
  Gauge, 
  Clock,
  TrendingUp,
  CheckCircle,
  Zap,
  Droplets,
  Thermometer
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Header } from "@/components/shared/Header";
import { useState, useEffect } from "react";
import { getVehicles } from "@/services/api";

// Mock data - replace with actual data fetching
interface MaintenanceData {
  nextMaintenance: string;
  lastMaintenance: string;
  fuelEfficiency: number;
  engineHealth: number;
  overallPerformance: number;
  criticalIssues: number;
  completedTasks: number;
  batteryHealth: number;
  coolantLevel: number;
  oilPressure: number;
}

// Mock function to generate maintenance data
const generateMaintenanceData = () => {
  const nextMaintenance = new Date(Date.now() + Math.random() * 60 * 24 * 60 * 60 * 1000);
  const lastMaintenance = new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000);

  return {
    nextMaintenance: nextMaintenance.toLocaleDateString(),
    lastMaintenance: lastMaintenance.toLocaleDateString(),
    fuelEfficiency: Math.floor(Math.random() * 30 + 70),
    engineHealth: Math.floor(Math.random() * 40 + 60),
    overallPerformance: Math.floor(Math.random() * 50 + 50),
    criticalIssues: Math.floor(Math.random() * 5),
    completedTasks: Math.floor(Math.random() * 20 + 5),
    batteryHealth: Math.floor(Math.random() * 30 + 70),
    coolantLevel: Math.floor(Math.random() * 40 + 60),
    oilPressure: Math.floor(Math.random() * 30 + 70),
  };
};

interface Vehicle {
  _id?: string;
  id?: string;
  vehicle_number: string;
  type: string;
  status: string;
  speed?: number;
  fuelLevel?: number;
}

const MaintenanceDetails = () => {
  const navigate = useNavigate();
  const { vehicleId } = useParams<{ vehicleId: string }>();
  
  // Get day/night mode from localStorage and sync across the site
  const [isDayMode, setIsDayMode] = useState(() => {
    const saved = localStorage.getItem('isDayMode');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Save day/night mode to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('isDayMode', JSON.stringify(isDayMode));
  }, [isDayMode]);
  
  // State for vehicle data
  const [vehicleData, setVehicleData] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Fetch vehicle data from backend
  useEffect(() => {
    const fetchVehicle = async () => {
      try {
        setLoading(true);
        const vehicles = await getVehicles();
        
        // Find vehicle by _id or vehicle_number (vehicleId from URL could be either)
        const vehicle = vehicles.find((v: any) => 
          v._id === vehicleId || v.vehicle_number === vehicleId || v.id === vehicleId
        );
        
        if (vehicle) {
          // Determine vehicle type from vehicle_number if not present
          let vehicleType = 'maintenance'; // default
          const vehicleNum = vehicle.vehicle_number?.toUpperCase() || '';
          if (vehicleNum.includes('EMERGENCY') || vehicleNum.includes('E-')) {
            vehicleType = 'emergency';
          } else if (vehicleNum.includes('INSPECTION') || vehicleNum.includes('I-')) {
            vehicleType = 'inspection';
          }
          
          setVehicleData({
            _id: vehicle._id,
            id: vehicle._id || vehicle.vehicle_number,
            vehicle_number: vehicle.vehicle_number || 'Unknown',
            type: vehicle.type || vehicleType,
            status: vehicle.status || 'available',
            speed: vehicle.speed || 0,
            fuelLevel: vehicle.fuelLevel || 85,
          });
        } else {
          // Vehicle not found - create a fallback
          setVehicleData({
            id: vehicleId || 'Unknown',
            vehicle_number: vehicleId || 'Unknown',
            type: 'maintenance',
            status: 'available',
          });
        }
      } catch (err: any) {
        console.error('Failed to fetch vehicle:', err);
        // Set fallback data on error
        setVehicleData({
          id: vehicleId || 'Unknown',
          vehicle_number: vehicleId || 'Unknown',
          type: 'maintenance',
          status: 'available',
        });
      } finally {
        setLoading(false);
      }
    };

    if (vehicleId) {
      fetchVehicle();
    }
  }, [vehicleId]);

  // Mock maintenance data
  const maintenanceData: MaintenanceData = generateMaintenanceData();
  
  // Get display name for vehicle (vehicle_number or fallback to vehicleId)
  const vehicleDisplayName = vehicleData?.vehicle_number || vehicleId || 'Unknown Vehicle';

  const getVehicleTypeColor = (type: string) => {
    switch (type) {
      case 'maintenance': return 'bg-blue-100 text-blue-800';
      case 'emergency': return 'bg-red-100 text-red-800';
      case 'inspection': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'text-green-600 border-green-600';
      case 'dispatched': return 'text-blue-600 border-blue-600';
      case 'working': return 'text-orange-600 border-orange-600';
      case 'idle': return 'text-yellow-600 border-yellow-600';
      default: return 'text-red-600 border-red-600';
    }
  };

  const MetricCard = ({ icon: Icon, title, value, color, progress }: {
    icon: any;
    title: string;
    value: string | number;
    color: string;
    progress?: number;
  }) => (
    <div className={`p-3 rounded-lg border transition-all duration-300 ${
      isDayMode ? 'bg-white' : 'bg-slate-800 border-slate-700'
    }`}>
      <div className="flex items-center space-x-2 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className={`text-xs font-medium transition-colors ${
          isDayMode ? 'text-gray-700' : 'text-slate-300'
        }`}>{title}</span>
      </div>
      {progress !== undefined ? (
        <div className="space-y-1">
          <Progress value={progress} className="h-1.5" />
          <span className={`text-sm font-bold transition-colors ${
            isDayMode ? 'text-gray-900' : 'text-slate-100'
          }`}>{value}%</span>
        </div>
      ) : (
        <span className={`text-sm font-bold transition-colors ${
          isDayMode ? 'text-gray-900' : 'text-slate-100'
        }`}>{value}</span>
      )}
    </div>
  );

  return (
    <div className={`min-h-screen transition-all duration-500 ${
      isDayMode ? 'bg-gradient-to-br from-slate-50 to-slate-100' : 'bg-slate-900'
    }`}>
      {/* Header */}
      <Header 
        isDayMode={isDayMode}
        setIsDayMode={setIsDayMode}
        showModeToggle={true}
      />

      <div className="p-6">
        {/* Page Header with Back Navigation */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/maintenance')}
              className={`rounded-full transition-all duration-300 ${
                isDayMode 
                  ? 'hover:bg-white hover:shadow-md' 
                  : 'hover:bg-slate-800 text-slate-300'
              }`}
              title="Back to Maintenance Engine"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className={`text-3xl font-bold animate-fade-in transition-colors ${
                isDayMode ? 'text-gray-900' : 'text-white'
              }`}>
                {loading ? 'Loading...' : `Vehicle ${vehicleDisplayName}`}
              </h1>
              <p className={`text-sm transition-colors ${
                isDayMode ? 'text-gray-600' : 'text-slate-400'
              }`}>Advanced maintenance diagnostics and analytics</p>
            </div>
          </div>
          {vehicleData && (
            <div className="flex items-center space-x-2">
              <Badge className={getVehicleTypeColor(vehicleData.type)}>
                {vehicleData.type}
              </Badge>
              <Badge 
                variant="outline"
                className={getStatusColor(vehicleData.status)}
              >
                {vehicleData.status}
              </Badge>
            </div>
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-16rem)]">
          
          {/* Left Side - Maintenance Details */}
          <div className="space-y-4">
            
            {/* Maintenance Schedule */}
            <Card className={`animate-fade-in hover:shadow-lg transition-all duration-300 ${
              isDayMode ? 'bg-white' : 'bg-slate-800 border-slate-700'
            }`}>
              <CardHeader className="pb-3">
                <CardTitle className={`text-lg font-bold flex items-center space-x-2 transition-colors ${
                  isDayMode ? 'text-gray-900' : 'text-white'
                }`}>
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <span>Maintenance Schedule</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className={`p-3 rounded-lg transition-all duration-300 ${
                    isDayMode ? 'bg-blue-50' : 'bg-blue-900/20'
                  }`}>
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      <div>
                        <p className={`text-xs font-medium ${
                          isDayMode ? 'text-blue-800' : 'text-blue-300'
                        }`}>Next Maintenance</p>
                        <p className={`text-sm font-bold ${
                          isDayMode ? 'text-blue-900' : 'text-blue-100'
                        }`}>{maintenanceData.nextMaintenance}</p>
                      </div>
                    </div>
                  </div>
                  <div className={`p-3 rounded-lg transition-all duration-300 ${
                    isDayMode ? 'bg-green-50' : 'bg-green-900/20'
                  }`}>
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-green-600" />
                      <div>
                        <p className={`text-xs font-medium ${
                          isDayMode ? 'text-green-800' : 'text-green-300'
                        }`}>Last Maintenance</p>
                        <p className={`text-sm font-bold ${
                          isDayMode ? 'text-green-900' : 'text-green-100'
                        }`}>{maintenanceData.lastMaintenance}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Performance Metrics */}
            <Card className={`animate-fade-in hover:shadow-lg transition-all duration-300 ${
              isDayMode ? 'bg-white' : 'bg-slate-800 border-slate-700'
            }`}>
              <CardHeader className="pb-3">
                <CardTitle className={`text-lg font-bold flex items-center space-x-2 transition-colors ${
                  isDayMode ? 'text-gray-900' : 'text-white'
                }`}>
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <span>Performance Metrics</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
                  <MetricCard
                    icon={Gauge}
                    title="Fuel Efficiency"
                    value={maintenanceData.fuelEfficiency}
                    color="text-blue-600"
                    progress={maintenanceData.fuelEfficiency}
                  />
                  <MetricCard
                    icon={Wrench}
                    title="Engine Health"
                    value={maintenanceData.engineHealth}
                    color="text-orange-600"
                    progress={maintenanceData.engineHealth}
                  />
                  <MetricCard
                    icon={TrendingUp}
                    title="Overall Performance"
                    value={maintenanceData.overallPerformance}
                    color="text-green-600"
                    progress={maintenanceData.overallPerformance}
                  />
                  <MetricCard
                    icon={Zap}
                    title="Battery Health"
                    value={maintenanceData.batteryHealth}
                    color="text-purple-600"
                    progress={maintenanceData.batteryHealth}
                  />
                </div>
              </CardContent>
            </Card>

            {/* System Status & Issues Combined */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className={`animate-fade-in hover:shadow-lg transition-all duration-300 ${
                isDayMode ? 'bg-white' : 'bg-slate-800 border-slate-700'
              }`}>
                <CardHeader className="pb-3">
                  <CardTitle className={`text-lg font-bold flex items-center space-x-2 transition-colors ${
                    isDayMode ? 'text-gray-900' : 'text-white'
                  }`}>
                    <Thermometer className="w-5 h-5 text-red-600" />
                    <span>System Status</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <MetricCard
                      icon={Droplets}
                      title="Coolant Level"
                      value={maintenanceData.coolantLevel}
                      color="text-cyan-600"
                      progress={maintenanceData.coolantLevel}
                    />
                    <MetricCard
                      icon={Gauge}
                      title="Oil Pressure"
                      value={maintenanceData.oilPressure}
                      color="text-amber-600"
                      progress={maintenanceData.oilPressure}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className={`animate-fade-in hover:shadow-lg transition-all duration-300 ${
                isDayMode ? 'bg-white' : 'bg-slate-800 border-slate-700'
              }`}>
                <CardHeader className="pb-3">
                  <CardTitle className={`text-lg font-bold flex items-center space-x-2 transition-colors ${
                    isDayMode ? 'text-gray-900' : 'text-white'
                  }`}>
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <span>Issues & Tasks</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <div className={`p-3 rounded-lg transition-all duration-300 ${
                      isDayMode ? 'bg-red-50' : 'bg-red-900/20'
                    }`}>
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <div>
                          <p className={`text-xs font-medium ${
                            isDayMode ? 'text-red-800' : 'text-red-300'
                          }`}>Critical Issues</p>
                          <p className={`text-lg font-bold ${
                            isDayMode ? 'text-red-900' : 'text-red-100'
                          }`}>{maintenanceData.criticalIssues}</p>
                        </div>
                      </div>
                    </div>
                    <div className={`p-3 rounded-lg transition-all duration-300 ${
                      isDayMode ? 'bg-emerald-50' : 'bg-emerald-900/20'
                    }`}>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        <div>
                          <p className={`text-xs font-medium ${
                            isDayMode ? 'text-emerald-800' : 'text-emerald-300'
                          }`}>Completed Tasks</p>
                          <p className={`text-lg font-bold ${
                            isDayMode ? 'text-emerald-900' : 'text-emerald-100'
                          }`}>{maintenanceData.completedTasks}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right Side - Vehicle Image with Dust Cloud Effect */}
          <div className="h-full flex items-center justify-center">
            <div className="relative">
              <div className="absolute top-4 left-4 z-10">
                <div className={`flex items-center space-x-2 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md transition-colors ${
                  isDayMode ? 'bg-white/90' : 'bg-slate-800/90'
                }`}>
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  <span className={`text-sm font-semibold transition-colors ${
                    isDayMode ? 'text-gray-800' : 'text-slate-200'
                  }`}>Vehicle Model - {vehicleDisplayName}</span>
                </div>
              </div>
              
              {/* Dust Cloud Effect - Positioned further back from the rear tire */}
              <div className="absolute bottom-16 left-2 w-8 h-8 bg-gray-300/40 rounded-full animate-dust-cloud pointer-events-none"></div>
              <div className="absolute bottom-14 left-4 w-6 h-6 bg-gray-400/30 rounded-full animate-dust-cloud pointer-events-none" style={{ animationDelay: '0.1s' }}></div>
              <div className="absolute bottom-12 left-6 w-4 h-4 bg-gray-500/20 rounded-full animate-dust-cloud pointer-events-none" style={{ animationDelay: '0.2s' }}></div>
              
              <img 
                src="/lovable-uploads/c487e5bb-48e6-445a-b39d-420af69511ae.png" 
                alt="Utility Vehicle"
                className="w-96 h-96 object-contain animate-slide-in-stop"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceDetails;
