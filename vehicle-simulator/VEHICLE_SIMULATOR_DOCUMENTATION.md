# Vehicle Simulator Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Components](#components)
4. [Workflows](#workflows)
5. [Configuration](#configuration)
6. [MQTT Communication](#mqtt-communication)
7. [API Integration](#api-integration)
8. [Route Calculation](#route-calculation)
9. [GPS Simulation](#gps-simulation)
10. [Deployment](#deployment)
11. [Troubleshooting](#troubleshooting)

---

## Overview

The Vehicle Simulator is a Node.js application that simulates vehicle movement and GPS tracking for the Fleet Management System. It acts as a hardware device simulator, sending GPS updates and responding to dispatch events from the backend AI dispatch engine.

### Key Features
- **Real-time GPS Simulation**: Simulates vehicle movement along calculated routes
- **Backend Integration**: Polls backend for dispatch assignments and updates vehicle status
- **MQTT Communication**: Publishes GPS data and status updates via MQTT
- **Route Calculation**: Calculates routes using OSRM (with Haversine fallback)
- **Automatic Dispatch Handling**: Detects and processes backend AI dispatch assignments
- **Status Synchronization**: Keeps vehicle status synchronized with backend

### Purpose
- **Development/Testing**: Simulate vehicle behavior without physical hardware
- **Demo/Prototype**: Demonstrate system functionality with realistic vehicle movement
- **Hardware Replacement**: Act as a software replacement for ESP32/Arduino devices
- **Integration Testing**: Test backend dispatch logic and GPS tracking

### Technology Stack
- **Runtime**: Node.js (ES Modules)
- **HTTP Client**: Axios
- **MQTT Client**: mqtt (v5.3.0)
- **Configuration**: dotenv

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Vehicle Simulator (Node.js)                 │
│  ┌──────────────────────────────────────────────────┐  │
│  │  VehicleSimulator (Main Controller)               │  │
│  │  - Vehicle state management                      │  │
│  │  - GPS update loop (3s interval)                │  │
│  │  - Dispatch polling loop (5s interval)          │  │
│  │  - Route calculation & movement                  │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  APIClient (Backend Communication)               │  │
│  │  - Vehicle fetching                               │  │
│  │  - GPS updates (POST /api/gps)                   │  │
│  │  - Status updates (PUT /api/vehicles/:id)        │  │
│  │  - Dispatch polling (GET /api/faults)            │  │
│  │  - Auto-login support                            │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  MQTTPublisher (MQTT Communication)              │  │
│  │  - GPS publishing (vehicle/{number}/gps)         │  │
│  │  - Status publishing (vehicle/{number}/status)   │  │
│  │  - Resolution publishing (vehicle/{number}/resolved)│
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  RoutingService (Route Calculation)              │  │
│  │  - OSRM route calculation                       │  │
│  │  - Haversine fallback                            │  │
│  │  - Route caching (5 min TTL)                    │  │
│  └──────────────────────────────────────────────────┘  │
└───────────────────────┬──────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
┌───────────────┐              ┌───────────────┐
│  Backend API  │              │  MQTT Broker  │
│  (REST)       │              │  (HiveMQ)     │
└───────────────┘              └───────────────┘
```

### Component Interaction Flow

```
Initialization
    │
    ├─► APIClient.autoLogin() → Get auth token
    ├─► MQTTPublisher.connect() → Connect to MQTT
    ├─► APIClient.getVehicles() → Fetch all vehicles
    └─► Initialize vehicle state (GPS positions, status)
    
Main Loop (Running)
    │
    ├─► GPS Update Loop (every 3s)
    │   ├─► For each vehicle with route:
    │   │   ├─► Move to next waypoint
    │   │   ├─► Calculate speed & heading
    │   │   ├─► MQTTPublisher.publishGPS()
    │   │   └─► APIClient.sendGPS()
    │   └─► Check if arrived at destination
    │
    └─► Dispatch Polling Loop (every 5s)
        ├─► APIClient.getDispatchedFaults()
        ├─► For each dispatched fault:
        │   ├─► Check if vehicle is available
        │   ├─► Calculate route to fault
        │   ├─► Update vehicle status to 'onRoute'
        │   └─► Start GPS movement
        └─► Mark fault as processed
```

---

## Components

### 1. VehicleSimulator (`services/vehicleSimulator.js`)

**Purpose**: Main controller that manages vehicle state and simulation loops.

**Key Responsibilities**:
- Vehicle state management (position, status, routes)
- GPS update loop (3-second intervals)
- Dispatch polling loop (5-second intervals)
- Route calculation and waypoint navigation
- Arrival detection and work completion
- Status synchronization with backend

**State Management**:
```javascript
vehicle = {
  id: string,                    // Vehicle ObjectId
  vehicle_number: string,        // Vehicle identifier
  status: string,                // available|onRoute|working
  currentLat: number,            // Current GPS latitude
  currentLng: number,            // Current GPS longitude
  depotLat: number,              // Home depot latitude
  depotLng: number,              // Home depot longitude
  depotName: string,             // Depot name
  assignedFault: string|null,    // Assigned fault ID
  currentRoute: object|null,      // Route object with waypoints
  waypointIndex: number,          // Current waypoint index
  speed: number,                 // Current speed (km/h)
  heading: number                // Current heading (degrees)
}
```

**Key Methods**:
- `initialize()`: Fetch vehicles, initialize state, connect MQTT
- `start()`: Start GPS and dispatch polling loops
- `updateAllVehicles()`: Update positions for all vehicles on routes
- `moveVehicleAlongRoute(vehicle)`: Move vehicle to next waypoint
- `handleArrival(vehicle)`: Process arrival at fault location
- `completeWork(vehicle)`: Complete work and reset vehicle
- `checkForDispatches()`: Poll backend for new dispatch assignments
- `stop()`: Graceful shutdown

---

### 2. APIClient (`services/apiClient.js`)

**Purpose**: HTTP client for backend API communication.

**Key Features**:
- Automatic authentication (auto-login)
- Token refresh on 401 errors
- Retry logic with exponential backoff
- Error handling and logging

**Methods**:
- `autoLogin()`: Automatic login using credentials from config
- `login(email, password)`: Manual login
- `refreshTokenIfNeeded()`: Refresh token on authentication errors
- `getVehicles()`: Fetch all vehicles from backend
- `updateVehicleStatus(vehicleId, status)`: Update vehicle status
- `sendGPS(vehicleId, gpsData)`: Send GPS coordinates to backend
- `getDispatchedFaults(vehicleIds)`: Poll for faults assigned to vehicles

**Authentication Flow**:
```
1. Check if AUTH_TOKEN exists in config
   ├─► Yes → Use token directly
   └─► No → Check for AUTH_EMAIL and AUTH_PASSWORD
       ├─► Yes → Auto-login to get token
       └─► No → Continue without auth (may fail if backend requires auth)
```

---

### 3. MQTTPublisher (`services/mqttPublisher.js`)

**Purpose**: MQTT client for publishing GPS and status updates.

**Key Features**:
- Secure MQTT connection (TLS)
- Message queuing when disconnected
- Auto-reconnection
- QoS level 1 (at least once delivery)

**MQTT Topics**:
- `vehicle/{vehicle_number}/gps` - GPS coordinate updates
- `vehicle/{vehicle_number}/status` - Status updates
- `vehicle/{vehicle_number}/resolved` - Fault resolution messages

**Message Formats**:

**GPS Message**:
```json
{
  "latitude": 24.8607,
  "longitude": 67.0011,
  "speed": 40,
  "heading": 45.5,
  "timestamp": "2025-01-XXT12:00:00.000Z"
}
```

**Status Message**:
```json
{
  "status": "onRoute|working|available",
  "timestamp": "2025-01-XXT12:00:00.000Z"
}
```

**Resolution Message**:
```json
{
  "resolved": true,
  "fault_id": "fault_object_id",
  "timestamp": "2025-01-XXT12:00:00.000Z"
}
```

---

### 4. RoutingService (`services/routingService.js`)

**Purpose**: Route calculation using OSRM with Haversine fallback.

**Key Features**:
- OSRM route calculation (public API)
- Haversine fallback on OSRM failure
- Route caching (5-minute TTL)
- Consistent format with backend routing service

**Methods**:
- `calculateRoute(start, end)`: Calculate route between coordinates
- `calculateDistance(lat1, lon1, lat2, lon2)`: Haversine distance
- `calculateBearing(start, end)`: Calculate heading/bearing

**Route Data Structure**:
```javascript
{
  distance: number,              // meters
  duration: number,              // seconds
  waypoints: [[lat, lng], ...],  // Array of [lat, lng] pairs
  summary: string,               // Human-readable summary
  isFallback: boolean,           // true if Haversine fallback
  calculatedAt: number,          // Timestamp
  source: 'osrm' | 'haversine'   // Route source
}
```

**Cache Strategy**:
- Cache key: `${start.lat},${start.lng}_${end.lat},${end.lng}`
- TTL: 5 minutes (matching backend)
- Automatic cache expiration

---

### 5. Configuration (`config/config.js`)

**Purpose**: Centralized configuration management.

**Configuration Options**:

```javascript
{
  // Backend API
  BACKEND_URL: 'http://localhost:5000',
  AUTH_TOKEN: '',                    // Optional: JWT token
  AUTH_EMAIL: '',                    // Optional: For auto-login
  AUTH_PASSWORD: '',                 // Optional: For auto-login
  
  // MQTT Settings
  MQTT_BROKER: 'broker.hivemq.cloud',
  MQTT_PORT: 8883,
  MQTT_USERNAME: 'username',
  MQTT_PASSWORD: 'password',
  
  // Simulation Settings
  GPS_UPDATE_INTERVAL: 3000,         // 3 seconds
  DISPATCH_CHECK_INTERVAL: 5000,     // 5 seconds
  AVERAGE_SPEED: 40,                 // km/h
  WORK_TIME_MIN: 5,                  // minutes
  WORK_TIME_MAX: 15,                 // minutes
  
  // Depot Locations
  DEPOTS: [
    { name: 'North Depot', lat: 24.9361, lng: 67.0369 },
    { name: 'Central Depot', lat: 24.8607, lng: 67.0011 },
    { name: 'East Depot', lat: 24.9194, lng: 67.0931 },
    { name: 'Industrial Depot', lat: 24.8789, lng: 67.0644 }
  ]
}
```

---

## Workflows

### 1. Initialization Workflow

```
┌─────────────────────────────────────────────────────────┐
│  Start Simulator (node index.js)                       │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  VehicleSimulator.initialize()                          │
│                                                         │
│  1. APIClient.autoLogin()                              │
│     ├─► Check AUTH_TOKEN                               │
│     ├─► If missing, check AUTH_EMAIL/PASSWORD          │
│     └─► Login and store token                          │
│                                                         │
│  2. MQTTPublisher.connect()                            │
│     ├─► Connect to MQTT broker                          │
│     └─► Process queued messages                         │
│                                                         │
│  3. APIClient.getVehicles()                            │
│     ├─► Fetch all vehicles from backend                │
│     └─► Return vehicle array                           │
│                                                         │
│  4. Initialize Vehicle State                            │
│     For each vehicle:                                   │
│     ├─► Get GPS position from backend (if available)    │
│     ├─► Or use depot location as fallback              │
│     ├─► Store vehicle state in Map                     │
│     └─► Log vehicle position                           │
│                                                         │
│  5. Initialize processedFaults Set                      │
│     └─► Track faults already processed                  │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  VehicleSimulator.start()                               │
│                                                         │
│  1. Start GPS Update Loop (3s interval)                │
│  2. Start Dispatch Polling Loop (5s interval)          │
└─────────────────────────────────────────────────────────┘
```

### 2. Dispatch Detection and Route Calculation Workflow

```
┌─────────────────────────────────────────────────────────┐
│  Dispatch Polling Loop (every 5 seconds)               │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  APIClient.getDispatchedFaults(vehicleIds)              │
│                                                         │
│  1. GET /api/faults                                     │
│  2. Filter faults:                                      │
│     ├─► assigned_vehicle matches one of our vehicles     │
│     └─► status is "pending_confirmation" or "assigned" │
│  3. Return dispatched faults array                     │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  For each dispatched fault:                             │
│                                                         │
│  1. Check if fault already processed                   │
│     └─► Skip if in processedFaults Set                 │
│                                                         │
│  2. Find vehicle in simulator                          │
│     └─► Skip if vehicle not found                      │
│                                                         │
│  3. Check vehicle status                               │
│     ├─► Skip if already processing this fault          │
│     ├─► Skip if status is "working" or other busy     │
│     └─► Process if "available" or "onRoute" (no route) │
│                                                         │
│  4. Validate fault coordinates                         │
│     └─► Skip if missing lat/lng                        │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Calculate Route                                        │
│                                                         │
│  RoutingService.calculateRoute(                         │
│    { lat: vehicle.currentLat, lng: vehicle.currentLng },│
│    { lat: fault.latitude, lng: fault.longitude }       │
│  )                                                      │
│                                                         │
│  1. Check route cache                                  │
│  2. Try OSRM route calculation                        │
│  3. Fallback to Haversine if OSRM fails               │
│  4. Return route with waypoints                        │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Update Vehicle State                                   │
│                                                         │
│  1. vehicle.status = 'onRoute'                          │
│  2. vehicle.assignedFault = faultId                     │
│  3. vehicle.currentRoute = route                       │
│  4. vehicle.waypointIndex = 0                          │
│                                                         │
│  5. APIClient.updateVehicleStatus('onRoute')            │
│  6. MQTTPublisher.publishStatus('onRoute')             │
│  7. processedFaults.add(faultId)                       │
└─────────────────────────────────────────────────────────┘
```

### 3. GPS Update and Movement Workflow

```
┌─────────────────────────────────────────────────────────┐
│  GPS Update Loop (every 3 seconds)                     │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  For each vehicle with status='onRoute' and route:      │
│                                                         │
│  moveVehicleAlongRoute(vehicle)                         │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Check if reached destination                           │
│                                                         │
│  if (waypointIndex >= route.waypoints.length)           │
│    └─► handleArrival(vehicle)                           │
│  else                                                   │
│    └─► Continue movement                                │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Update Vehicle Position                                │
│                                                         │
│  1. Get current waypoint                                │
│  2. vehicle.currentLat = waypoint.lat                  │
│  3. vehicle.currentLng = waypoint.lng                   │
│                                                         │
│  4. Calculate speed & heading                           │
│     ├─► speed = AVERAGE_SPEED (40 km/h)                │
│     └─► heading = calculateBearing(current, next)       │
│                                                         │
│  5. Publish GPS via MQTT                                │
│     └─► MQTTPublisher.publishGPS()                     │
│                                                         │
│  6. Send GPS to backend                                 │
│     └─► APIClient.sendGPS()                            │
│                                                         │
│  7. vehicle.waypointIndex++                            │
└─────────────────────────────────────────────────────────┘
```

### 4. Arrival and Work Completion Workflow

```
┌─────────────────────────────────────────────────────────┐
│  Vehicle Arrives at Destination                        │
│  (waypointIndex >= route.waypoints.length)             │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  handleArrival(vehicle)                                 │
│                                                         │
│  1. Update vehicle status                               │
│     ├─► vehicle.status = 'working'                     │
│     └─► vehicle.speed = 0                              │
│                                                         │
│  2. Update backend status (with retry)                 │
│     ├─► APIClient.updateVehicleStatus('working')       │
│     └─► Retry up to 3 times on failure                  │
│                                                         │
│  3. Publish status via MQTT                             │
│     └─► MQTTPublisher.publishStatus('working')          │
│                                                         │
│  4. Start work timer                                    │
│     ├─► Random work time: 5-15 minutes                  │
│     └─► setTimeout(() => completeWork(), workTime)     │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Work Timer Expires                                     │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  completeWork(vehicle)                                   │
│                                                         │
│  1. Publish resolution via MQTT                        │
│     └─► Topic: vehicle/{number}/resolved                 │
│         Message: { resolved: true, fault_id: ... }      │
│                                                         │
│  2. Reset vehicle state                                 │
│     ├─► vehicle.assignedFault = null                    │
│     ├─► vehicle.currentRoute = null                     │
│     ├─► vehicle.waypointIndex = 0                       │
│     └─► vehicle.status = 'available'                    │
│                                                         │
│  3. Update backend                                      │
│     ├─► APIClient.updateVehicleStatus('available')     │
│     └─► MQTTPublisher.publishStatus('available')        │
└─────────────────────────────────────────────────────────┘
```

### 5. Complete System Integration Flow

```
┌─────────────────────────────────────────────────────────┐
│  Backend AI Dispatch Engine                             │
│  - Dispatches fault to vehicle                          │
│  - Sets vehicle status: "onRoute"                       │
│  - Sets fault status: "pending_confirmation"            │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Simulator Polls Backend (every 5s)                     │
│  GET /api/faults                                        │
│  - Finds fault with assigned_vehicle matching          │
│  - Status: "pending_confirmation" or "assigned"          │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Simulator Calculates Route                             │
│  - From vehicle current position                        │
│  - To fault location                                    │
│  - Using OSRM (Haversine fallback)                      │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Simulator Updates Vehicle                              │
│  - Status: "onRoute"                                    │
│  - Stores route and waypoints                           │
│  - Updates backend via API                               │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  GPS Update Loop (every 3s)                             │
│  - Moves vehicle along route waypoints                   │
│  - Publishes GPS via MQTT                                │
│  - Sends GPS to backend API                              │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Vehicle Arrives at Fault                               │
│  - Updates status: "working"                            │
│  - Starts work timer (5-15 min)                         │
│  - Updates backend                                       │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Work Completed                                         │
│  - Publishes MQTT: vehicle/{number}/resolved            │
│  - Backend receives resolution                          │
│  - Backend updates fault status: "resolved"             │
│  - Simulator resets vehicle to "available"              │
└─────────────────────────────────────────────────────────┘
```

---

## Configuration

### Environment Variables

Create a `.env` file in the `vehicle-simulator` directory:

```env
# Backend API Configuration
BACKEND_URL=http://localhost:5000
AUTH_TOKEN=your_jwt_token_here

# Optional: Auto-login credentials (if AUTH_TOKEN not provided)
AUTH_EMAIL=user@example.com
AUTH_PASSWORD=password123

# MQTT Configuration
MQTT_BROKER=84837c1224714acc85e9e0935388600d.s1.eu.hivemq.cloud
MQTT_PORT=8883
MQTT_USERNAME=taha_user
MQTT_PASSWORD=Strongpassword123

# Simulation Settings (optional - defaults provided)
GPS_UPDATE_INTERVAL=3000
DISPATCH_CHECK_INTERVAL=5000
AVERAGE_SPEED=40
WORK_TIME_MIN=5
WORK_TIME_MAX=15
```

### Configuration File

**File**: `config/config.js`

All configuration values can be overridden via environment variables. Defaults are provided for development.

**Key Settings**:
- **GPS_UPDATE_INTERVAL**: How often to send GPS updates (default: 3000ms = 3 seconds)
- **DISPATCH_CHECK_INTERVAL**: How often to poll for new dispatches (default: 5000ms = 5 seconds)
- **AVERAGE_SPEED**: Vehicle speed in km/h (default: 40 km/h)
- **WORK_TIME_MIN/MAX**: Random work time range in minutes (default: 5-15 minutes)

---

## MQTT Communication

### MQTT Topics

**Publishing** (Simulator → Broker):

1. **GPS Updates**: `vehicle/{vehicle_number}/gps`
   ```json
   {
     "latitude": 24.8607,
     "longitude": 67.0011,
     "speed": 40,
     "heading": 45.5,
     "timestamp": "2025-01-XXT12:00:00.000Z"
   }
   ```

2. **Status Updates**: `vehicle/{vehicle_number}/status`
   ```json
   {
     "status": "onRoute|working|available",
     "timestamp": "2025-01-XXT12:00:00.000Z"
   }
   ```

3. **Fault Resolution**: `vehicle/{vehicle_number}/resolved`
   ```json
   {
     "resolved": true,
     "fault_id": "fault_object_id",
     "timestamp": "2025-01-XXT12:00:00.000Z"
   }
   ```

**Note**: The backend listens to `vehicle/{vehicle_number}/resolved` to complete fault resolution.

### MQTT Connection

- **Protocol**: MQTT over TLS (mqtts)
- **QoS Level**: 1 (at least once delivery)
- **Reconnection**: Automatic (5-second interval)
- **Message Queue**: Queues messages when disconnected

---

## API Integration

### Backend API Endpoints Used

1. **GET /api/vehicles**
   - **Purpose**: Fetch all vehicles on initialization
   - **Auth**: Optional (development mode)
   - **Response**: Array of vehicle objects

2. **POST /api/gps**
   - **Purpose**: Send GPS coordinates
   - **Auth**: Optional (development mode)
   - **Request**: `{ vehicle: ObjectId, latitude, longitude, speed }`
   - **Frequency**: Every 3 seconds per vehicle on route

3. **PUT /api/vehicles/:id**
   - **Purpose**: Update vehicle status
   - **Auth**: Optional (development mode)
   - **Request**: `{ status: "onRoute|working|available" }`

4. **GET /api/faults**
   - **Purpose**: Poll for dispatched faults
   - **Auth**: Optional (development mode)
   - **Response**: Array of all faults
   - **Filtering**: Client-side filtering for dispatched faults

### Authentication

**Auto-Login Flow**:
1. Check if `AUTH_TOKEN` exists → Use directly
2. If not, check for `AUTH_EMAIL` and `AUTH_PASSWORD`
3. If provided, login via `POST /api/auth/login`
4. Store token and use for all subsequent requests
5. Refresh token automatically on 401 errors

**Token Refresh**:
- Automatically attempts re-login on 401 errors
- Retries failed requests after token refresh
- Logs authentication errors for debugging

---

## Route Calculation

### Route Calculation Strategy

**Primary Method**: OSRM (Open Source Routing Machine)
- Uses public OSRM API: `http://router.project-osrm.org`
- Returns detailed route with waypoints
- Includes distance, duration, and geometry

**Fallback Method**: Haversine (Straight-line)
- Used when OSRM fails or times out
- Calculates straight-line distance
- Estimates duration based on average speed

### Route Format

**Waypoints**: Array of `[lat, lng]` pairs (matching backend format)
```javascript
waypoints: [
  [24.8607, 67.0011],  // Start
  [24.8610, 67.0015],  // Waypoint 1
  [24.8615, 67.0020],  // Waypoint 2
  [24.8620, 67.0025]   // Destination
]
```

**Route Object**:
```javascript
{
  distance: 1250,                    // meters
  duration: 112,                     // seconds
  waypoints: [[lat, lng], ...],      // Array of coordinates
  summary: "1.2 km, 2 min",          // Human-readable
  isFallback: false,                 // true if Haversine
  calculatedAt: 1234567890,          // Timestamp
  source: "osrm"                     // "osrm" or "haversine"
}
```

### Route Caching

- **Cache Duration**: 5 minutes (matching backend)
- **Cache Key**: `${start.lat},${start.lng}_${end.lat},${end.lng}`
- **Automatic Expiration**: Removes expired entries

---

## GPS Simulation

### Movement Algorithm

**Waypoint-Based Movement**:
1. Vehicle follows route waypoints sequentially
2. Updates position to current waypoint coordinates
3. Calculates heading to next waypoint
4. Moves to next waypoint every GPS update interval

**Speed Calculation**:
- Fixed speed: `AVERAGE_SPEED` (default: 40 km/h)
- Speed is constant during movement
- Set to 0 when vehicle arrives

**Heading Calculation**:
- Calculated using bearing formula
- Direction from current waypoint to next waypoint
- Expressed in degrees (0-360)

### GPS Update Frequency

- **Interval**: 3 seconds (configurable)
- **Per Vehicle**: Each vehicle on route updates independently
- **Format**: `{ latitude, longitude, speed, heading, timestamp }`

### Position Initialization

**On Startup**:
1. Try to get GPS from backend (latest GPS record)
2. If available, use backend GPS coordinates
3. If not available, use depot location as fallback
4. Log position source (GPS or depot name)

**Depot Assignment**:
- Vehicles are assigned to depots in round-robin fashion
- Depot locations defined in `config.DEPOTS`
- Each vehicle remembers its home depot

---

## Deployment

### Local Development

1. **Install Dependencies**:
   ```bash
   cd vehicle-simulator
   npm install
   ```

2. **Configure Environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Run Simulator**:
   ```bash
   npm start
   # Or with auto-reload:
   npm run dev
   ```

### Docker Deployment

**Dockerfile** (if needed):
```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "start"]
```

**Docker Compose** (add to main docker-compose.yml):
```yaml
vehicle-simulator:
  build: ./vehicle-simulator
  environment:
    - BACKEND_URL=http://backend:5000
    - MQTT_BROKER=${MQTT_BROKER}
    - MQTT_USERNAME=${MQTT_USERNAME}
    - MQTT_PASSWORD=${MQTT_PASSWORD}
    - AUTH_EMAIL=${AUTH_EMAIL}
    - AUTH_PASSWORD=${AUTH_PASSWORD}
  depends_on:
    - backend
  restart: unless-stopped
```

### Production Considerations

1. **Authentication**: Use `AUTH_TOKEN` instead of credentials
2. **Error Handling**: Monitor logs for connection failures
3. **Resource Usage**: Simulator is lightweight but runs continuously
4. **Network**: Ensure access to backend API and MQTT broker
5. **Scaling**: One simulator instance can handle all vehicles

---

## Troubleshooting

### Common Issues

#### 1. Authentication Failures

**Error**: `401 Unauthorized` or `Failed to login`

**Solutions**:
- Check `AUTH_TOKEN` is valid and not expired
- Verify `AUTH_EMAIL` and `AUTH_PASSWORD` are correct
- Check backend authentication requirements
- Ensure backend is running and accessible

#### 2. No Vehicles Found

**Error**: `No vehicles found in database!`

**Solutions**:
- Ensure backend has vehicles in database
- Check `BACKEND_URL` is correct
- Verify backend API is accessible
- Check authentication if required

#### 3. MQTT Connection Failures

**Error**: `MQTT connection error` or `Failed to connect`

**Solutions**:
- Verify MQTT broker URL and port
- Check MQTT credentials (username/password)
- Ensure network access to MQTT broker
- Check firewall rules

#### 4. Route Calculation Failures

**Error**: `Routing error` or routes not calculating

**Solutions**:
- Check internet connection (OSRM requires internet)
- Verify coordinates are valid (not NaN)
- Check OSRM service availability
- System will fallback to Haversine automatically

#### 5. Vehicles Not Moving

**Symptoms**: Vehicles initialized but not moving to faults

**Check**:
- Verify dispatch polling is working (`checkForDispatches`)
- Check if faults are being assigned by backend
- Verify vehicle status is being updated
- Check route calculation is successful
- Verify GPS update loop is running

#### 6. Status Update Failures

**Error**: `Failed to update vehicle status`

**Solutions**:
- Check vehicle ID format (must be valid ObjectId)
- Verify backend API endpoint is accessible
- Check authentication token is valid
- Verify vehicle exists in backend database
- Check backend logs for errors

### Debugging

**Enable Verbose Logging**:
- Check console output for detailed logs
- All operations are logged with emoji indicators:
  - ✅ Success
  - ❌ Error
  - ⚠️ Warning
  - 🔄 Retry/Reconnect
  - 📡 MQTT operations
  - 🚗 Vehicle operations

**Check Vehicle State**:
- Vehicle state is stored in `VehicleSimulator.vehicles` Map
- Can be inspected via console logs
- Each vehicle logs position updates every 10 waypoints

**Monitor MQTT Messages**:
- Use MQTT client to subscribe to topics
- Verify GPS messages are being published
- Check status updates are sent

---

## Integration with System

### Backend Integration

**Dispatch Flow**:
1. Backend AI dispatch engine assigns fault to vehicle
2. Backend sets vehicle status to "onRoute"
3. Backend sets fault status to "pending_confirmation"
4. Simulator polls and detects dispatch
5. Simulator calculates route and starts movement
6. Simulator sends GPS updates to backend
7. Backend detects arrival (within 50m)
8. Simulator completes work and publishes resolution
9. Backend receives resolution and updates fault status

### Frontend Integration

**GPS Updates**:
- Simulator sends GPS to backend via API
- Backend stores GPS in database
- Frontend receives GPS updates via WebSocket
- Frontend displays vehicle movement on map

**Status Updates**:
- Simulator updates vehicle status via API
- Backend emits WebSocket events
- Frontend receives status changes
- Frontend updates vehicle markers

### MQTT Integration

**Hardware Device Simulation**:
- Simulator publishes GPS via MQTT (same as hardware devices)
- Simulator publishes status updates
- Simulator publishes resolution messages
- Backend listens to MQTT topics (same as hardware)

---

## Performance Considerations

### Resource Usage

- **CPU**: Low (mostly I/O operations)
- **Memory**: ~50-100MB (depends on number of vehicles)
- **Network**: 
  - GPS updates: ~1 request per vehicle every 3s
  - Dispatch polling: 1 request every 5s
  - MQTT: ~1 message per vehicle every 3s

### Optimization Tips

1. **Route Caching**: Reduces OSRM API calls
2. **Batch Operations**: GPS updates sent individually (could be batched)
3. **Polling Interval**: Adjust `DISPATCH_CHECK_INTERVAL` based on needs
4. **GPS Interval**: Adjust `GPS_UPDATE_INTERVAL` for smoother/faster movement

---

## Best Practices

1. **Start Backend First**: Ensure backend is running before simulator
2. **Verify MQTT Connection**: Check MQTT broker is accessible
3. **Monitor Logs**: Watch for errors and warnings
4. **Use Auto-Login**: Configure credentials for seamless operation
5. **Test Routes**: Verify route calculation works for your area
6. **Check Vehicle Status**: Ensure vehicles are in correct initial state

---

## Future Enhancements

1. **WebSocket Integration**: Real-time dispatch events instead of polling
2. **Multiple Simulators**: Support for distributed simulation
3. **Traffic Simulation**: Variable speeds based on traffic
4. **Route Optimization**: Multi-vehicle route optimization
5. **Historical Playback**: Replay historical vehicle movements
6. **Performance Metrics**: Track simulation performance

---

**Documentation Version**: 1.0  
**Last Updated**: 2025-01-XX  
**Status**: ✅ Complete

