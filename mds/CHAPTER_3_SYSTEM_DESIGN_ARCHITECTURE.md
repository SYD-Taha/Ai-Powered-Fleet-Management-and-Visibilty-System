# Chapter 3: System Design and Architecture

## 3.1 Overview

The Fleet Management System is built on a distributed microservices architecture designed for intelligent vehicle dispatch, real-time GPS tracking, and automated fault management. The system consists of four primary components working together to provide a comprehensive fleet management solution with AI-powered decision-making capabilities.

### 3.1.1 System Components

The system is composed of the following main components:

1. **Frontend Application** (React/TypeScript) - User interface and real-time visualization
2. **Backend Service** (Node.js/Express) - Core business logic and API gateway
3. **ML Service** (Python/FastAPI) - Machine learning dispatch predictions
4. **Vehicle Simulator** (Node.js) - Hardware device simulation for testing

---

## 3.2 Overall System Architecture

### 3.2.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend Application                         │
│                      (React/TypeScript/Vite)                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Components: Dashboard, Map, Dispatch, Alerts                │  │
│  │  State Management: React Context, TanStack Query             │  │
│  │  Communication: HTTP REST, WebSocket (Socket.io)             │  │
│  └──────────────────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────────────────┘
                        │
                        │ HTTP REST API
                        │ WebSocket (Socket.io)
                        │
┌───────────────────────▼─────────────────────────────────────────────┐
│                        Backend Service                               │
│                      (Node.js/Express)                               │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Controllers: Dispatch, GPS, Fault, Vehicle, Trip            │  │
│  │  Services: Routing, ML Client, Cache, Logger, Socket         │  │
│  │  Database: MongoDB (Mongoose ODM)                            │  │
│  │  Real-time: Socket.io Server                                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
└───────┬───────────────┬───────────────┬─────────────────────────────┘
        │               │               │
        │               │               │
        │               │               │
┌───────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
│  ML Service  │ │   MQTT      │ │  External   │
│  (FastAPI)   │ │   Broker    │ │  Services   │
│              │ │  (HiveMQ)   │ │             │
│ - Predict    │ │             │ │ - OSRM      │
│ - Train      │ │ - GPS       │ │   Routing   │
│ - Health     │ │ - Status    │ │             │
│              │ │ - Alerts    │ │             │
└──────────────┘ └──────┬──────┘ └─────────────┘
                        │
                        │ MQTT
                        │
┌───────────────────────▼─────────────────────────────────────────────┐
│                    Vehicle Simulator                                 │
│                      (Node.js)                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  - GPS Movement Simulation                                   │  │
│  │  - Route Following                                           │  │
│  │  - MQTT Publishing                                           │  │
│  │  - Backend API Integration                                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2.2 Deployment Architecture

The system is containerized using Docker Compose, enabling consistent deployment across development and production environments:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Docker Network                                │
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────────┐       │
│  │  Frontend   │    │   Backend   │    │  ML Service  │       │
│  │  Container  │───►│  Container  │───►│   Container  │       │
│  │  (Nginx)    │    │  (Node.js)  │    │  (FastAPI)   │       │
│  │  :5173      │    │   :5000     │    │    :8000     │       │
│  └─────────────┘    └──────┬──────┘    └──────────────┘       │
│                             │                                   │
│                      ┌──────▼──────┐                           │
│                      │  MongoDB    │                           │
│                      │  Database   │                           │
│                      └─────────────┘                           │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  External Services                                       │  │
│  │  - MQTT Broker (HiveMQ Cloud)                           │  │
│  │  - OSRM (Public API)                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3.3 Component Interaction Diagrams

### 3.3.1 Component Interaction Overview

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Frontend   │◄───────►│   Backend    │◄───────►│  ML Service  │
│  (React)     │ WebSocket│  (Express)  │   HTTP  │  (FastAPI)   │
└──────────────┘   HTTP   └──────┬──────┘         └──────────────┘
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

### 3.3.2 Backend Service Architecture

The backend follows a layered architecture pattern:

```
┌─────────────────────────────────────────────────────────────┐
│                    Express Server                            │
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

### 3.3.3 Frontend Application Architecture

The frontend follows a component-based architecture with state management:

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

### 3.3.4 ML Service Architecture

The ML service follows a microservice pattern with clear separation of concerns:

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

---

## 3.4 Data Flow Diagrams

### 3.4.1 Fault Reporting and Dispatch Flow

```
External System / Frontend
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

