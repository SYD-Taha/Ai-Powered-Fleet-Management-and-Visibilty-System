# Fleet Management System - Frontend Documentation

**Version**: 1.0.0  
**Last Updated**: January 2025  
**Status**: Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Architecture](#architecture)
5. [Pages](#pages)
6. [Components](#components)
7. [Services](#services)
8. [Hooks](#hooks)
9. [Contexts](#contexts)
10. [State Management](#state-management)
11. [Routing](#routing)
12. [Real-time Communication](#real-time-communication)
13. [Map Integration](#map-integration)
14. [Authentication](#authentication)
15. [Development Setup](#development-setup)
16. [Build & Deployment](#build--deployment)
17. [Configuration](#configuration)
18. [Troubleshooting](#troubleshooting)

---

## Overview

The Fleet Management System frontend is a modern React + TypeScript web application providing a comprehensive dashboard for fleet management, real-time GPS tracking, vehicle dispatch, and interactive map visualization.

### Key Features

- Interactive Map with MapLibre GL + OpenStreetMap
- Real-time WebSocket updates
- AI Dispatch System with manual override
- Fleet Management with filtering and statistics
- Fault Management and tracking
- JWT Authentication
- Day/Night mode
- GPS Simulation with OSRM routing

---

## Technology Stack

**Core**: React 18.3.1, TypeScript 5.5.3, Vite 5.4.1, React Router 6.26.2  
**UI**: shadcn/ui, Tailwind CSS 3.4.11, Lucide React, Radix UI  
**Map**: MapLibre GL JS 3.6.2, OpenStreetMap, OSRM  
**Real-time**: Socket.io Client 4.7.5  
**Data**: Axios 1.12.2, TanStack React Query 5.56.2  
**Forms**: React Hook Form 7.53.0, Zod 3.23.8

---

## Project Structure

```
frontend/src/
├── components/
│   ├── auth/ProtectedRoute.tsx
│   ├── dashboard/
│   │   ├── map/ (InteractiveMap, VehicleOverlay, FaultOverlay, etc.)
│   │   ├── FleetSidebar.tsx
│   │   ├── DispatchSidebar.tsx
│   │   └── MapArea.tsx
│   └── ui/ (shadcn/ui components)
├── contexts/AuthContext.tsx
├── hooks/useWebSocket.ts
├── pages/ (Dashboard, Login, Signup, etc.)
├── services/ (api, aiDispatchService, routeService, etc.)
└── utils/
```

---

## Architecture

### Component Hierarchy
```
App → AuthProvider → BrowserRouter → Routes
  → Dashboard → [TopNavigation, FleetSidebar, MapArea, DispatchSidebar]
  → Login/Signup
```

### System Architecture Flow

```mermaid
graph TB
    A[User Browser] --> B[React App]
    B --> C[AuthProvider]
    C --> D[Protected Routes]
    D --> E[Dashboard]
    E --> F[MapArea]
    E --> G[FleetSidebar]
    E --> H[DispatchSidebar]
    
    F --> I[InteractiveMap]
    I --> J[VehicleOverlay]
    I --> K[FaultOverlay]
    
    E --> L[useMapData Hook]
    L --> M[API Service]
    L --> N[WebSocket Service]
    L --> O[Route Service]
    L --> P[GPS Simulation]
    
    M --> Q[Backend API]
    N --> R[WebSocket Server]
    O --> S[OSRM API]
    P --> Q
    
    Q --> T[MongoDB]
    R --> T
```

### Data Flow

```mermaid
sequenceDiagram
    participant User
    participant Component
    participant Service
    participant Backend
    participant State
    
    User->>Component: User Action
    Component->>Service: Call Service Method
    Service->>Backend: API Request/WebSocket
    Backend-->>Service: Response/Event
    Service-->>Component: Processed Data
    Component->>State: Update State
    State-->>Component: State Change
    Component-->>User: UI Update
```

---

## Pages

### Dashboard Page Flow

```mermaid
flowchart TD
    A[User Navigates to /dashboard] --> B{Authenticated?}
    B -->|No| C[Redirect to /login]
    B -->|Yes| D[Load Dashboard Component]
    D --> E[Initialize State]
    E --> F[Load Day/Night Mode from localStorage]
    F --> G[Render Layout]
    G --> H[TopNavigation]
    G --> I[FleetSidebar]
    G --> J[MapArea]
    G --> K[DispatchSidebar]
    
    J --> L[useMapData Hook]
    L --> M[Fetch Initial Data]
    M --> N[Setup WebSocket]
    N --> O[Start Real-time Updates]
    O --> P[Render Map]
    P --> Q[Display Vehicles & Faults]
    
    I --> R[Display Vehicle List]
    K --> S[Display Dispatch Controls]
    
    Q --> T[User Interactions]
    R --> T
    S --> T
    T --> U{Action Type}
    U -->|Filter| R
    U -->|Dispatch| V[Trigger Dispatch]
    U -->|Map Interaction| P
    V --> W[Update State]
    W --> Q
```

### Dashboard (`/dashboard`)
Main dashboard with map, vehicle list, and dispatch controls.

**State**: vehicles[], faults[], isDayMode, isPlaying, speed

### Login (`/login`)
Email/password authentication with validation.

### Signup (`/signup`)
Registration with username, email, password validation and strength indicator.

---

## Components

### FleetSidebar
- Vehicle list with status filters (available, dispatched, working, idle)
- Search functionality
- Fleet statistics
- Collapsible design

### DispatchSidebar
- AI dispatch toggle
- Dispatch activity logs
- Fault list with assignment status
- Manual dispatch controls

### InteractiveMap
- MapLibre GL map with OpenStreetMap tiles
- Center: Karachi (67.0039°E, 24.8615°N)
- Zoom: 11 (initial), max 19
- Performance optimizations (tile caching, crisp rendering)

### VehicleOverlay
- Vehicle markers with status colors
- Vehicle number labels
- Click handlers

### FaultOverlay
- Fault markers with severity colors (critical/medium/low)
- Fault details on click
- Manual dispatch button

---

## Services

### API Request Flow

```mermaid
sequenceDiagram
    participant Component
    participant API
    participant Interceptor
    participant Backend
    
    Component->>API: API.get('/api/vehicles')
    API->>Interceptor: Request Interceptor
    Interceptor->>Interceptor: Get Token from localStorage
    Interceptor->>Interceptor: Add Authorization Header
    Interceptor->>Backend: HTTP Request with Token
    Backend-->>Interceptor: Response
    Interceptor->>API: Response Data
    API->>API: Error Handling
    API-->>Component: Processed Data/Error
```

### Dispatch Service Flow

```mermaid
flowchart TD
    A[User Triggers Dispatch] --> B{Manual or AI?}
    B -->|Manual| C[manualDispatch]
    B -->|AI| D[autoDispatch]
    
    C --> E[Select Vehicle & Fault]
    D --> F[Find Nearest Vehicle]
    
    E --> G[Update Vehicle Status]
    F --> G
    G --> H[Update Fault Status]
    H --> I[Calculate ETA]
    I --> J[Add to Dispatch Logs]
    J --> K[Update UI]
    
    D --> L{AI Active?}
    L -->|No| M[Skip]
    L -->|Yes| D
```

### AI Dispatch Service (`aiDispatchService.ts`)
Singleton service:
- `manualDispatch()`: Manual vehicle assignment
- `autoDispatch()`: Automatic dispatch logic
- `getDispatchLogs()`: Activity logs
- `toggleAI()`: Enable/disable AI

### Route Service (`routeService.ts`)
- OSRM route calculation
- Route caching
- Returns: waypoints, distance, duration

### GPS Simulation Service (`gpsSimulationService.ts`)
- Position calculation along routes
- Speed: 60 km/h (16.67 m/s)
- GPS updates to backend every 2-3 seconds

### Socket Service (`socketService.ts`)
- Socket.io client initialization
- Auto-reconnection
- Connection status tracking

---

## Hooks

### useWebSocket
WebSocket integration with handlers:
- `onVehicleGPSUpdate`
- `onVehicleStatusChange`
- `onFaultCreated/Updated`
- `onFaultDispatched`
- Returns: `{ socket, isConnected, connect, disconnect }`

### useMapData
Map data management:
- Fetches vehicles and faults
- Real-time WebSocket updates
- Route calculation on dispatch
- GPS simulation
- Returns: `{ vehicles, faults, handleManualDispatch }`

---

## Contexts

### AuthContext
- User data and JWT token
- `login()`, `register()`, `logout()`
- Persistence in localStorage
- Auto token injection

---

## Routing

### Routing Flow

```mermaid
flowchart TD
    A[User Navigates] --> B[React Router]
    B --> C{Route Match?}
    C -->|No| D[404 Not Found]
    C -->|Yes| E{Protected Route?}
    E -->|No| F[Render Component]
    E -->|Yes| G[ProtectedRoute]
    G --> H{Authenticated?}
    H -->|No| I[Redirect to /login]
    H -->|Yes| F
    F --> J[Component Renders]
    J --> K[Component Lifecycle]
    K --> L[Fetch Data]
    L --> M[Render UI]
```

### Route Protection Flow

```mermaid
sequenceDiagram
    participant User
    participant Router
    participant ProtectedRoute
    participant AuthContext
    participant Component
    
    User->>Router: Navigate to /dashboard
    Router->>ProtectedRoute: Check Route
    ProtectedRoute->>AuthContext: Check isAuthenticated
    AuthContext->>AuthContext: Check localStorage
    AuthContext-->>ProtectedRoute: Auth Status
    alt Authenticated
        ProtectedRoute->>Component: Render Component
    else Not Authenticated
        ProtectedRoute->>Router: Redirect to /login
        Router->>User: Show Login Page
    end
```

**Routes**:
- `/` - Index
- `/login` - Login page
- `/signup` - Signup page
- `/dashboard` - Dashboard (protected)
- `/maintenance` - Maintenance (protected)
- `/maintenance/:vehicleId` - Details (protected)
- `*` - 404

**Protected Routes**: Wrapped in `ProtectedRoute` component

---

## Real-time Communication

### WebSocket Connection Flow

```mermaid
sequenceDiagram
    participant App
    participant useWebSocket
    participant SocketService
    participant Backend
    participant Component
    
    App->>useWebSocket: Initialize Hook
    useWebSocket->>SocketService: initializeSocket()
    SocketService->>Backend: Connect WebSocket
    Backend-->>SocketService: Connection Established
    SocketService-->>useWebSocket: Socket Instance
    useWebSocket->>useWebSocket: Register Event Handlers
    useWebSocket-->>Component: isConnected = true
    
    loop Real-time Updates
        Backend->>SocketService: Emit Event
        SocketService->>useWebSocket: Event Received
        useWebSocket->>Component: Call Handler
        Component->>Component: Update State
        Component-->>App: Re-render UI
    end
```

### Real-time Update Flow

```mermaid
graph TB
    A[Backend Event] --> B[WebSocket Server]
    B --> C[Socket.io Client]
    C --> D[useWebSocket Hook]
    D --> E{Event Type}
    
    E -->|vehicle:gps-update| F[Update Vehicle Position]
    E -->|vehicle:status-change| G[Update Vehicle Status]
    E -->|fault:created| H[Add New Fault]
    E -->|fault:updated| I[Update Fault Status]
    E -->|fault:dispatched| J[Calculate Route]
    E -->|vehicle:confirmation| K[Update to Working]
    E -->|vehicle:resolved| L[Mark Fault Resolved]
    
    F --> M[useMapData Hook]
    G --> M
    H --> M
    I --> M
    J --> M
    K --> M
    L --> M
    
    M --> N[Update State]
    N --> O[Re-render Components]
    O --> P[Update Map/UI]
```

### WebSocket Events
- `vehicle:gps-update` - GPS coordinates
- `vehicle:status-change` - Status updates
- `fault:created` - New faults
- `fault:updated` - Fault changes
- `fault:dispatched` - Dispatch events
- `vehicle:confirmation` - Vehicle confirmed
- `vehicle:resolved` - Fault resolved

**Implementation**: `useWebSocket` hook + `socketService.ts`

---

## Map Integration

### MapLibre GL
- Library: MapLibre GL JS 3.6.2
- Tiles: OpenStreetMap
- Performance: Tile cache (50), crisp rendering, no fade

### OSRM Routing
- API: `https://router.project-osrm.org/route/v1/driving`
- Returns waypoints along actual roads
- Caching to reduce API calls

### Vehicle Movement
- Speed: 60 km/h
- Route-based (follows roads)
- GPS updates: Every 2-3 seconds
- Smooth interpolation along route segments

### Coordinates
- Format: [latitude, longitude]
- Karachi bounds: 24.8-24.95°N, 66.9-67.2°E
- Center: 24.8615°N, 67.0039°E

---

## Authentication

### Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant LoginPage
    participant AuthContext
    participant API
    participant Backend
    participant LocalStorage
    
    User->>LoginPage: Enter Credentials
    LoginPage->>LoginPage: Validate Form
    LoginPage->>AuthContext: login(email, password)
    AuthContext->>API: POST /api/auth/login
    API->>Backend: HTTP Request
    Backend-->>API: {token, user}
    API-->>AuthContext: AuthResponse
    AuthContext->>LocalStorage: Store token & user
    AuthContext->>AuthContext: Update State
    AuthContext-->>LoginPage: Success
    LoginPage->>User: Redirect to Dashboard
```

### Registration Flow

```mermaid
flowchart TD
    A[User Opens Signup] --> B[Enter Username]
    B --> C{Validate Username}
    C -->|Invalid| B
    C -->|Valid| D[Enter Email]
    D --> E{Validate Email}
    E -->|Invalid| D
    E -->|Valid| F[Enter Password]
    F --> G{Check Password Strength}
    G -->|Weak| F
    G -->|Strong| H[Confirm Password]
    H --> I{Passwords Match?}
    I -->|No| H
    I -->|Yes| J[Submit Form]
    J --> K[API: POST /api/auth/register]
    K --> L{Success?}
    L -->|No| M[Show Error]
    M --> B
    L -->|Yes| N[Redirect to Login]
```

### Token Management Flow

```mermaid
graph LR
    A[App Loads] --> B{Token in localStorage?}
    B -->|Yes| C[Load Token]
    B -->|No| D[Show Login]
    C --> E[Set AuthContext State]
    E --> F[API Interceptor]
    F --> G[Add Token to Headers]
    G --> H[Backend Request]
    H --> I{Token Valid?}
    I -->|Yes| J[Success]
    I -->|No| K[Clear Token]
    K --> D
```

### Token Management Details
- Storage: `localStorage.authToken`
- User: `localStorage.authUser` (JSON)
- Injection: Axios interceptor

---

## Development Setup

### Prerequisites
- Node.js 18+
- Backend API running

### Installation
```bash
cd frontend
npm install
```

### Environment Variables
Create `.env`:
```env
VITE_API_URL=http://localhost:5000
```

### Development
```bash
npm run dev
# Server: http://localhost:5173
```

### Build
```bash
npm run build        # Production
npm run build:dev    # Development
npm run preview      # Preview build
```

---

## Build & Deployment

### Production Build
```bash
npm run build
# Output: dist/
```

### Docker
```yaml
frontend:
  build: ./frontend
  ports: ["5173:5173"]
  env_file: [./frontend/.env]
  environment:
    - VITE_API_URL=http://backend:5000
```

---

## Configuration

### Vite (`vite.config.ts`)
- Port: 5173
- Host: 0.0.0.0 (Docker)
- Strict Port: true
- Watch: Polling (Docker)
- Alias: `@` → `./src`

### TypeScript (`tsconfig.json`)
- Alias: `@/*` → `./src/*`
- Strict: Disabled

---

## Troubleshooting

### API Connection Failed
- Check `VITE_API_URL`
- Verify backend running
- Check CORS

### WebSocket Failed
- Verify backend WebSocket server
- Check URL matches backend
- Check CORS for WebSocket

### Map Not Rendering
- Check MapLibre GL CSS imported
- Verify OpenStreetMap tiles accessible
- Check console for errors

### Vehicles Not Moving
- Check GPS simulation running
- Verify route calculation
- Check WebSocket GPS events

### Authentication Issues
- Clear localStorage
- Verify JWT_SECRET matches backend
- Check token expiration

---

**Version**: 1.0.0  
**Last Updated**: January 2025  
**Status**: Production Ready
