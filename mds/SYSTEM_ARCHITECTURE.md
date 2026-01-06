# System Architecture Documentation

## Table of Contents
1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Component Architecture](#component-architecture)
4. [Shared Services](#shared-services)
5. [Data Flow](#data-flow)
6. [Communication Protocols](#communication-protocols)
7. [Technology Stack](#technology-stack)
8. [Deployment Architecture](#deployment-architecture)

---

## Overview

The Fleet Management System is a distributed microservices architecture designed for intelligent vehicle dispatch, real-time GPS tracking, and automated fault management. The system consists of four main components working together to provide a comprehensive fleet management solution.

### System Components

1. **Backend Service** (Node.js/Express)
   - Core business logic and API
   - AI/ML dispatch engine
   - Database management
   - Real-time communication hub

2. **Frontend Application** (React/TypeScript)
   - User interface and dashboards
   - Real-time map visualization
   - Interactive fleet monitoring

3. **ML Service** (Python/FastAPI)
   - Machine learning dispatch predictions
   - Model training and management
   - Feature extraction and scoring

4. **Vehicle Simulator** (Node.js)
   - Hardware device simulation
   - GPS movement simulation
   - MQTT message publishing

### Key Features

- **Intelligent Dispatch**: Rule-based and ML-based vehicle selection
- **Real-time Tracking**: GPS tracking with route calculation
- **Automated Workflows**: Automatic trip creation and fault resolution
- **Multi-Protocol Communication**: REST API, WebSocket, and MQTT
- **Scalable Architecture**: Microservices with independent scaling

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend Application                      │
│                    (React/TypeScript/Vite)                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Components: Dashboard, Map, Dispatch, Alerts            │  │
│  │  State: React Context, TanStack Query                   │  │
│  │  Communication: HTTP REST, WebSocket (Socket.io)        │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ HTTP REST API
                        │ WebSocket (Socket.io)
                        │
┌───────────────────────▼─────────────────────────────────────────┐
│                    Backend Service                               │
│                  (Node.js/Express)                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Controllers: Dispatch, GPS, Fault, Vehicle, Trip        │  │
│  │  Services: Routing, ML Client, Cache, Logger            │  │
│  │  Database: MongoDB (Mongoose ODM)                        │  │
│  │  Real-time: Socket.io Server                            │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────┬───────────────┬───────────────┬─────────────────────────┘
        │               │               │
        │               │               │
        │               │               │
┌───────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
│  ML Service  │ │   MQTT      │ │  External   │
│ (FastAPI)    │ │   Broker    │ │  Services   │
│              │ │  (HiveMQ)   │ │             │
│ - Predict    │ │             │ │ - OSRM      │
│ - Train      │ │ - GPS       │ │   Routing   │
│ - Health     │ │ - Status    │ │             │
│              │ │ - Alerts    │ │             │
└──────────────┘ └──────┬──────┘ └─────────────┘
                        │
                        │ MQTT
                        │
┌───────────────────────▼─────────────────────────────────────────┐
│                  Vehicle Simulator                              │
│                    (Node.js)                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  - GPS Movement Simulation                               │  │
│  │  - Route Following                                       │  │
│  │  - MQTT Publishing                                       │  │
│  │  - Backend API Integration                               │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Interaction Overview

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Frontend   │◄───────►│   Backend    │◄───────►│  ML Service  │
│  (React)     │ WebSocket│  (Express)  │   HTTP  │  (FastAPI)   │
└──────────────┘   HTTP   └──────┬───────┘         └──────────────┘
                                  │
                                  │ MQTT
                                  │
                         ┌────────▼────────┐
                         │   MQTT Broker   │
                         │    (HiveMQ)     │
                         └────────┬────────┘
                                  │
                                  │ MQTT
                                  │
                         ┌────────▼────────┐
                         │   Simulator     │
                         │   (Node.js)     │
                         └─────────────────┘
```

---

## Component Architecture

### 1. Backend Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Express Server                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Routes Layer                                         │  │
│  │  - /api/vehicles, /api/faults, /api/gps, etc.        │  │
│  └───────────────────┬───────────────────────────────────┘  │
│                      │                                        │
│  ┌───────────────────▼───────────────────────────────────┐  │
│  │  Controllers Layer                                    │  │
│  │  - dispatchController.js (AI dispatch engine)         │  │
│  │  - gpsController.js (GPS tracking)                   │  │
│  │  - faultController.js (Fault management)             │  │
│  │  - vehicleController.js (Vehicle management)         │  │
│  └───────────────────┬───────────────────────────────────┘  │
│                      │                                        │
│  ┌───────────────────▼───────────────────────────────────┐  │
│  │  Services Layer                                        │  │
│  │  - routingService.js (OSRM/Haversine)                 │  │
│  │  - mlService.js (ML service client)                   │  │
│  │  - cacheService.js (In-memory cache)                  │  │
│  │  - socketService.js (Socket.io)                       │  │
│  │  - mqttService.js (MQTT client)                      │  │
│  └───────────────────┬───────────────────────────────────┘  │
│                      │                                        │
│  ┌───────────────────▼───────────────────────────────────┐  │
│  │  Models Layer (Mongoose)                              │  │
│  │  - Vehicle, Fault, Trip, GPS, Route, User            │  │
│  └───────────────────┬───────────────────────────────────┘  │
│                      │                                        │
│  ┌───────────────────▼───────────────────────────────────┐  │
│  │  MongoDB Database                                     │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Key Responsibilities**:
- API endpoint management
- Business logic execution
- Database operations
- Real-time event broadcasting
- MQTT message handling
- Dispatch engine orchestration

### 2. Frontend Application Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  React Application                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Pages Layer                                          │  │
│  │  - Dashboard, Maintenance, Map, etc.                 │  │
│  └───────────────────┬───────────────────────────────────┘  │
│                      │                                        │
│  ┌───────────────────▼───────────────────────────────────┐  │
│  │  Components Layer                                     │  │
│  │  - DispatchSidebar, MapView, AlertBar, etc.          │  │
│  └───────────────────┬───────────────────────────────────┘  │
│                      │                                        │
│  ┌───────────────────▼───────────────────────────────────┐  │
│  │  Services Layer                                       │  │
│  │  - apiService.ts (HTTP client)                       │  │
│  │  - socketService.ts (WebSocket client)               │  │
│  │  - routeService.ts (Route calculation)              │  │
│  └───────────────────┬───────────────────────────────────┘  │
│                      │                                        │
│  ┌───────────────────▼───────────────────────────────────┐  │
│  │  State Management                                     │  │
│  │  - React Context (Global state)                      │  │
│  │  - TanStack Query (Server state)                     │  │
│  │  - Local State (Component state)                     │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Key Responsibilities**:
- User interface rendering
- Real-time data visualization
- Map rendering and interaction
- State management
- API communication

### 3. ML Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  FastAPI Application                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  API Endpoints                                        │  │
│  │  - /api/predict (Vehicle selection)                  │  │
│  │  - /api/train (Model training)                        │  │
│  │  - /api/health (Health check)                        │  │
│  └───────────────────┬───────────────────────────────────┘  │
│                      │                                        │
│  ┌───────────────────▼───────────────────────────────────┐  │
│  │  Model Service                                        │  │
│  │  - Model loading and caching                          │  │
│  │  - Feature validation                                 │  │
│  │  - Prediction execution                               │  │
│  └───────────────────┬───────────────────────────────────┘  │
│                      │                                        │
│  ┌───────────────────▼───────────────────────────────────┐  │
│  │  Training Service                                     │  │
│  │  - Synthetic data generation                          │  │
│  │  - Model training                                    │  │
│  │  - Model evaluation                                  │  │
│  └───────────────────┬───────────────────────────────────┘  │
│                      │                                        │
│  ┌───────────────────▼───────────────────────────────────┐  │
│  │  RandomForest Model                                   │  │
│  │  - 200 estimators                                     │  │
│  │  - 6 input features                                   │  │
│  │  - Dispatch score output (0-100)                     │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Key Responsibilities**:
- ML model management
- Vehicle prediction
- Model training
- Feature validation

### 4. Vehicle Simulator Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Vehicle Simulator (Node.js)                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  VehicleSimulator (Main Controller)                   │  │
│  │  - Vehicle state management                           │  │
│  │  - GPS update loop                                    │  │
│  │  - Dispatch polling loop                              │  │
│  └───────────────────┬───────────────────────────────────┘  │
│                      │                                        │
│  ┌───────────────────▼───────────────────────────────────┐  │
│  │  Services                                              │  │
│  │  - APIClient (Backend communication)                  │  │
│  │  - MQTTPublisher (MQTT publishing)                    │  │
│  │  - RoutingService (Route calculation)                │  │
│  └───────────────────┬───────────────────────────────────┘  │
│                      │                                        │
│  ┌───────────────────▼───────────────────────────────────┐  │
│  │  External Services                                    │  │
│  │  - Backend API (REST)                                │  │
│  │  - MQTT Broker                                        │  │
│  │  - OSRM (Route calculation)                          │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Key Responsibilities**:
- Vehicle movement simulation
- GPS coordinate generation
- MQTT message publishing
- Route following

---

## Shared Services

### 1. Routing Service

**Purpose**: Calculate routes between coordinates using OSRM with Haversine fallback.

**Implementation Locations**:
- `backend/services/routingService.js`
- `vehicle-simulator/services/routingService.js`
- `frontend/src/services/routeService.ts` (calls backend)

**Features**:
- OSRM integration (public API)
- Haversine fallback on failure
- Route caching (5-minute TTL)
- Circuit breaker pattern (backend only)
- Consistent coordinate format: `[lat, lng]`

**Route Data Structure**:
```javascript
{
  distance: Number,              // meters
  duration: Number,              // seconds
  waypoints: [[lat, lng], ...],  // Array of [lat, lng] pairs
  summary: String,               // Human-readable summary
  isFallback: Boolean,           // true if Haversine fallback
  calculatedAt: Number,          // Timestamp
  source: "osrm" | "haversine"   // Route source
}
```

**Usage Flow**:
1. Backend calculates route at dispatch time
2. Route stored in database (Route model)
3. Frontend receives route via WebSocket
4. Simulator calculates route independently (if needed)
5. All components use same coordinate format

---

### 2. MQTT Communication Protocol

**Purpose**: Real-time communication with hardware devices and vehicle simulator.

**MQTT Broker**: HiveMQ Cloud (TLS on port 8883)

**Topics**:

**Subscriptions** (Backend listens):
- `vehicle/{vehicle_number}/confirmation` - Driver confirmation
- `vehicle/{vehicle_number}/resolved` - Fault resolution

**Publications** (Backend sends):
- `device/{device_id}/dispatch` - Dispatch alerts

**Publications** (Simulator sends):
- `vehicle/{vehicle_number}/gps` - GPS coordinates
- `vehicle/{vehicle_number}/status` - Status updates
- `vehicle/{vehicle_number}/resolved` - Fault resolution

**Message Formats**:

**Confirmation Message** (Device → Backend):
```json
{
  "fault_id": "string (ObjectId)",
  "confirmed": true
}
```

**Resolution Message** (Device/Simulator → Backend):
```json
{
  "fault_id": "string (ObjectId)",
  "resolved": true,
  "timestamp": "ISO 8601"
}
```

**GPS Message** (Simulator → Backend via MQTT):
```json
{
  "latitude": Number,
  "longitude": Number,
  "speed": Number,
  "heading": Number,
  "timestamp": "ISO 8601"
}
```

**Dispatch Alert** (Backend → Device):
```json
{
  "fault_id": "string (ObjectId)",
  "fault_details": "string (fault_type at fault_location)"
}
```

**Connection Management**:
- Protocol: MQTT over TLS (mqtts)
- QoS Level: 1 (at least once delivery)
- Reconnection: Automatic with exponential backoff
- Message Queue: Queued when disconnected (max 100)

---

### 3. Authentication & Authorization

**Purpose**: Secure access control across the system.

**Implementation**:
- Backend: JWT-based authentication (`middleware/auth.js`)
- Frontend: Token storage and API header injection
- Simulator: Auto-login support

**Token Structure**:
```json
{
  "id": "user_id",
  "role": "admin|dispatcher|viewer"
}
```

**Roles**:
- **Admin**: Full system access
- **Dispatcher**: Vehicle and fault management
- **Viewer**: Read-only access

**Authentication Flow**:
```
1. User/Client → POST /api/auth/login
2. Backend validates credentials
3. Backend generates JWT token (7-day expiry)
4. Client stores token
5. Client includes token in Authorization header
6. Backend validates token on each request
```

**Development Mode**:
- Many endpoints use `optionalAuth` middleware
- Allows requests without authentication in development
- Production requires authentication on all protected endpoints

---

### 4. WebSocket Communication (Socket.io)

**Purpose**: Real-time bidirectional communication between frontend and backend.

**Implementation**:
- Backend: `services/socketService.js`
- Frontend: `src/services/socketService.ts`

**Connection**:
- Protocol: WebSocket over HTTP
- CORS: Configured for frontend origin
- Auto-reconnection: Handled by Socket.io client

**Events Emitted by Backend**:

**Vehicle Events**:
- `vehicle:gps-update` - GPS coordinates updated
- `vehicle:status-change` - Vehicle status changed
- `vehicle:confirmation` - Driver confirmed dispatch
- `vehicle:resolved` - Fault resolved
- `vehicle:arrived` - Vehicle arrived at fault location

**Fault Events**:
- `fault:created` - New fault reported
- `fault:updated` - Fault status/data updated
- `fault:dispatched` - Fault dispatched to vehicle

**Dispatch Events**:
- `dispatch:complete` - Dispatch engine batch complete

**Route Events**:
- `route:updated` - Route recalculated

**Frontend Subscriptions**:
- Frontend subscribes to all events on connection
- Updates React state based on events
- Triggers UI re-renders

---

## Data Flow

### 1. Fault Reporting and Dispatch Flow

```
External System
    │
    │ POST /api/faults
    ▼
Backend (faultController)
    │
    ├─► Create Fault (status: "waiting")
    ├─► Emit WebSocket: 'fault:created'
    │
    └─► Auto-dispatch (async)
        │
        ▼
    Backend (dispatchController)
        │
        ├─► Find available vehicles
        ├─► Extract ML features (if ML enabled)
        │   │
        │   └─► ML Service (/api/predict)
        │       └─► Return best vehicle index
        │
        ├─► Select best vehicle (ML or Rule-based)
        ├─► Update Fault (status: "pending_confirmation")
        ├─► Update Vehicle (status: "onRoute")
        ├─► Calculate Route (OSRM/Haversine)
        ├─► Create Route record
        ├─► Create Alert record
        │
        ├─► Emit WebSocket: 'fault:dispatched', 'route:updated'
        │
        └─► Publish MQTT: device/{device_id}/dispatch
            │
            ▼
        Hardware Device / Simulator
            │
            └─► Driver confirms (MQTT: vehicle/{number}/confirmation)
                │
                ▼
            Backend (mqttService)
                │
                ├─► Update Fault (status: "assigned")
                ├─► Create/Reuse Trip
                ├─► Update Vehicle (status: "working")
                └─► Emit WebSocket: 'vehicle:confirmation'
```

### 2. GPS Tracking and Arrival Flow

```
Hardware Device / Simulator
    │
    │ POST /api/gps (or MQTT: vehicle/{number}/gps)
    ▼
Backend (gpsController)
    │
    ├─► Create GPS record
    ├─► Emit WebSocket: 'vehicle:gps-update'
    │
    └─► checkVehicleArrival()
        │
        ├─► Find vehicle (status: "onRoute" or "working")
        ├─► Find assigned fault
        ├─► Calculate distance to fault (Haversine)
        │
        └─► If distance <= 50m:
            │
            ├─► Update Vehicle (status: "working")
            ├─► Mark Route (status: "completed")
            ├─► Start auto-resolution timer (30s)
            └─► Emit WebSocket: 'vehicle:arrived'
```

### 3. Fault Resolution Flow

```
Hardware Device / Simulator
    │
    │ MQTT: vehicle/{number}/resolved
    ▼
Backend (mqttService)
    │
    ├─► Update Fault (status: "resolved")
    ├─► Complete Trip (status: "completed")
    ├─► Update Vehicle (status: "available")
    ├─► Cancel active routes
    ├─► Update Alert (solved: true)
    └─► Emit WebSocket: 'vehicle:resolved', 'fault:updated'
```

### 4. ML Dispatch Flow

```
Backend (dispatchController)
    │
    ├─► Check ML service availability
    │   └─► GET /api/health (ML Service)
    │
    ├─► Extract ML features for all vehicles
    │   ├─► Distance calculation (OSRM/Haversine)
    │   ├─► Performance scores (batch query)
    │   ├─► Fatigue levels (batch query)
    │   ├─► Fault history (batch query)
    │   └─► Fault severity mapping
    │
    ├─► POST /api/predict (ML Service)
    │   └─► { candidates: [feature objects] }
    │
    ├─► ML Service processes
    │   ├─► Validate features
    │   ├─► Load model
    │   ├─► Predict scores
    │   └─► Return best_index and scores
    │
    └─► Select vehicle at best_index
        └─► Continue with dispatch
```

---

## Communication Protocols

### 1. REST API

**Base URL**: `http://localhost:5000/api` (development)

**Authentication**:
- Header: `Authorization: Bearer <JWT_TOKEN>`
- Optional in development mode
- Required in production

**Content-Type**: `application/json`

**Key Endpoints**:
- `/api/faults` - Fault management
- `/api/vehicles` - Vehicle management
- `/api/gps` - GPS tracking
- `/api/dispatch/run` - Dispatch engine
- `/api/routes/calculate` - Route calculation

### 2. WebSocket (Socket.io)

**Connection**: `ws://localhost:5000` (development)

**Client Library**: Socket.io Client

**Events**: See [WebSocket Communication](#4-websocket-communication-socketio) section

### 3. MQTT

**Broker**: HiveMQ Cloud (or custom broker)

**Connection**: `mqtts://broker.hivemq.cloud:8883`

**Authentication**: Username/password

**Topics**: See [MQTT Communication Protocol](#2-mqtt-communication-protocol) section

---

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js 5.1
- **Database**: MongoDB (Mongoose ODM)
- **Real-time**: Socket.io
- **Messaging**: MQTT (mqtt.js)
- **Authentication**: JWT (jsonwebtoken)
- **Logging**: Winston
- **Validation**: Custom utilities

### Frontend
- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite
- **UI Library**: shadcn/ui, Tailwind CSS
- **State Management**: React Context, TanStack Query
- **Maps**: MapLibre GL JS
- **Real-time**: Socket.io Client
- **HTTP Client**: Axios

### ML Service
- **Framework**: FastAPI (Python)
- **ML Library**: scikit-learn
- **Data Processing**: pandas, numpy
- **Model Persistence**: joblib
- **API Validation**: Pydantic

### Vehicle Simulator
- **Runtime**: Node.js
- **HTTP Client**: Axios
- **MQTT Client**: mqtt.js
- **Configuration**: dotenv

### External Services
- **Routing**: OSRM (Open Source Routing Machine)
- **MQTT Broker**: HiveMQ Cloud
- **Database**: MongoDB Atlas or local MongoDB

---

## Deployment Architecture

### Development Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Frontend   │    │   Backend   │    │  ML Service │
│  localhost  │───►│  localhost  │───►│  localhost  │
│   :5173     │    │   :5000     │    │   :8000     │
└─────────────┘    └──────┬──────┘    └─────────────┘
                          │
                          │ MQTT
                          │
                 ┌────────▼────────┐
                 │  MQTT Broker   │
                 │  (HiveMQ)     │
                 └────────┬────────┘
                          │
                 ┌────────▼────────┐
                 │   Simulator    │
                 │   (Node.js)    │
                 └─────────────────┘
```

### Production Architecture (Docker)

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Network                       │
│                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────┐ │
│  │  Frontend   │    │   Backend   │    │    ML     │ │
│  │  Container  │───►│  Container  │───►│  Service │ │
│  │  (Nginx)    │    │  (Node.js)  │    │ (FastAPI) │ │
│  └─────────────┘    └──────┬──────┘    └──────────┘ │
│                             │                         │
│                      ┌──────▼──────┐                  │
│                      │  MongoDB    │                  │
│                      │  Container  │                  │
│                      └─────────────┘                  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  External Services                               │  │
│  │  - MQTT Broker (HiveMQ Cloud)                   │  │
│  │  - OSRM (Public API)                            │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Container Configuration

**Frontend Container**:
- Nginx for static file serving
- Reverse proxy for API calls
- WebSocket proxy configuration

**Backend Container**:
- Node.js runtime
- Environment variables for configuration
- Health check endpoint

**ML Service Container**:
- Python runtime
- Model volume mount
- Health check endpoint

**MongoDB Container**:
- Persistent volume for data
- Authentication enabled
- Connection pooling

---

## System Integration Points

### 1. Backend ↔ Frontend

**Communication**:
- REST API for CRUD operations
- WebSocket for real-time updates
- CORS configured for frontend origin

**Data Synchronization**:
- Frontend polls for initial data
- WebSocket events update state in real-time
- TanStack Query handles caching and refetching

### 2. Backend ↔ ML Service

**Communication**:
- HTTP REST API
- Health check for availability
- Prediction endpoint for vehicle selection

**Integration**:
- Automatic fallback to rule-based if ML unavailable
- Feature extraction in backend
- Result processing in backend

### 3. Backend ↔ Vehicle Simulator

**Communication**:
- REST API for status updates
- MQTT for GPS and status messages
- Polling for dispatch assignments

**Integration**:
- Simulator polls backend for dispatched faults
- Simulator sends GPS to backend via API
- Simulator publishes MQTT messages
- Backend processes MQTT messages

### 4. Backend ↔ External Services

**OSRM Routing**:
- HTTP GET requests
- Circuit breaker pattern
- Fallback to Haversine

**MQTT Broker**:
- TLS connection
- Topic subscriptions
- Message publishing

---

## Data Models and Relationships

### Core Entities

```
User
  └─► Role (reference)

Vehicle
  ├─► Driver (reference)
  ├─► HardwareDevice (reference)
  ├─► GPS (one-to-many)
  ├─► Trip (one-to-many)
  └─► Route (one-to-many)

Fault
  ├─► Vehicle (reference)
  ├─► Route (one-to-many)
  └─► Alert (one-to-one)

Trip
  ├─► Vehicle (reference)
  ├─► Driver (reference)
  ├─► GPS (reference, optional)
  └─► User (reference, managed_by)

Route
  ├─► Vehicle (reference)
  └─► Fault (reference)

GPS
  └─► Vehicle (reference)

Alert
  ├─► Fault (reference)
  └─► Vehicle (reference)
```

### Database Collections

- **vehicles**: Vehicle information and status
- **drivers**: Driver information
- **faults**: Fault reports and status
- **trips**: Trip lifecycle tracking
- **gps**: GPS coordinate history
- **routes**: Calculated routes
- **alerts**: Dispatch alerts
- **users**: User accounts
- **roles**: User roles
- **hardwaredevices**: Device registration

---

## Security Architecture

### Authentication Flow

```
Client
  │
  │ POST /api/auth/login
  │ { email, password }
  ▼
Backend
  │
  ├─► Validate credentials
  ├─► Generate JWT token
  │   └─► Payload: { id, role }
  │   └─► Expiry: 7 days
  │
  └─► Return token
      │
      ▼
  Client stores token
      │
      │ Authorization: Bearer <token>
      ▼
  Backend validates token
      │
      └─► Allow/Deny request
```

### Authorization

**Role-Based Access Control**:
- Route-level protection
- Controller-level checks
- Resource-level permissions

**Security Measures**:
- Password hashing (bcrypt, 10 rounds)
- JWT token expiration
- CORS configuration
- Input validation
- MongoDB injection prevention (Mongoose)

---

## Performance Considerations

### Caching Strategy

**Backend Cache**:
- GPS data: 5 seconds TTL
- Routes: 5 minutes TTL
- Vehicles: 30 seconds TTL
- Faults: 30 seconds TTL

**Frontend Cache**:
- TanStack Query: Automatic caching
- Route calculations: 5 minutes TTL
- Map tiles: Browser cache

### Database Optimization

**Indexes**:
- Vehicle status
- Fault status + reported_date
- GPS vehicle + timestamp
- Route vehicle + status
- Trip vehicle + status (unique partial index)

**Connection Pooling**:
- MongoDB: 2-10 connections
- MQTT: Single connection with queuing

### Batch Operations

**Backend**:
- Performance scores: Batch aggregation
- Fatigue levels: Batch aggregation
- GPS data: Batch retrieval
- Location/fault type experience: Batch queries

---

## Monitoring and Logging

### Logging Strategy

**Backend**:
- Winston logger
- File logging (error.log, combined.log)
- Console logging (development)
- Log levels: error, warn, info, debug

**Frontend**:
- Console logging (development)
- Error boundaries
- API error handling

**ML Service**:
- Python logging
- Request/response logging

### Key Metrics

**Backend**:
- Dispatch operations
- Vehicle status changes
- Fault lifecycle
- MQTT messages
- Route calculations
- Cache hit/miss rates

**ML Service**:
- Prediction latency
- Model loading time
- Training duration
- Request count

---

## Scalability Considerations

### Horizontal Scaling

**Backend**:
- Stateless design (JWT tokens)
- Multiple instances behind load balancer
- Shared MongoDB database
- Shared MQTT broker

**Frontend**:
- Static files (CDN distribution)
- API calls to load-balanced backend

**ML Service**:
- Multiple instances for prediction
- Shared model storage
- Load balancing

### Vertical Scaling

**Database**:
- MongoDB replica sets
- Read replicas
- Sharding (if needed)

**Services**:
- Resource allocation per container
- CPU and memory limits

---

## Error Handling and Resilience

### Circuit Breaker Pattern

**OSRM Routing**:
- Opens after 3 consecutive failures
- Recovery timeout: 60 seconds
- Automatic fallback to Haversine

### Fallback Mechanisms

**ML Service**:
- Automatic fallback to rule-based dispatch
- Health check before prediction
- Graceful degradation

**Routing**:
- OSRM failure → Haversine fallback
- Route caching to reduce load

### Retry Logic

**MQTT**:
- Automatic reconnection
- Exponential backoff
- Message queuing

**API Calls**:
- Retry on network errors
- Timeout configuration
- Error logging

---

## Future Architecture Enhancements

### Planned Improvements

1. **Service Mesh**: Implement service mesh for inter-service communication
2. **API Gateway**: Centralized API gateway for routing and rate limiting
3. **Message Queue**: Dedicated message queue (RabbitMQ/Kafka) for async processing
4. **Caching Layer**: Redis for distributed caching
5. **Monitoring**: Prometheus + Grafana for metrics
6. **Tracing**: Distributed tracing (Jaeger/Zipkin)
7. **Container Orchestration**: Kubernetes for production deployment

---

**Documentation Version**: 1.0  
**Last Updated**: 2025-01-XX  
**Status**: ✅ Complete

---

## References

- [Backend Documentation](./Backend/BACKEND_DOCUMENTATION.md) - Detailed backend implementation
- [Frontend Documentation](./FRONTEND_DOCUMENTATION.md) - Frontend implementation details
- [ML Service Documentation](./ml-service/AI_ML_DISPATCH_DOCUMENTATION.md) - ML dispatch engine
- [Vehicle Simulator Documentation](./vehicle-simulator/VEHICLE_SIMULATOR_DOCUMENTATION.md) - Simulator implementation