### 3.4.2 GPS Tracking and Arrival Flow

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

### 3.4.3 ML Dispatch Prediction Flow

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

### 3.4.4 Real-Time Data Synchronization Flow

```
Backend Event (GPS Update, Fault Change, etc.)
    │
    ├─► Update MongoDB Database
    │
    ├─► Emit Socket.io Event
    │   │
    │   └─► Frontend (socketService.ts)
    │       │
    │       ├─► Update React State (TanStack Query)
    │       ├─► Trigger UI Re-render
    │       └─► Update Map Components
    │
    └─► (If applicable) Publish MQTT Message
        │
        └─► Hardware Device / Simulator
            └─► Process message and respond
```

---

## 3.5 Technology Stack Overview

### 3.5.1 Backend Technology Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Runtime | Node.js | 18+ | JavaScript runtime environment |
| Framework | Express.js | 5.1 | Web application framework |
| Database | MongoDB | Latest | NoSQL document database |
| ODM | Mongoose | 8.17+ | MongoDB object modeling |
| Real-time | Socket.io | 4.7+ | WebSocket communication |
| Messaging | MQTT (mqtt.js) | 5.14+ | IoT messaging protocol |
| Authentication | JWT (jsonwebtoken) | 9.0+ | Token-based authentication |
| Logging | Winston | 3.11+ | Logging library |
| HTTP Client | Axios | 1.12+ | HTTP request library |
| Encryption | bcrypt | 6.0+ | Password hashing |

### 3.5.2 Frontend Technology Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Framework | React | 18.3+ | UI library |
| Language | TypeScript | 5.5+ | Type-safe JavaScript |
| Build Tool | Vite | 5.4+ | Build tool and dev server |
| UI Library | shadcn/ui | Latest | Component library |
| Styling | Tailwind CSS | 3.4+ | Utility-first CSS |
| State Management | TanStack Query | 5.56+ | Server state management |
| State Management | React Context | Built-in | Global state |
| Maps | MapLibre GL JS | 3.6+ | WebGL map rendering |
| Real-time | Socket.io Client | 4.7+ | WebSocket client |
| HTTP Client | Axios | 1.12+ | HTTP request library |
| Routing | React Router | 6.26+ | Client-side routing |
| Forms | React Hook Form | 7.53+ | Form handling |
| Validation | Zod | 3.23+ | Schema validation |

### 3.5.3 ML Service Technology Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Framework | FastAPI | 0.104+ | Python web framework |
| Runtime | Python | 3.8+ | Python runtime |
| ML Library | scikit-learn | 1.4+ | Machine learning |
| Data Processing | pandas | 2.2+ | Data manipulation |
| Numerical Computing | numpy | 2.0+ | Numerical operations |
| Model Persistence | joblib | 1.3+ | Model serialization |
| API Validation | Pydantic | 2.5+ | Data validation |
| ASGI Server | Uvicorn | 0.24+ | ASGI server |

### 3.5.4 Vehicle Simulator Technology Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Runtime | Node.js | 18+ | JavaScript runtime |
| HTTP Client | Axios | Latest | API communication |
| MQTT Client | mqtt.js | 5.3+ | MQTT messaging |
| Configuration | dotenv | Latest | Environment variables |

### 3.5.5 External Services

| Service | Purpose | Protocol |
|---------|---------|----------|
| MongoDB | Primary database | MongoDB Protocol |
| HiveMQ Cloud | MQTT message broker | MQTT over TLS |
| OSRM | Routing service | HTTP REST API |

---

## 3.6 Design Patterns and Methodologies

### 3.6.1 Architectural Patterns

#### 3.6.1.1 Microservices Architecture

The system follows a microservices pattern where each component operates independently:

- **Frontend Service**: Handles user interface and client-side logic
- **Backend Service**: Core business logic and API gateway
- **ML Service**: Specialized machine learning predictions
- **Vehicle Simulator**: Testing and development tool

**Benefits**:
- Independent scaling and deployment
- Technology diversity (Node.js, Python)
- Fault isolation
- Clear service boundaries

#### 3.6.1.2 Layered Architecture (Backend)

The backend follows a layered architecture pattern:

