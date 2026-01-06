import { Sun, Moon, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface HeaderProps {
  isDayMode?: boolean;
  setIsDayMode?: (dayMode: boolean) => void;
  showModeToggle?: boolean;
}

export const Header = ({ 
  isDayMode = true, 
  setIsDayMode, 
  showModeToggle = true 
}: HeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const isOnDashboard = location.pathname === '/dashboard';
  const isOnMaintenance = location.pathname.startsWith('/maintenance');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getUserInitials = () => {
    if (user?.username) {
      return user.username.substring(0, 2).toUpperCase();
    }
    return "U";
  };

  return (
    <Card className={`w-full rounded-none border-x-0 border-t-0 shadow-sm transition-all duration-500 ${
      isDayMode ? 'bg-white' : 'bg-slate-900 border-slate-700'
    }`}>
      <div className="flex items-center justify-between px-6 py-4">
        {/* Logo */}
        <div className="flex items-center space-x-2">
          <img src="/lovable-uploads/b658376d-bd36-4dc2-9144-3e35b28770ba.png" alt="TappTrack Logo" className="w-8 h-8" />
          <div>
            <h1 className={`text-xl font-bold transition-colors ${isDayMode ? 'text-gray-900' : 'text-white'}`}>
              TappTrack
            </h1>
          </div>
        </div>

        {/* Navigation Buttons and Day/Night Toggle - Right Side */}
        <div className="flex items-center space-x-6">
          {/* Navigation Buttons */}
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/dashboard')}
              className={`text-sm font-medium transition-all duration-300 pb-1 ${
                isOnDashboard
                  ? `border-b-2 border-blue-600 ${isDayMode ? 'text-blue-600' : 'text-blue-400'}`
                  : isDayMode 
                    ? 'text-gray-700 hover:text-blue-600' 
                    : 'text-slate-300 hover:text-blue-400'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => navigate('/maintenance')}
              className={`text-sm font-medium transition-all duration-300 pb-1 ${
                isOnMaintenance
                  ? `border-b-2 border-blue-600 ${isDayMode ? 'text-blue-600' : 'text-blue-400'}`
                  : isDayMode 
                    ? 'text-gray-700 hover:text-blue-600' 
                    : 'text-slate-300 hover:text-blue-400'
              }`}
            >
              Maintenance
            </button>
          </div>

          {/* Day/Night Toggle */}
          {showModeToggle && setIsDayMode && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDayMode(!isDayMode)}
              className={`rounded-full transition-all duration-300 hover:scale-110 ${
                isDayMode 
                  ? 'hover:bg-slate-100 text-slate-600' 
                  : 'hover:bg-slate-800 text-slate-300'
              }`}
              title={isDayMode ? "Switch to Night Mode" : "Switch to Day Mode"}
            >
              {isDayMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </Button>
          )}

          {/* User Menu */}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-10 w-10 rounded-full"
                >
                  <Avatar>
                    <AvatarFallback className={isDayMode ? 'bg-blue-100 text-blue-700' : 'bg-blue-900 text-blue-300'}>
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.username}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </Card>
  );
};
