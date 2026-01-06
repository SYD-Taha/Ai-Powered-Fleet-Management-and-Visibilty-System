# Frontend Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [File Structure](#file-structure)
4. [Technology Stack](#technology-stack)
5. [Core Components](#core-components)
6. [Pages](#pages)
7. [Services](#services)
8. [Hooks](#hooks)
9. [Contexts](#contexts)
10. [State Management](#state-management)
11. [Routing](#routing)
12. [Real-time Communication](#real-time-communication)
13. [Map Integration](#map-integration)
14. [Styling](#styling)
15. [Configuration](#configuration)
16. [Build & Deployment](#build--deployment)

---

## Overview

The Fleet Management System Frontend is a React-based single-page application (SPA) built with TypeScript, providing a comprehensive dashboard for fleet management, real-time vehicle tracking, fault dispatch, and maintenance management.

### Key Features
- **Real-time Dashboard**: Live vehicle tracking with interactive map
- **AI Dispatch System**: Automated vehicle assignment to faults (backend-controlled)
- **Interactive Map**: MapLibre GL-based map with vehicle and fault overlays
- **Real-time Updates**: WebSocket integration for live data synchronization
- **Authentication**: JWT-based authentication with protected routes
- **Maintenance Management**: Vehicle maintenance tracking and diagnostics
- **Day/Night Mode**: Theme switching with localStorage persistence
- **Responsive Design**: Mobile-friendly UI with Tailwind CSS
- **Alert System**: Real-time alerts for low fuel, critical faults, and dispatch status

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────┐
│              React Application                   │
│  ┌──────────────────────────────────────────┐  │
│  │  Pages (Routes)                           │  │
│  │  └─ Dashboard, Login, Signup, etc.        │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │  Components                               │  │
│  │  └─ Dashboard, Map, Sidebars, UI          │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │  Services                                 │  │
│  │  └─ API, WebSocket, Route, GPS Simulation │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │  Contexts & Hooks                         │  │
│  │  └─ AuthContext, useWebSocket, etc.       │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
┌─────────────────┐  ┌─────────────────┐
│  Backend API    │  │  WebSocket      │
│  (REST)         │  │  (Socket.io)    │
└─────────────────┘  └─────────────────┘
```

### Component Hierarchy

```
App
├── AuthProvider
│   └── Routes
│       ├── Index (redirect)
│       ├── Login
│       ├── Signup
│       ├── Dashboard (Protected)
│       │   ├── TopNavigation
│       │   ├── FleetSidebar
│       │   ├── MapArea
│       │   │   ├── InteractiveMap (MapLibre)
│       │   │   ├── VehicleOverlay
│       │   │   ├── FaultOverlay
│       │   │   ├── MapHeaderControls
│       │   │   ├── MapLegends
│       │   │   └── MapStatistics
│       │   └── DispatchSidebar
│       ├── MaintenanceEngine (Protected)
│       └── MaintenanceDetails (Protected)
└── Providers (QueryClient, TooltipProvider, Toasters)
```

---

## File Structure

```
Frontend/
├── public/                    # Static assets
│   ├── favicon.ico
│   ├── lovable-uploads/      # Image assets
│   └── robots.txt
│
├── src/
│   ├── main.tsx              # Application entry point
│   ├── App.tsx               # Root component with routing
│   ├── index.css             # Global styles
│   ├── vite-env.d.ts        # Vite type definitions
│   │
│   ├── pages/                # Page components
│   │   ├── Index.tsx         # Root redirect page
│   │   ├── Login.tsx         # Login page
│   │   ├── Signup.tsx        # Registration page
│   │   ├── Dashboard.tsx     # Main dashboard
│   │   ├── MaintenanceEngine.tsx    # Maintenance overview
│   │   ├── MaintenanceDetails.tsx   # Vehicle maintenance details
│   │   └── NotFound.tsx     # 404 page
│   │
│   ├── components/           # React components
│   │   ├── auth/
│   │   │   └── ProtectedRoute.tsx
│   │   ├── dashboard/
│   │   │   ├── TopNavigation.tsx
│   │   │   ├── FleetSidebar.tsx
│   │   │   ├── DispatchSidebar.tsx
│   │   │   ├── MapArea.tsx
│   │   │   ├── VehicleSelector.tsx
│   │   │   ├── AlertBar.tsx
│   │   │   └── map/
│   │   │       ├── InteractiveMap.tsx
│   │   │       ├── VehicleOverlay.tsx
│   │   │       ├── FaultOverlay.tsx
│   │   │       ├── MapHeaderControls.tsx
│   │   │       ├── MapLegends.tsx
│   │   │       ├── MapStatistics.tsx
│   │   │       ├── MapMarker.tsx
│   │   │       ├── useMapData.ts
│   │   │       ├── useMapFullscreen.ts
│   │   │       ├── mapConfig.ts
│   │   │       ├── mapUtils.ts
│   │   │       └── coordinateUtils.ts
│   │   ├── shared/
│   │   │   └── Header.tsx
│   │   └── ui/               # shadcn/ui components (50+ components)
│   │
│   ├── services/             # Business logic services
│   │   ├── api.ts            # Axios API client
│   │   ├── socketService.ts  # Socket.io client
│   │   ├── aiDispatchService.ts  # AI dispatch logic
│   │   ├── routeService.ts   # Route calculation
│   │   └── gpsSimulationService.ts  # GPS simulation
│   │
│   ├── contexts/             # React contexts
│   │   └── AuthContext.tsx   # Authentication context
│   │
│   ├── hooks/                # Custom React hooks
│   │   ├── useWebSocket.ts   # WebSocket hook
│   │   ├── use-mobile.tsx    # Mobile detection
│   │   └── use-toast.ts      # Toast notifications
│   │
│   ├── utils/                # Utility functions
│   │   └── validation.ts     # Form validation
│   │
│   └── lib/                  # Library utilities
│       └── utils.ts          # General utilities (cn, etc.)
│
├── package.json              # Dependencies
├── vite.config.ts           # Vite configuration
├── tsconfig.json            # TypeScript configuration
├── tailwind.config.ts        # Tailwind CSS configuration
├── postcss.config.js         # PostCSS configuration
├── components.json           # shadcn/ui configuration
├── eslint.config.js         # ESLint configuration
├── Dockerfile               # Docker configuration
└── README.md                # Project README
```

---

## Technology Stack

### Core Technologies
- **React 18.3.1**: UI library
- **TypeScript 5.5.3**: Type safety
- **Vite 5.4.1**: Build tool and dev server
- **React Router DOM 6.26.2**: Client-side routing

### UI Libraries
- **shadcn/ui**: Component library (Radix UI primitives)
- **Tailwind CSS 3.4.11**: Utility-first CSS framework
- **Lucide React 0.462.0**: Icon library
- **MapLibre GL 3.6.2**: Map rendering library

### State Management & Data Fetching
- **TanStack Query 5.56.2**: Server state management
- **React Context API**: Global state (Auth)
- **React Hooks**: Local component state

### Real-time Communication
- **Socket.io Client 4.7.5**: WebSocket client

### HTTP Client
- **Axios 1.12.2**: HTTP requests

### Form Management
- **React Hook Form 7.53.0**: Form handling
- **Zod 3.23.8**: Schema validation

### Additional Libraries
- **date-fns 3.6.0**: Date utilities
- **recharts 2.12.7**: Charts (if used)
- **sonner 1.5.0**: Toast notifications

---

## Core Components

### 1. App Component (`App.tsx`)

**Purpose**: Root component that sets up routing, providers, and global configuration.

**Key Features**:
- React Router setup
- QueryClient provider
- AuthProvider wrapper
- Tooltip provider
- Toast providers (Toaster, Sonner)
- Route definitions with protected routes

**Routes**:
- `/` - Index (redirects based on auth)
- `/login` - Login page
- `/signup` - Registration page
- `/dashboard` - Main dashboard (protected)
- `/maintenance` - Maintenance overview (protected)
- `/maintenance/:vehicleId` - Vehicle details (protected)
- `*` - 404 page

---

### 2. Dashboard Component (`pages/Dashboard.tsx`)

**Purpose**: Main application dashboard with map, sidebars, and controls.

**Key Features**:
- Day/night mode toggle (localStorage persistence)
- Fleet sidebar (collapsible)
- Map area with interactive map
- Dispatch sidebar (collapsible)
- Real-time data synchronization
- Vehicle and fault state management

**State Management**:
- `isDayMode`: Theme state
- `isFleetSidebarExpanded`: Sidebar visibility
- `isDispatchSidebarExpanded`: Sidebar visibility
- `isPlaying`: Animation play/pause (future)
- `speed`: Animation speed (future)
- `vehicles`: Vehicle data array
- `faults`: Fault data array

---

### 3. InteractiveMap Component (`components/dashboard/map/InteractiveMap.tsx`)

**Purpose**: MapLibre GL map wrapper with context provider.

**Key Features**:
- MapLibre GL initialization
- OpenStreetMap tile source
- Karachi center coordinates (67.0039, 24.8615)
- Performance optimizations:
  - Reduced max zoom (19)
  - Disabled world copies
  - Increased tile cache (50)
  - Disabled fade animation
- Map context for child components
- Day/night mode support (future)

**Map Configuration**:
- Center: Karachi [67.0039, 24.8615]
- Initial Zoom: 11
- Tile Source: OpenStreetMap
- Attribution: © OpenStreetMap contributors

---

### 4. MapArea Component (`components/dashboard/MapArea.tsx`)

**Purpose**: Container for map and overlays with controls.

**Key Features**:
- Map container with fullscreen support
- Vehicle overlay (markers)
- Fault overlay (markers with dispatch buttons)
- Map header controls
- Map legends
- Map statistics
- Data update callback to parent

**Sub-components**:
- `InteractiveMap`: Base map
- `VehicleOverlay`: Vehicle markers
- `FaultOverlay`: Fault markers
- `MapHeaderControls`: Zoom, fullscreen controls
- `MapLegends`: Status legends
- `MapStatistics`: Real-time statistics

---

### 5. FleetSidebar Component (`components/dashboard/FleetSidebar.tsx`)

**Purpose**: Vehicle list and fleet statistics sidebar.

**Key Features**:
- Fleet statistics (total, available, dispatched, working, idle)
- Search functionality
- Status filters (checkboxes)
- Vehicle list with status indicators
- Collapsible sidebar
- Day/night mode support

**Statistics Displayed**:
- Total Vehicles
- Available count
- Dispatched count
- Working count
- Idle count

**Vehicle Information**:
- Vehicle number/ID
- Status badge
- Type badge
- Fuel level
- Expertise level
- Fatigue level

---

### 6. DispatchSidebar Component (`components/dashboard/DispatchSidebar.tsx`)

**Purpose**: AI dispatch system monitoring and fault queue sidebar.

**Key Features**:
- AI dispatch status toggle (active/inactive) - **Note**: This is a UI toggle only; actual dispatch is controlled by backend
- Live dispatch logs (last 20 entries)
- Active fault queue display
- ETA calculations based on route data
- Priority indicators
- Status icons
- Real-time fault and vehicle status updates

**Dispatch Logs**:
- Timestamp
- Action description
- Vehicle ID
- Fault ID
- Location
- ETA (calculated from route duration or Haversine distance)
- Priority (critical/high/medium/low)
- Status (success/pending/failed)

**Fault Queue**:
- Fault description
- Location (mapped from coordinates)
- Severity badge
- Assigned vehicle (if any)
- ETA (if assigned)
- Status indicators

**Note**: All dispatch logic is handled by the backend. The frontend only displays dispatch status and logs. The AI toggle in the UI is for display purposes; the backend controls actual dispatch behavior.

---

### 7. Login Component (`pages/Login.tsx`)

**Purpose**: User authentication login page.

**Key Features**:
- Email/password form
- Form validation
- Error handling with toast notifications
- Auto-redirect if authenticated
- Link to signup page
- Loading states
- Responsive design

**Validation**:
- Email format validation
- Password required
- Backend error display

---

### 8. Signup Component (`pages/Signup.tsx`)

**Purpose**: User registration page.

**Key Features**:
- Username, email, password, confirm password, and role fields
- Real-time validation:
  - Username format (3-30 chars, alphanumeric + _-, cannot start/end with _-)
  - Email format (max 320 chars)
  - Password strength (8+ chars, uppercase, lowercase, number, special char)
  - Password match confirmation
- Password strength indicator
- Password requirements checklist
- Visual feedback (green/red borders)
- Toast notifications
- Auto-redirect to login after registration

**Password Requirements**:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

**Role Selection**:
- Users must select a role during registration (admin, dispatcher, viewer)
- Role determines access permissions in the application

### 9. AlertBar Component (`components/dashboard/AlertBar.tsx`)

**Purpose**: Real-time alert notifications bar at the top of the dashboard.

**Key Features**:
- Dynamic alert generation based on vehicle and fault states
- Auto-rotating alerts (4-second intervals)
- Alert types: critical, warning, success, info
- Dismissible alerts
- Visual indicators (icons, badges, colors)

**Alert Types**:
- **Low Fuel**: Vehicles with fuel level < 20%
- **Critical Faults**: Unassigned critical faults with no available vehicles
- **Idle Vehicles**: More than 3 idle vehicles
- **Successful Dispatches**: Active dispatches with ETA
- **System Status**: General operational status

### 10. MapMarker Component (`components/dashboard/map/MapMarker.tsx`)

**Purpose**: Reusable marker component for map overlays.

**Key Features**:
- Converts lat/lng coordinates to map pixel positions
- Handles map transformations and zoom levels
- Provides consistent marker positioning
- Used by both VehicleOverlay and FaultOverlay

### 11. ProtectedRoute Component (`components/auth/ProtectedRoute.tsx`)

**Purpose**: Route guard for authenticated routes.

**Key Features**:
- Checks authentication status from AuthContext
- Shows loading spinner while checking
- Redirects to login if not authenticated
- Renders children if authenticated

---

## Pages

### Dashboard (`pages/Dashboard.tsx`)
Main application interface with map and sidebars.

### Login (`pages/Login.tsx`)
User authentication page.

### Signup (`pages/Signup.tsx`)
User registration page with validation.

### Index (`pages/Index.tsx`)
Root page that redirects based on authentication status.

### MaintenanceEngine (`pages/MaintenanceEngine.tsx`)
Maintenance overview page showing all vehicles with maintenance status.

**Features**:
- Vehicle grid display
- Maintenance score indicators
- Next maintenance dates
- Critical/warning issues
- Navigation to vehicle details

### MaintenanceDetails (`pages/MaintenanceDetails.tsx`)
Individual vehicle maintenance details page.

**Features**:
- Maintenance schedule
- Performance metrics (fuel efficiency, engine health, etc.)
- System status (coolant, oil pressure)
- Issues and tasks
- Vehicle image display

### NotFound (`pages/NotFound.tsx`)
404 error page.

---

## Services

### 1. API Service (`services/api.ts`)

**Purpose**: Axios-based HTTP client for backend API communication.

**Key Features**:
- Base URL configuration (with Docker service name handling)
- Request interceptor (JWT token injection)
- Response interceptor (error handling)
- API functions:
  - `getVehicles()`: Fetch all vehicles
  - `getVehicleLocation(vehicleId)`: Get latest GPS for vehicle
  - `getFaults()`: Fetch all faults
  - `login(credentials)`: User login
  - `register(credentials)`: User registration

**Configuration**:
- Environment variable: `VITE_API_URL`
- Default: `http://localhost:5000`
- Docker service name replacement (backend:5000 → localhost:5000)

---

### 2. Socket Service (`services/socketService.ts`)

**Purpose**: Socket.io client initialization and management.

**Key Features**:
- Singleton socket instance
- Auto-reconnection with exponential backoff
- Connection event handlers
- Error handling
- URL configuration (same as API service)

**Functions**:
- `initializeSocket()`: Create socket connection
- `getSocket()`: Get socket instance
- `disconnectSocket()`: Disconnect socket

**Connection Settings**:
- Transports: websocket, polling
- Reconnection: enabled
- Reconnection delay: 1000ms
- Max reconnection delay: 5000ms
- Reconnection attempts: Infinity
- Timeout: 20000ms

---

### 3. AI Dispatch Service (`services/aiDispatchService.ts`)

**Purpose**: Client-side dispatch logging and status display (dispatch logic is handled by backend).

**Key Features**:
- Singleton service instance
- Dispatch log management (last 20 entries)
- AI status toggle (UI only - backend controls actual dispatch)
- ETA calculations
- Location name mapping
- Dispatch event logging

**Functions**:
- `getDispatchLogs()`: Get dispatch history
- `isAIActive()`: Check AI status (UI state only)
- `toggleAI()`: Toggle AI status (UI state only)
- `manualDispatch()`: **DEPRECATED** - Not used, kept for logging compatibility
- `autoDispatch()`: **DEPRECATED** - Disabled, backend handles all dispatch

**Important Notes**:
- **All dispatch logic is handled by the backend**
- Frontend only displays dispatch status and logs
- The `manualDispatch` and `autoDispatch` methods are deprecated and do not perform actual dispatch
- Dispatch events are received via WebSocket from the backend
- The AI toggle in the UI is for display purposes only

---

### 4. Route Service (`services/routeService.ts`)

**Purpose**: Route calculation using backend API (OSRM proxy).

**Key Features**:
- Route caching (5-minute TTL)
- Backend API proxy (avoids CORS)
- Haversine fallback on error
- Distance and duration calculation

**Functions**:
- `calculateRoute(fromLat, fromLng, toLat, toLng)`: Calculate route
- `clearRouteCache()`: Clear cache
- `clearExpiredRouteCache()`: Remove expired entries

**Route Data Structure**:
```typescript
{
  waypoints: [number, number][];  // [lat, lng] pairs
  distance: number;              // meters
  duration: number;              // seconds
  isFallback?: boolean;
  calculatedAt?: number;
  source?: 'osrm' | 'haversine';
}
```

---

### 5. GPS Simulation Service (`services/gpsSimulationService.ts`)

**Purpose**: Simulates vehicle movement along routes and sends GPS updates.

**Key Features**:
- Position calculation along route (time-based)
- GPS update sending to backend
- Haversine distance calculation
- Speed simulation (60 km/h default)

**Functions**:
- `calculateCurrentPosition(routeWaypoints, routeStartTime, routeTotalDistance)`: Calculate position
- `sendGPSUpdate(vehicleId, latitude, longitude, speed)`: Send GPS to backend

**Simulation Parameters**:
- Default speed: 16.67 m/s (60 km/h)
- Speed range: 13.89-19.44 m/s (50-70 km/h)
- Update interval: Controlled by parent component

---

## Hooks

### 1. useWebSocket Hook (`hooks/useWebSocket.ts`)

**Purpose**: React hook for WebSocket event handling.

**Key Features**:
- Automatic connection on mount
- Event handler registration
- Connection status tracking
- Cleanup on unmount

**Event Handlers**:
- `onVehicleGPSUpdate`: GPS coordinate updates
- `onVehicleStatusChange`: Vehicle status changes
- `onVehicleUpdate`: General vehicle updates
- `onFaultCreated`: New fault creation
- `onFaultUpdated`: Fault status updates
- `onFaultDispatched`: Fault dispatch events
- `onDispatchComplete`: Dispatch completion
- `onVehicleConfirmation`: Driver confirmation
- `onVehicleResolved`: Fault resolution
- `onVehicleArrived`: Vehicle arrival at fault
- `onRouteUpdated`: Route recalculation

**Return Value**:
```typescript
{
  socket: Socket | null;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
}
```

---

### 2. useMapData Hook (`components/dashboard/map/useMapData.ts`)

**Purpose**: Manages vehicle and fault data with real-time updates.

**Key Features**:
- Data fetching from API
- WebSocket integration
- Route calculation on dispatch
- GPS simulation for vehicles on route
- Vehicle animation along routes
- Fault auto-generation (testing)
- Polling fallback (if WebSocket fails)

**State Management**:
- `vehicles`: Vehicle array
- `faults`: Fault array
- `lastFaultTime`: Fault generation timing

**Key Functions**:
- `handleManualDispatch(vehicleId, faultId)`: **DEPRECATED** - Calls backend dispatch engine (not true manual dispatch)
- Route calculation and assignment (triggered by backend WebSocket events)
- GPS update simulation for vehicles on routes
- Status synchronization via WebSocket
- Vehicle position animation along routes

---

### 3. useMapFullscreen Hook (`components/dashboard/map/useMapFullscreen.ts`)

**Purpose**: Fullscreen map functionality.

**Key Features**:
- Fullscreen toggle
- Map container ref
- Fullscreen state tracking

---

## Contexts

### AuthContext (`contexts/AuthContext.tsx`)

**Purpose**: Global authentication state management.

**Key Features**:
- User state (username, email, role)
- Token management (localStorage)
- Login/logout functions
- Registration function
- Loading state
- Auto-load from localStorage on mount

**Context Value**:
```typescript
{
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}
```

**Storage**:
- `authToken`: JWT token
- `authUser`: User object (JSON)

---

## State Management

### Global State
- **AuthContext**: Authentication state (user, token)
- **React Query**: Server state caching (if used)

### Local State
- **Component State**: useState hooks for component-specific data
- **Refs**: useRef for mutable values and DOM references

### State Flow

```
Backend API/WebSocket
         │
         ▼
    Services Layer
         │
         ▼
    Hooks/Contexts
         │
         ▼
    Components
         │
         ▼
    UI Updates
```

---

## Routing

### Route Configuration (`App.tsx`)

**Public Routes**:
- `/` - Index (redirect)
- `/login` - Login page
- `/signup` - Registration page

**Protected Routes** (require authentication):
- `/dashboard` - Main dashboard
- `/maintenance` - Maintenance overview
- `/maintenance/:vehicleId` - Vehicle details

**Catch-all**:
- `*` - 404 page

### Route Protection
- `ProtectedRoute` component wraps protected routes
- Checks `isAuthenticated` from AuthContext
- Redirects to `/login` if not authenticated
- Shows loading spinner during auth check

---

## Real-time Communication

### WebSocket Events

**Vehicle Events**:
- `vehicle:gps-update`: GPS coordinate updates
- `vehicle:status-change`: Status changes (available, onRoute, working)
- `vehicle:update`: General vehicle updates
- `vehicle:confirmation`: Driver confirmation
- `vehicle:resolved`: Fault resolution
- `vehicle:arrived`: Arrival at fault location

**Fault Events**:
- `fault:created`: New fault creation
- `fault:updated`: Fault status updates
- `fault:dispatched`: Fault dispatch events

**Dispatch Events**:
- `dispatch:complete`: Dispatch completion with results

**Route Events**:
- `route:updated`: Route recalculation (deviation detected)

### Event Flow

```
Backend Event
     │
     ▼
Socket.io Server
     │
     ▼
Socket.io Client (Frontend)
     │
     ▼
useWebSocket Hook
     │
     ▼
Component State Update
     │
     ▼
UI Re-render
```

---

## Map Integration

### MapLibre GL Setup

**Initialization**:
- Container: `div` with ref
- Style: OpenStreetMap raster tiles
- Center: Karachi [67.0039, 24.8615]
- Zoom: 11
- Performance optimizations enabled

**Overlays**:
- **VehicleOverlay**: Vehicle markers with status colors
- **FaultOverlay**: Fault markers with severity indicators

**Map Features**:
- Zoom controls
- Fullscreen toggle
- Day/night mode (future)
- Legend display
- Statistics overlay

### Vehicle Animation

**Route-based Animation**:
- Calculates position along route based on elapsed time
- Uses route start time and total distance
- Default speed: 60 km/h (16.67 m/s)
- Smooth interpolation between waypoints
- GPS updates sent to backend every 3 seconds

**Position Calculation**:
```typescript
elapsedTime = (Date.now() - routeStartTime) / 1000
distanceTraveled = elapsedTime * speed
position = interpolateAlongRoute(routeWaypoints, distanceTraveled)
```

---

## Styling

### Tailwind CSS
- Utility-first CSS framework
- Custom configuration in `tailwind.config.ts`
- Dark mode support (via day/night mode toggle)

### shadcn/ui Components
- Pre-built accessible components
- Radix UI primitives
- Customizable with Tailwind
- 50+ components available

### Day/Night Mode
- Toggle in TopNavigation
- Persisted in localStorage
- Applied via conditional classes
- Smooth transitions (500ms)

### Color Scheme

**Day Mode**:
- Background: `bg-slate-50` / `bg-white`
- Text: `text-gray-900`
- Borders: `border-gray-200`

**Night Mode**:
- Background: `bg-slate-900` / `bg-slate-800`
- Text: `text-white` / `text-slate-200`
- Borders: `border-slate-700`

---

## Configuration

### Environment Variables

```env
# Backend API URL
VITE_API_URL=http://localhost:5000

# For Docker deployment
VITE_API_URL=http://backend:5000
```

### Vite Configuration (`vite.config.ts`)

**Key Settings**:
- Port: 5173
- Host: 0.0.0.0 (Docker compatibility)
- Path alias: `@` → `./src`
- React plugin: SWC (fast compilation)
- Component tagger: Development mode only

### TypeScript Configuration

**Files**:
- `tsconfig.json`: Main config
- `tsconfig.app.json`: App-specific
- `tsconfig.node.json`: Node-specific

**Key Settings**:
- Strict mode enabled
- Path aliases configured
- React JSX support

---

## Build & Deployment

### Development

```bash
npm install
npm run dev
```

**Dev Server**:
- URL: `http://localhost:5173`
- Hot Module Replacement (HMR)
- Fast refresh

### Production Build

```bash
npm run build
```

**Output**:
- `dist/` directory
- Optimized and minified
- Code splitting
- Asset optimization

### Docker Deployment

**Dockerfile**:
- Node.js 18 base image
- Multi-stage build
- Nginx for serving static files (if configured)

**Build Command**:
```bash
docker build -t frontend .
```

### Build Scripts

- `dev`: Start development server
- `build`: Production build
- `build:dev`: Development build
- `preview`: Preview production build
- `lint`: Run ESLint

---

## Data Flow

### Vehicle Data Flow

```
Backend API
    │
    ▼
getVehicles() (API service)
    │
    ▼
useMapData hook
    │
    ▼
vehicles state
    │
    ▼
VehicleOverlay component
    │
    ▼
Map markers
```

### Fault Data Flow

```
Backend API / WebSocket
    │
    ▼
getFaults() / fault:created event
    │
    ▼
useMapData hook
    │
    ▼
faults state
    │
    ▼
FaultOverlay component
    │
    ▼
Map markers + dispatch buttons
```

### Dispatch Flow

```
Backend Auto-Dispatch (on fault creation or periodic)
    │
    ▼
Backend processes dispatch
    │
    ├─► Selects best vehicle (rule-based or ML)
    ├─► Updates fault status: "pending_confirmation"
    ├─► Updates vehicle status: "onRoute"
    ├─► Sends MQTT alert to hardware device
    └─► Emits WebSocket: fault:dispatched
         │
         ▼
    useWebSocket hook (Frontend)
         │
         ▼
    Route calculation (Frontend)
         │
         ▼
    Vehicle status updated: "onRoute"
         │
         ▼
    GPS simulation starts (Frontend)
         │
         ▼
    Vehicle animates along route
         │
         ▼
    GPS updates sent to backend every 3 seconds
         │
         ▼
    Backend detects arrival (within 50m)
         │
         ▼
    WebSocket: vehicle:arrived
         │
         ▼
    Vehicle status: "working"
         │
         ▼
    Auto-resolution timer starts (30s)
         │
         ▼
    WebSocket: vehicle:resolved (or MQTT resolution)
         │
         ▼
    Vehicle status: "available"
```

**Note**: All dispatch decisions are made by the backend. The frontend only:
- Displays dispatch status
- Calculates and displays routes
- Animates vehicle movement
- Sends GPS simulation updates

---

## Key Features Implementation

### 1. Real-time Updates

**WebSocket Integration**:
- Automatic connection on app load
- Event handlers in `useWebSocket` hook
- State updates trigger re-renders
- Fallback to polling if WebSocket fails
- Handles all backend events: vehicle updates, fault updates, dispatch events, route updates

### 2. Route Calculation

**Process**:
1. Backend dispatches vehicle to fault (automatic)
2. Frontend receives `fault:dispatched` or `vehicle:status-change` WebSocket event
3. Frontend calculates route via backend API (`GET /api/routes/calculate`)
4. Backend proxies to OSRM or uses Haversine fallback
5. Route data returned with waypoints, distance, duration
6. Frontend stores route data in vehicle state
7. Vehicle animates along route using position interpolation
8. GPS updates sent to backend every 3 seconds during animation
9. Backend may recalculate route if deviation detected (>200m and >500m from destination)
10. Frontend receives `route:updated` event and updates route

### 3. GPS Simulation

**Implementation**:
- Calculates position based on elapsed time from route start
- Uses route waypoints and total distance
- Interpolates between waypoint segments using Haversine distance
- Default speed: 60 km/h (16.67 m/s) for animation
- Sends GPS updates to backend API every 3 seconds
- Updates vehicle marker position on map in real-time
- Stops GPS updates when vehicle reaches destination (within 50m)
- Handles route recalculation by updating routeStartTime

### 4. Backend-Controlled Dispatch

**Process**:
1. Backend automatically dispatches when faults are created
2. Backend runs periodic dispatch engine (`POST /api/dispatch/run`)
3. Backend selects best vehicle using rule-based or ML algorithm
4. Backend emits WebSocket event: `fault:dispatched`
5. Frontend receives event and calculates route for display
6. Frontend updates vehicle status to "onRoute"
7. Frontend starts GPS simulation and route animation

**AI Toggle**:
- UI toggle exists but is for display purposes only
- Backend controls actual dispatch behavior
- When backend dispatch is active, faults are automatically assigned
- Frontend displays dispatch logs and status
- All dispatch decisions are made server-side

---

## Performance Optimizations

### 1. Route Caching
- 5-minute TTL for route calculations
- Reduces API calls for same routes

### 2. Map Performance
- Reduced max zoom (19)
- Disabled world copies
- Increased tile cache (50)
- Disabled fade animations
- Crisp rendering mode

### 3. Component Optimization
- React.memo for expensive components (if needed)
- useMemo for computed values
- useCallback for event handlers
- Lazy loading for routes (future)

### 4. State Management
- Local state for component-specific data
- Context only for global auth state
- Refs for mutable values
- Minimal re-renders

---

## Error Handling

### API Errors
- Axios interceptors catch errors
- Toast notifications for user feedback
- Console logging for debugging
- Graceful degradation

### WebSocket Errors
- Auto-reconnection on disconnect
- Connection status indicators
- Fallback to polling if WebSocket fails
- Error logging

### Validation Errors
- Real-time form validation
- Visual feedback (red/green borders)
- Error messages below inputs
- Prevents invalid submissions

---

## Testing Considerations

### Manual Testing
- Login/logout flow
- Vehicle dispatch
- Map interactions
- Real-time updates
- Route calculation
- GPS simulation

### Future Testing
- Unit tests (Jest/Vitest)
- Component tests (React Testing Library)
- E2E tests (Playwright/Cypress)
- Integration tests

---

## Known Limitations

1. **Route Animation**: Currently uses fixed speed (60 km/h)
2. **GPS Updates**: Fixed 3-second interval
3. **Map Tiles**: OpenStreetMap only (no dark mode tiles)
4. **Error Recovery**: Basic retry logic
5. **Offline Support**: Limited (no service worker)

---

## Future Enhancements

1. **Advanced Route Options**:
   - Multiple waypoints
   - Route preferences (fastest, shortest)
   - Traffic integration

2. **Enhanced Map Features**:
   - Dark mode map tiles
   - Custom map styles
   - 3D buildings
   - Terrain view

3. **Performance Improvements**:
   - Virtual scrolling for vehicle lists
   - Route caching improvements
   - Lazy loading for components
   - Code splitting optimization

4. **Additional Features**:
   - Vehicle history tracking
   - Analytics dashboard
   - Export functionality
   - Mobile app (React Native)

---

## Troubleshooting

### Common Issues

1. **WebSocket Not Connecting**:
   - Check backend URL configuration
   - Verify backend is running
   - Check browser console for errors
   - Verify CORS settings

2. **Map Not Loading**:
   - Check internet connection (tiles)
   - Verify MapLibre GL CSS imported
   - Check browser console for errors
   - Verify container ref is set

3. **Routes Not Calculating**:
   - Check backend API availability
   - Verify coordinates are valid
   - Check network tab for API errors
   - Verify route service is working

4. **Authentication Issues**:
   - Check localStorage for token
   - Verify token expiration
   - Check backend JWT secret
   - Clear localStorage and re-login

---

---

## Component Details

### MapMarker Component

**Purpose**: Reusable marker wrapper that handles coordinate-to-pixel conversion for MapLibre GL.

**Usage**: Used by VehicleOverlay and FaultOverlay to position markers correctly on the map.

**Features**:
- Converts lat/lng to map pixel coordinates
- Handles map transformations
- Updates position on map move/zoom
- Provides consistent marker rendering

### AlertBar Component

**Purpose**: Displays real-time system alerts at the top of the dashboard.

**Alert Generation**:
- Low fuel alerts (< 20%)
- Critical fault alerts (no available vehicles)
- Idle vehicle warnings (> 3 idle)
- Successful dispatch notifications
- System status messages

**Features**:
- Auto-rotating alerts (4-second intervals)
- Dismissible alerts
- Color-coded by type (critical/warning/success/info)
- Icon indicators

### TopNavigation Component

**Purpose**: Top navigation bar with theme toggle and user controls.

**Features**:
- Day/night mode toggle
- User menu (if implemented)
- Navigation links
- Theme persistence (localStorage)

---

## Important Notes

### Dispatch System

**Backend-Controlled Dispatch**:
- All dispatch logic is handled by the backend
- Frontend only displays dispatch status and logs
- The `runDispatchEngine()` API call triggers backend's automatic dispatch
- There is no true "manual dispatch" - the frontend cannot directly assign vehicles to faults
- The AI toggle in DispatchSidebar is for UI display only

### Route Management

**Route Calculation**:
- Routes are calculated by frontend for display purposes
- Backend may recalculate routes if vehicle deviates (>200m deviation and >500m from destination)
- Frontend receives `route:updated` events and updates the displayed route
- Route animation uses `routeStartTime` to calculate current position

### GPS Simulation

**Simulation Details**:
- GPS updates are simulated for vehicles on routes
- Updates sent every 3 seconds to backend
- Position calculated based on elapsed time and route waypoints
- Simulation stops when vehicle reaches destination (within 50m)
- Real GPS data from hardware devices overrides simulation

### WebSocket Events

**Event Handling**:
- All backend events are handled via WebSocket
- Events trigger state updates in components
- Fallback to polling if WebSocket connection fails
- Connection status is tracked and displayed

---

**Documentation Version**: 2.0  
**Last Updated**: 2025-01-XX  
**Status**: ✅ Complete and Verified