```
Routes → Controllers → Services → Models → Database
```

**Benefits**:
- Separation of concerns
- Maintainability
- Testability
- Clear data flow

#### 3.6.1.3 Component-Based Architecture (Frontend)

The frontend uses a component-based architecture with React:

- Reusable UI components
- Composition over inheritance
- Single Responsibility Principle
- State management separation

### 3.6.2 Design Patterns

#### 3.6.2.1 Circuit Breaker Pattern

**Implementation**: `backend/services/routingService.js`

**Purpose**: Prevents cascading failures when external services (OSRM) are unavailable.

**Configuration**:
- Failure threshold: 3 consecutive failures
- Recovery timeout: 60 seconds
- Half-open attempts: 1

**States**:
- **Closed**: Normal operation, requests allowed
- **Open**: Service unavailable, requests blocked
- **Half-open**: Testing recovery, limited requests allowed

#### 3.6.2.2 Singleton Pattern

**Implementation**: 
- `backend/services/cacheService.js` - Cache instance
- `backend/services/socketService.js` - Socket.io instance
- `frontend/src/services/aiDispatchService.ts` - Service instance

**Purpose**: Ensures single instance of shared resources across the application.

#### 3.6.2.3 Repository Pattern

**Implementation**: Mongoose models (`backend/models/`)

**Purpose**: Abstracts database access and provides consistent interface for data operations.

#### 3.6.2.4 Strategy Pattern

**Implementation**: Dispatch engine (`backend/controllers/dispatchController.js`)

**Purpose**: Allows switching between rule-based and ML-based dispatch strategies dynamically.

#### 3.6.2.5 Observer Pattern

**Implementation**: 
- Socket.io events (real-time updates)
- MQTT message subscriptions
- React state updates

**Purpose**: Decouples event producers from consumers, enabling real-time communication.

#### 3.6.2.6 Factory Pattern

**Implementation**: Feature extraction (`backend/services/featureExtractionService.js`)

**Purpose**: Creates ML feature objects from various data sources with consistent structure.

### 3.6.3 Design Methodologies

#### 3.6.3.1 RESTful API Design

The backend follows REST principles:

- Resource-based URLs (`/api/vehicles`, `/api/faults`)
- HTTP methods (GET, POST, PUT, DELETE)
- Stateless communication
- JSON response format
- Status codes for errors

#### 3.6.3.2 Event-Driven Architecture

Real-time updates using event-driven patterns:

- **WebSocket Events**: Frontend ↔ Backend bidirectional communication
- **MQTT Events**: Hardware devices ↔ Backend messaging
- **Database Events**: Trigger-based workflows

#### 3.6.3.3 Caching Strategy

Multi-level caching implementation:

- **Backend Cache**: In-memory cache with TTL (routes, GPS, vehicles)
- **Frontend Cache**: TanStack Query automatic caching
- **Route Cache**: 5-minute TTL for route calculations
- **GPS Cache**: 5-second TTL for recent locations

#### 3.6.3.4 Fallback Mechanisms

Resilient system design with automatic fallbacks:

- **Routing**: OSRM → Haversine fallback
- **ML Service**: ML prediction → Rule-based dispatch fallback
- **MQTT**: Message queuing when disconnected

#### 3.6.3.5 Batch Processing

Efficient data processing:

- Batch feature extraction for ML predictions
- Batch GPS data retrieval
- Batch performance score calculations
- Batch fatigue level calculations

---

## 3.7 Integration Strategy

### 3.7.1 Frontend-Backend Integration

**Communication Protocols**:
- **HTTP REST API**: CRUD operations, data fetching
- **WebSocket (Socket.io)**: Real-time event updates

**Integration Points**:
- API base URL configuration via environment variables
- JWT token authentication in HTTP headers
- Socket.io connection with auto-reconnection
- CORS configuration for cross-origin requests

**Data Flow**:
1. Frontend sends HTTP requests to backend API
2. Backend processes requests and updates database
3. Backend emits Socket.io events for real-time updates
4. Frontend receives events and updates React state
5. UI re-renders with new data

### 3.7.2 Backend-ML Service Integration

**Communication Protocol**: HTTP REST API

**Integration Points**:
- Health check endpoint (`/api/health`)
- Prediction endpoint (`/api/predict`)
- Training endpoint (`/api/train`)

