# Flow Diagrams - Fleet Management System

This document contains all flow diagrams from the system documentation, formatted in Mermaid syntax for easy PNG export from [Mermaid Live Editor](https://mermaid.live) or [Mermaid CLI](https://github.com/mermaid-js/mermaid-cli).

---

## Backend Diagrams

### 1. High-Level Architecture

```mermaid
graph TB
    Frontend[Frontend<br/>React/Vue]
    Express[Express Server<br/>Routes → Controllers → Services → Models]
    Socket[Socket.io<br/>Real-time Updates]
    MongoDB[(MongoDB)]
    MQTT[MQTT Broker]
    OSRM[OSRM<br/>Routing]
    ML[ML Service]
    Cache[Cache]
    
    Frontend -->|HTTP/WebSocket| Express
    Express --> Socket
    Express --> MongoDB
    Express --> MQTT
    Express --> OSRM
    Express --> ML
    Express --> Cache
```

---

### 2. Fault Reporting and Dispatch Flow

```mermaid
sequenceDiagram
    participant Ext as External System
    participant FC as faultController.js
    participant DC as dispatchController
    participant AC as alertController.js
    participant MQTT as MQTT Broker
    
    Ext->>FC: POST /api/faults<br/>{fault_type, location, category}
    FC->>FC: Create Fault (status: "waiting")
    FC->>FC: Invalidate cache
    FC->>Frontend: Emit WebSocket: 'fault:created'
    FC->>DC: Auto-dispatch (async)
    
    DC->>DC: Find available vehicles
    DC->>DC: Score vehicles (Rule/ML)<br/>Performance (25%)<br/>Fatigue (20%)<br/>Location Exp (15%)<br/>Fault Type Exp (15%)<br/>Criticality (25%)
    DC->>DC: Select best vehicle
    DC->>DC: Update Fault (status: "pending_confirmation")
    DC->>DC: Update Vehicle (status: "onRoute")
    DC->>AC: Send MQTT Alert
    
    AC->>AC: Create Alert record
    AC->>MQTT: Publish: device/{device_id}/dispatch
```

---

### 3. Driver Confirmation Flow

```mermaid
sequenceDiagram
    participant HW as Hardware Device
    participant MQTT as mqttService.js
    participant DB as Database
    participant WS as WebSocket
    
    HW->>MQTT: MQTT: vehicle/{vehicle_number}/confirmation<br/>{fault_id, confirmed: true}
    MQTT->>DB: Find Vehicle
    MQTT->>MQTT: Clear dispatch timeout
    MQTT->>DB: Update Fault (status: "assigned")
    MQTT->>DB: Check for existing ongoing trip
    
    alt Trip exists
        MQTT->>DB: Reuse existing trip
    else No trip
        MQTT->>DB: Create new Trip<br/>vehicle, driver, start_time<br/>start_location: "Depot"<br/>status: "ongoing"
    end
    
    MQTT->>DB: Update Vehicle (status: "working")
    MQTT->>WS: Emit WebSocket events:<br/>'vehicle:confirmation'<br/>'fault:updated'<br/>'vehicle:status-change'
```

---

### 4. GPS Tracking and Arrival Detection Flow

```mermaid
sequenceDiagram
    participant HW as Hardware Device
    participant GC as gpsController.js
    participant DB as Database
    participant WS as WebSocket
    participant Timer as Auto-Resolution Timer
    
    HW->>GC: POST /api/gps<br/>{vehicle, latitude, longitude, speed}
    GC->>GC: Validate coordinates
    GC->>DB: Create GPS record
    GC->>GC: Invalidate cache
    GC->>WS: Emit WebSocket: 'vehicle:gps-update'
    GC->>GC: checkVehicleArrival()
    
    GC->>DB: Find vehicle (status: "onRoute" or "working")
    GC->>DB: Find assigned fault
    GC->>GC: Calculate distance to fault
    
    alt distance <= 50m
        GC->>DB: Update Vehicle (status: "working" if not already)
        GC->>DB: Mark Route (status: "completed")
        GC->>Timer: Start auto-resolution timer (30s) if not already started
        GC->>WS: Emit WebSocket: 'vehicle:arrived'
    end
```

---

### 5. Fault Resolution Flow

```mermaid
sequenceDiagram
    participant HW as Hardware Device
    participant MQTT as mqttService.js
    participant DB as Database
    participant WS as WebSocket
    
    HW->>MQTT: MQTT: vehicle/{vehicle_number}/resolved<br/>{fault_id, resolved: true}
    MQTT->>DB: Find Fault
    MQTT->>DB: Update Fault (status: "resolved")
    MQTT->>DB: Find ongoing Trip
    MQTT->>DB: Update Trip<br/>status: "completed"<br/>end_time: now<br/>end_location: fault.fault_location
    MQTT->>DB: Update Vehicle (status: "available")
    MQTT->>DB: Cancel active routes
    MQTT->>DB: Update Alert (solved: true)
    MQTT->>WS: Emit WebSocket events:<br/>'vehicle:resolved'<br/>'fault:updated'<br/>'vehicle:status-change'
```

---

### 6. Auto-Resolution Timer Flow (Prototype Mode)

```mermaid
sequenceDiagram
    participant Arrival as Vehicle Arrives<br/>at Fault Location
    participant Timer as prototypeTimer<br/>startAutoResolutionTimer()
    participant AutoResolve as autoResolveFault()
    participant DB as Database
    participant WS as WebSocket
    
    Arrival->>Timer: Vehicle within 50m of fault
    Timer->>Timer: Cancel existing timer (if any)
    Timer->>Timer: Start 30-second timer
    
    Note over Timer: After 30 seconds
    
    Timer->>AutoResolve: Timer fires
    AutoResolve->>DB: Update Fault (status: "resolved")
    AutoResolve->>DB: Complete Trip
    AutoResolve->>DB: Update Vehicle (status: "available")
    AutoResolve->>DB: Cancel active routes
    AutoResolve->>DB: Update Alert (solved: true)
    AutoResolve->>WS: Emit WebSocket events
```

---

### 7. Route Recalculation Flow

```mermaid
sequenceDiagram
    participant GPS as GPS Update<br/>(vehicle onRoute)
    participant GC as checkAndRecalculateRoute()
    participant Routing as Routing Service<br/>(OSRM/Haversine)
    participant DB as Database
    participant WS as WebSocket
    
    GPS->>GC: GPS update received
    GC->>DB: Find active route
    GC->>GC: Calculate expected position on route
    GC->>GC: Calculate deviation from route
    
    alt deviation > 200m AND distance > 500m
        GC->>Routing: Calculate new route (OSRM/Haversine)
        GC->>DB: Mark old route (status: "superseded")
        GC->>DB: Create new route (status: "active")<br/>routeStartTime: now
        GC->>WS: Emit WebSocket: 'route:updated'
    end
```

---

### 8. Dispatch Timeout Flow

```mermaid
sequenceDiagram
    participant Dispatch as Dispatch Sent<br/>(1 minute timer)
    participant Timeout as Timeout Handler
    participant DB as Database
    participant DC as dispatchController
    participant WS as WebSocket
    
    Dispatch->>Timeout: 1 minute elapsed<br/>(no confirmation)
    Timeout->>Timeout: Clear timeout
    Timeout->>Timeout: Add vehicle to timed-out set
    Timeout->>DB: Reset Vehicle (status: "available")
    
    alt fault still "pending_confirmation"
        Timeout->>DB: Reset Fault (status: "waiting")
        Timeout->>DC: Auto-redispatch<br/>(exclude timed-out vehicle)
    end
    
    Timeout->>WS: Emit WebSocket events
```

---

### 9. Stuck Vehicle Cleanup Flow

```mermaid
sequenceDiagram
    participant Job as Periodic Job<br/>(every 30 seconds)
    participant Cleanup as checkStuckVehicles()
    participant DB as Database
    participant WS as WebSocket
    
    loop Every 30 seconds
        Job->>Cleanup: Trigger cleanup
        Cleanup->>DB: Find vehicles<br/>(status: "onRoute" or "working")
        
        loop For each vehicle
            Cleanup->>DB: Check for active fault
            Cleanup->>Cleanup: Check for active dispatch timeout
            
            alt No active fault AND no timeout
                Cleanup->>DB: Reset Vehicle (status: "available")
                Cleanup->>DB: Cancel active routes
                Cleanup->>WS: Emit WebSocket: 'vehicle:status-change'
            end
        end
        
        Cleanup->>Cleanup: Invalidate cache
    end
```

---

## Frontend Diagrams

### 10. High-Level Architecture (Frontend)

```mermaid
graph TB
    subgraph ReactApp["React Application"]
        Pages[Pages (Routes)<br/>Dashboard, Login, Signup, etc.]
        Components[Components<br/>Dashboard, Map, Sidebars, UI]
        Services[Services<br/>API, WebSocket, Route, GPS Simulation]
        Contexts[Contexts & Hooks<br/>AuthContext, useWebSocket, etc.]
    end
    
    BackendAPI[Backend API<br/>(REST)]
    WebSocket[WebSocket<br/>(Socket.io)]
    
    Pages --> Components
    Components --> Services
    Components --> Contexts
    Services --> BackendAPI
    Services --> WebSocket
```

---

### 11. Component Hierarchy

```mermaid
graph TD
    App[App]
    AuthProvider[AuthProvider]
    Routes[Routes]
    Index[Index - redirect]
    Login[Login]
    Signup[Signup]
    Dashboard[Dashboard - Protected]
    TopNav[TopNavigation]
    FleetSidebar[FleetSidebar]
    MapArea[MapArea]
    InteractiveMap[InteractiveMap - MapLibre]
    VehicleOverlay[VehicleOverlay]
    FaultOverlay[FaultOverlay]
    MapHeaderControls[MapHeaderControls]
    MapLegends[MapLegends]
    MapStatistics[MapStatistics]
    DispatchSidebar[DispatchSidebar]
    MaintenanceEngine[MaintenanceEngine - Protected]
    MaintenanceDetails[MaintenanceDetails - Protected]
    Providers[Providers<br/>QueryClient, TooltipProvider, Toasters]
    
    App --> AuthProvider
    App --> Providers
    AuthProvider --> Routes
    Routes --> Index
    Routes --> Login
    Routes --> Signup
    Routes --> Dashboard
    Routes --> MaintenanceEngine
    Routes --> MaintenanceDetails
    Dashboard --> TopNav
    Dashboard --> FleetSidebar
    Dashboard --> MapArea
    Dashboard --> DispatchSidebar
    MapArea --> InteractiveMap
    MapArea --> VehicleOverlay
    MapArea --> FaultOverlay
    MapArea --> MapHeaderControls
    MapArea --> MapLegends
    MapArea --> MapStatistics
```

---

### 12. State Flow

```mermaid
graph TD
    Backend[Backend API/WebSocket]
    Services[Services Layer]
    Hooks[Hooks/Contexts]
    Components[Components]
    UI[UI Updates]
    
    Backend --> Services
    Services --> Hooks
    Hooks --> Components
    Components --> UI
```

---

### 13. Event Flow (WebSocket)

```mermaid
sequenceDiagram
    participant BE as Backend Event
    participant SIOS as Socket.io Server
    participant SIOC as Socket.io Client<br/>(Frontend)
    participant Hook as useWebSocket Hook
    participant State as Component State
    participant UI as UI Re-render
    
    BE->>SIOS: Event generated
    SIOS->>SIOC: Emit event
    SIOC->>Hook: Event received
    Hook->>State: Update state
    State->>UI: Trigger re-render
```

---

### 14. Vehicle Data Flow

```mermaid
graph LR
    BackendAPI[Backend API]
    APIService[getVehicles()<br/>API service]
    useMapData[useMapData hook]
    VehiclesState[vehicles state]
    VehicleOverlay[VehicleOverlay component]
    MapMarkers[Map markers]
    
    BackendAPI --> APIService
    APIService --> useMapData
    useMapData --> VehiclesState
    VehiclesState --> VehicleOverlay
    VehicleOverlay --> MapMarkers
```

---

### 15. Fault Data Flow

```mermaid
graph LR
    Backend[Backend API / WebSocket]
    GetFaults[getFaults() / fault:created event]
    useMapData[useMapData hook]
    FaultsState[faults state]
    FaultOverlay[FaultOverlay component]
    MapMarkers[Map markers + dispatch buttons]
    
    Backend --> GetFaults
    GetFaults --> useMapData
    useMapData --> FaultsState
    FaultsState --> FaultOverlay
    FaultOverlay --> MapMarkers
```

---

### 16. Dispatch Flow (Complete)

```mermaid
sequenceDiagram
    participant BE as Backend Auto-Dispatch<br/>(on fault creation or periodic)
    participant Backend as Backend Processing
    participant MQTT as MQTT Alert
    participant WS as WebSocket
    participant Frontend as Frontend
    participant RouteCalc as Route Calculation
    participant GPSSim as GPS Simulation
    participant Arrival as Arrival Detection
    participant Timer as Auto-Resolution Timer
    participant Resolution as Resolution
    
    BE->>Backend: Process dispatch
    Backend->>Backend: Select best vehicle<br/>(rule-based or ML)
    Backend->>Backend: Update fault status: "pending_confirmation"
    Backend->>Backend: Update vehicle status: "onRoute"
    Backend->>MQTT: Send MQTT alert to hardware device
    Backend->>WS: Emit WebSocket: fault:dispatched
    
    WS->>Frontend: Event received
    Frontend->>RouteCalc: Calculate route
    Frontend->>Frontend: Update vehicle status: "onRoute"
    Frontend->>GPSSim: Start GPS simulation
    Frontend->>Frontend: Vehicle animates along route
    GPSSim->>Backend: GPS updates sent every 3 seconds
    
    Backend->>Arrival: Detect arrival (within 50m)
    Arrival->>WS: Emit: vehicle:arrived
    WS->>Frontend: Event received
    Frontend->>Frontend: Vehicle status: "working"
    Frontend->>Timer: Start auto-resolution timer (30s)
    
    Timer->>WS: Emit: vehicle:resolved (or MQTT resolution)
    WS->>Frontend: Event received
    Frontend->>Frontend: Vehicle status: "available"
```

---

## How to Use These Diagrams

### Option 1: Mermaid Live Editor (Recommended)
1. Go to [https://mermaid.live](https://mermaid.live)
2. Copy any diagram code block (without the markdown code fence)
3. Paste it into the editor
4. Click "Actions" → "Download PNG" or "Download SVG"

### Option 2: Mermaid CLI
1. Install Mermaid CLI:
   ```bash
   npm install -g @mermaid-js/mermaid-cli
   ```
2. Save a diagram to a `.mmd` file
3. Generate PNG:
   ```bash
   mmdc -i diagram.mmd -o diagram.png
   ```

### Option 3: VS Code Extension
1. Install "Markdown Preview Mermaid Support" extension
2. Open this file in VS Code
3. Use the preview to view diagrams
4. Export as needed

---

## Diagram Index

| # | Diagram Name | Type | Location |
|---|-------------|------|----------|
| 1 | High-Level Architecture (Backend) | Graph | Backend Documentation |
| 2 | Fault Reporting and Dispatch Flow | Sequence | Backend Documentation |
| 3 | Driver Confirmation Flow | Sequence | Backend Documentation |
| 4 | GPS Tracking and Arrival Detection Flow | Sequence | Backend Documentation |
| 5 | Fault Resolution Flow | Sequence | Backend Documentation |
| 6 | Auto-Resolution Timer Flow | Sequence | Backend Documentation |
| 7 | Route Recalculation Flow | Sequence | Backend Documentation |
| 8 | Dispatch Timeout Flow | Sequence | Backend Documentation |
| 9 | Stuck Vehicle Cleanup Flow | Sequence | Backend Documentation |
| 10 | High-Level Architecture (Frontend) | Graph | Frontend Documentation |
| 11 | Component Hierarchy | Graph | Frontend Documentation |
| 12 | State Flow | Graph | Frontend Documentation |
| 13 | Event Flow (WebSocket) | Sequence | Frontend Documentation |
| 14 | Vehicle Data Flow | Graph | Frontend Documentation |
| 15 | Fault Data Flow | Graph | Frontend Documentation |
| 16 | Dispatch Flow (Complete) | Sequence | Frontend Documentation |

---

**Note**: All diagrams are formatted in standard Mermaid syntax and can be directly used with Mermaid-compatible tools for PNG/SVG export.