**Integration Flow**:
1. Backend checks ML service availability
2. Backend extracts features from vehicles and faults
3. Backend sends batch prediction request
4. ML service validates features and runs model
5. ML service returns best vehicle index and scores
6. Backend uses result or falls back to rule-based dispatch

**Error Handling**:
- Automatic fallback to rule-based dispatch on ML service failure
- Timeout configuration (5 seconds default)
- Health check before prediction requests
- Graceful degradation

### 3.7.3 Backend-Vehicle Simulator Integration

**Communication Protocols**:
- **HTTP REST API**: Status updates, GPS posting
- **MQTT**: GPS coordinates, status messages, confirmations

**Integration Points**:
- Backend API endpoints for vehicle management
- MQTT topic subscriptions and publications
- Polling mechanism for dispatch assignments

**Integration Flow**:
1. Simulator polls backend for dispatched faults
2. Simulator publishes GPS updates via MQTT
3. Backend processes MQTT messages and updates database
4. Backend emits WebSocket events to frontend
5. Simulator receives MQTT dispatch alerts
6. Simulator confirms via MQTT or API

### 3.7.4 Backend-External Services Integration

#### 3.7.4.1 OSRM Routing Service

**Communication Protocol**: HTTP REST API

**Integration Strategy**:
- Circuit breaker pattern for resilience
- Automatic fallback to Haversine distance calculation
- Route caching (5-minute TTL) to reduce API calls
- Consistent coordinate format: `[latitude, longitude]`

**Error Handling**:
- Circuit breaker opens after 3 failures
- Automatic recovery after 60 seconds
- Fallback calculation using Haversine formula

#### 3.7.4.2 MQTT Broker (HiveMQ Cloud)

**Communication Protocol**: MQTT over TLS (mqtts)

**Integration Strategy**:
- Persistent connection with auto-reconnection
- Message queuing when disconnected
- QoS Level 1 (at least once delivery)
- Topic-based message routing

**Topics Structure**:
- **Subscriptions**: `vehicle/{vehicle_number}/confirmation`, `vehicle/{vehicle_number}/resolved`
- **Publications**: `device/{device_id}/dispatch`

### 3.7.5 Database Integration

**Database**: MongoDB

**Integration Strategy**:
- Mongoose ODM for schema validation
- Connection pooling (2-10 connections)
- Indexes for performance optimization
- Transaction support for atomic operations

**Data Models**:
- Vehicle, Fault, Trip, GPS, Route, User, Driver, Alert, HardwareDevice

**Relationships**:
- Reference-based relationships (ObjectId references)
- Embedded documents for simple nested data
- One-to-many and many-to-many relationships

### 3.7.6 Container Integration (Docker)

**Integration Strategy**:
- Docker Compose for multi-container orchestration
- Service discovery via container names
- Environment variables for configuration
- Volume mounts for persistent data
- Network isolation and communication

**Container Dependencies**:
- Frontend depends on Backend
- Backend depends on ML Service
- All services connect to MongoDB
- Backend connects to MQTT Broker (external)
- Backend connects to OSRM (external)

### 3.7.7 Authentication and Authorization Integration

**Integration Strategy**:
- JWT tokens for stateless authentication
- Role-based access control (RBAC)
- Token storage in frontend (localStorage)
- Token validation middleware in backend
- Optional authentication for development

**Flow**:
1. User logs in via `/api/auth/login`
2. Backend validates credentials and generates JWT
3. Frontend stores token and includes in requests
4. Backend validates token on protected routes
5. Role-based permissions enforced at controller level

---

## 3.8 System Integration Summary

The system integrates multiple components through well-defined interfaces and communication protocols:

1. **Frontend ↔ Backend**: REST API and WebSocket for bidirectional communication
2. **Backend ↔ ML Service**: HTTP REST API with automatic fallback
3. **Backend ↔ Simulator**: REST API and MQTT for dual-channel communication
4. **Backend ↔ External Services**: HTTP (OSRM) and MQTT (HiveMQ) with resilience patterns
5. **All Services ↔ Database**: MongoDB with Mongoose ODM

Each integration point implements appropriate error handling, fallback mechanisms, and resilience patterns to ensure system reliability and availability.

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-XX  
**Status**: ✅ Complete


