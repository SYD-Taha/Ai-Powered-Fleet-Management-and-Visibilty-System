# Backend Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [File Structure](#file-structure)
4. [Core Components](#core-components)
5. [API Endpoints](#api-endpoints)
6. [Data Models](#data-models)
7. [Services](#services)
8. [System Flows](#system-flows)
9. [Configuration](#configuration)
10. [Deployment](#deployment)

---

## Overview

The Fleet Management System Backend is a Node.js/Express application that provides a comprehensive fleet management solution with an AI-powered dispatch engine. The system manages vehicles, drivers, faults, trips, GPS tracking, and automated vehicle assignment using intelligent algorithms.

### Key Features
- **AI Dispatch Engine**: Intelligent vehicle selection using rule-based or ML-based algorithms
- **Real-time Communication**: MQTT integration for hardware devices and WebSocket for frontend updates
- **GPS Tracking**: Real-time location tracking with route calculation
- **Automated Workflows**: Automatic trip creation, fault resolution, and status management
- **Authentication & Authorization**: JWT-based auth with role-based access control
- **Caching**: In-memory caching for performance optimization
- **Logging**: Comprehensive logging with Winston

---

## Architecture

### High-Level Architecture

```
┌─────────────────┐
│   Frontend      │
│   (React/Vue)   │
└────────┬────────┘
         │ HTTP/WebSocket
         │
┌────────▼─────────────────────────────────────────┐
│              Express Server                       │
│  ┌──────────────────────────────────────────┐  │
│  │  Routes → Controllers → Services → Models  │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │  Socket.io (Real-time Updates)           │  │
│  └──────────────────────────────────────────┘  │
└────────┬────────────────────────────────────────┘
         │
    ┌────┴────┬──────────┬──────────┬──────────┐
    │         │          │          │          │
┌───▼───┐ ┌──▼───┐ ┌────▼────┐ ┌───▼───┐ ┌───▼───┐
│MongoDB│ │ MQTT │ │  OSRM   │ │  ML   │ │Cache  │
│       │ │Broker│ │Routing  │ │Service│ │       │
└───────┘ └──────┘ └─────────┘ └───────┘ └───────┘
```

### Technology Stack
- **Runtime**: Node.js 18+
- **Framework**: Express.js 5.1
- **Database**: MongoDB (Mongoose ODM)
- **Real-time**: Socket.io
- **Messaging**: MQTT (HiveMQ Cloud)
- **Routing**: OSRM (Open Source Routing Machine)
- **Authentication**: JWT (jsonwebtoken)
- **Logging**: Winston
- **Validation**: Custom validation utilities

---

## File Structure

```
Backend/
├── index.js                    # Application entry point
├── package.json                # Dependencies and scripts
├── Dockerfile                  # Docker configuration
├── mqttService.js             # MQTT client and message handling
├── create_role.js             # Database initialization script
│
├── controllers/               # Business logic layer
│   ├── alertController.js     # Alert management
│   ├── deviceController.js    # Hardware device management
│   ├── dispatchController.js  # AI dispatch engine (core)
│   ├── driverController.js    # Driver management
│   ├── faultController.js     # Fault management
│   ├── gpsController.js       # GPS tracking and route management
│   ├── tripController.js      # Trip lifecycle management
│   ├── userController.js      # User authentication and management
│   └── vehicleController.js   # Vehicle management
│
├── models/                    # Database schemas (Mongoose)
│   ├── Alert.js               # Alert schema
│   ├── AlertCategory.js       # Alert category schema
│   ├── Driver.js              # Driver schema
│   ├── Fault.js               # Fault schema
│   ├── FaultCategory.js       # Fault category schema
│   ├── GPS.js                 # GPS coordinate schema
│   ├── HardwareDevice.js      # Hardware device schema
│   ├── Role.js                # User role schema
│   ├── Route.js               # Route schema
│   ├── Trip.js                # Trip schema
│   ├── User.js                # User schema
│   └── Vehicle.js             # Vehicle schema
│
├── routes/                     # API route definitions
│   ├── alertRoutes.js         # Alert endpoints
│   ├── authRoutes.js          # Authentication endpoints
│   ├── deviceRoutes.js        # Device endpoints
│   ├── dispatchRoutes.js      # Dispatch endpoints
│   ├── driverRoutes.js        # Driver endpoints
│   ├── faultRoutes.js         # Fault endpoints
│   ├── gpsRoutes.js           # GPS endpoints
│   ├── routeRoutes.js         # Route calculation endpoints
│   ├── tripRoutes.js          # Trip endpoints
│   ├── userRoutes.js          # User endpoints
│   └── vehicleRoutes.js       # Vehicle endpoints
│
├── services/                   # Business services
│   ├── cacheService.js        # In-memory caching
│   ├── featureExtractionService.js  # ML feature extraction
│   ├── gpsService.js          # GPS data retrieval
│   ├── logger.js              # Winston logger configuration
│   ├── mlService.js           # ML service client
│   ├── prototypeTimerService.js    # Auto-resolution timers
│   ├── routingService.js      # Route calculation (OSRM/Haversine)
│   └── socketService.js       # Socket.io management
│
├── middleware/                 # Express middleware
│   ├── auth.js                # JWT authentication & authorization
│   └── rateLimiter.js         # Rate limiting (currently disabled)
│
├── utils/                      # Utility functions
│   ├── coordinateUtils.js     # Coordinate validation and conversion
│   ├── debugLogger.js         # Debug logging utility
│   └── validation.js          # Input validation (email, password, username)
│
├── scripts/                    # Utility scripts
│   ├── addGPSForAllVehicles.js
│   ├── externalFaultSender.js  # Test utility for sending faults
│   ├── generate_location.js
│   ├── resolveAllPendingFaults.js
│   └── data/
│       └── karachi-locations.json
│
└── tests/                      # Test files
    └── test_routing.js
```

---

## Core Components

### 1. Application Entry Point (`index.js`)

**Purpose**: Initializes the Express server, connects to MongoDB, sets up routes, and starts the HTTP server with Socket.io.

**Key Responsibilities**:
- Express app configuration (CORS, JSON parsing)
- MongoDB connection with connection pooling
- Route registration
- Socket.io initialization
- Periodic cleanup jobs (stuck vehicle detection)
- MQTT service initialization

**Configuration**:
- MongoDB connection pooling (min: 2, max: 10)
- Server timeout settings
- Port configuration (default: 5000)

**Periodic Jobs**:
- Stuck vehicle cleanup (every 30 seconds)

---

### 2. MQTT Service (`mqttService.js`)

**Purpose**: Manages MQTT communication with hardware devices (ESP32/Arduino).

**Key Features**:
- Secure MQTT connection (TLS)
- Auto-reconnection with exponential backoff
- Message queuing when disconnected
- Topic subscriptions:
  - `vehicle/+/confirmation` - Driver confirmation
  - `vehicle/+/resolved` - Fault resolution
- Topic publishing:
  - `device/{device_id}/dispatch` - Dispatch alerts

**Message Handling**:
- **Confirmation**: Updates fault status, creates trip, updates vehicle status
- **Resolution**: Marks fault resolved, completes trip, resets vehicle status

**Connection Management**:
- Reconnection attempts (max: 10)
- Message queue for offline scenarios
- Connection state monitoring

---

### 3. Dispatch Controller (`controllers/dispatchController.js`)

**Purpose**: Core AI dispatch engine that selects the best vehicle for each fault.

**Dispatch Engines**:
1. **Rule-Based Engine** (default): Multi-factor weighted scoring
2. **ML Engine**: Machine learning-based prediction

**Scoring Factors** (Rule-Based):
- Performance History (25%): Historical success ratio
- Fatigue Level (20%): Today's workload
- Location Experience (15%): Previous experience at location
- Fault Type Experience (15%): Expertise with fault type
- Criticality Matching (25%): Priority-based assignment

**Key Functions**:
- `dispatchFaultToVehicle()`: Core dispatch logic
- `runDispatchEngine()`: Batch processing endpoint
- `checkStuckVehicles()`: Cleanup function
- `handleDispatchTimeout()`: Timeout handling (1 minute)

**Batch Processing**:
- Processes all waiting faults iteratively
- Safety limit: 100 iterations max
- Automatic stop when no vehicles available

---

### 4. GPS Controller (`controllers/gpsController.js`)

**Purpose**: Manages GPS tracking, route calculation, and arrival detection.

**Key Features**:
- GPS point storage
- Latest GPS retrieval
- GPS track history
- Vehicle arrival detection (50m threshold)
- Route recalculation on deviation (>200m)
- Auto-resolution timer management

**Arrival Detection**:
- Monitors GPS updates for vehicles on route
- Calculates distance to fault location
- Updates vehicle status to "working" when within 50m
- Starts auto-resolution timer

**Route Recalculation**:
- Detects deviation from expected route position
- **Conditions**: Deviation > 200m AND distance to destination > 500m
- Recalculates route from current position (OSRM with Haversine fallback)
- Marks old route as "superseded"
- Creates new route with status "active" and updated routeStartTime
- Updates route in database
- Emits WebSocket events

---

### 5. Authentication Middleware (`middleware/auth.js`)

**Purpose**: JWT-based authentication and role-based authorization.

**Functions**:
- `auth()`: Verifies JWT token
- `requireRole(...roles)`: Checks user role

**Token Structure**:
```json
{
  "id": "user_id",
  "role": "admin|dispatcher|viewer"
}
```

**Role-Based Access**:
- Admin: Full access
- Dispatcher: Vehicle/fault management
- Viewer: Read-only access

---

## API Endpoints

> **Note on Authentication**: Many endpoints use `optionalAuth` middleware in development mode (`NODE_ENV !== 'production'`), which allows requests to proceed without authentication. In production, these endpoints require authentication. This is noted with "(auth required in production)" below.

### Authentication

**Note**: Authentication endpoints exist in two locations for backward compatibility:
- `POST /api/auth/register` - Register new user (authRoutes.js)
- `POST /api/auth/login` - User login (authRoutes.js)
- `POST /api/users/register` - Register new user (userRoutes.js) - **Alternative endpoint**
- `POST /api/users/login` - User login (userRoutes.js) - **Alternative endpoint**

**Request Body** (Register):
```json
{
  "username": "string (3-30 chars, alphanumeric + _-, cannot start/end with _-)",
  "email": "string (valid email, max 320 chars)",
  "password": "string (min 8 chars, must meet complexity requirements)",
  "role": "string (role name: 'admin', 'dispatcher', 'viewer')"
}
```

**Request Body** (Login):
```json
{
  "email": "string",
  "password": "string"
}
```

**Response** (Login):
```json
{
  "token": "JWT token (7-day expiry)",
  "user": {
    "id": "user_id",
    "username": "string",
    "email": "string",
    "role": "string"
  }
}
```

### Users
- `GET /api/users` - Get all users (auth required)
- `GET /api/users/me` - Get current user (auth required)
- `PUT /api/users/:id` - Update user (auth required)

### Vehicles
- `GET /api/vehicles` - Get all vehicles (auth required in production)
- `POST /api/vehicles` - Add vehicle (auth required, admin/dispatcher only)
- `PUT /api/vehicles/:id` - Update vehicle (auth required in production)
- `DELETE /api/vehicles/:id` - Remove vehicle (auth required, admin only)
- `POST /api/vehicles/assign-device` - Assign device to vehicle (auth required, admin/dispatcher only)

### Drivers
- `GET /api/drivers` - Get all drivers (auth required)
- `POST /api/drivers` - Add driver (admin/dispatcher)
- `POST /api/drivers/assign` - Assign vehicle to driver

### Faults
- `GET /api/faults` - Get all faults (auth required in production)
- `POST /api/faults` - Report fault (auto-dispatches, auth required in production)
  - **Request Body**: `{ fault_type, fault_location, category, latitude?, longitude?, detail? }`
  - **Note**: Coordinates are validated for Karachi area (lat: 24.8-24.95, lng: 66.9-67.2)
  - **Auto-dispatch**: Fault is automatically dispatched asynchronously after creation
- `GET /api/faults/categories` - Get fault categories (auth required in production)
- `POST /api/faults/categories` - Add category (auth required, admin/dispatcher only)

### GPS
- `POST /api/gps` - Add GPS point (auth required in production)
  - **Request Body**: `{ vehicle: ObjectId, latitude: Number, longitude: Number, speed?: Number }`
  - **Validation**: Coordinates must be valid (lat: -90 to 90, lng: -180 to 180)
  - **Triggers**: Arrival detection, route recalculation
- `GET /api/gps/latest/:vehicleId` - Get latest GPS for vehicle (auth required in production)
- `GET /api/gps/track/:vehicleId` - Get GPS track history for vehicle (auth required in production)

### Dispatch
- `POST /api/dispatch/run` - Run dispatch engine (auth required)

### Trips
- `GET /api/trips` - Get all trips (auth required)
- `POST /api/trips/start` - Start trip (auth required)
- `POST /api/trips/:id/end` - End trip (auth required)

### Devices
- `GET /api/devices` - Get all devices (auth required)
- `POST /api/devices` - Register device (admin/dispatcher)

### Routes
- `GET /api/routes/calculate` - Calculate route between coordinates (auth required in production)
  - **Query Parameters**: `fromLat`, `fromLng`, `toLat`, `toLng`
  - **Response**: `{ waypoints: [[lat, lng]], distance: Number (meters), duration: Number (seconds), isFallback: Boolean, calculatedAt: Date, source: "osrm"|"haversine" }`

---

## Data Models

### Vehicle
```javascript
{
  vehicle_number: String (unique, required),
  status: Enum ["available", "idle", "onRoute", "working"],
  assigned_driver: ObjectId (ref: Driver),
  assigned_device: ObjectId (ref: HardwareDevice)
}
```

### Driver
```javascript
{
  name: String (required),
  license_number: String (unique, required),
  contact: String (required),
  assigned_vehicle: ObjectId (ref: Vehicle)
}
```

### Fault
```javascript
{
  assigned_vehicle: ObjectId (ref: Vehicle),
  fault_type: String (required),
  fault_location: String (required),
  category: Enum ["High", "Medium", "Low"] (required),
  latitude: Number,
  longitude: Number,
  detail: String,
  reported_date: Date (default: now),
  status: Enum ["waiting", "pending_confirmation", "assigned", "resolved"]
}
```

### Trip
```javascript
{
  vehicle: ObjectId (ref: Vehicle, required),
  driver: ObjectId (ref: Driver, required),
  gps: ObjectId (ref: GPS), // Optional GPS reference
  start_time: Date,
  end_time: Date,
  start_location: String,
  end_location: String,
  speed: Number, // Optional speed tracking
  status: Enum ["ongoing", "completed", "canceled"],
  managed_by: ObjectId (ref: User)
}
```

**Constraints**:
- **Unique Index**: Only one ongoing trip per vehicle allowed (partial unique index on `vehicle` where `status: "ongoing"`)
- **Trip Reuse**: If vehicle already has an ongoing trip, it's reused instead of creating a new one

### GPS
```javascript
{
  vehicle: ObjectId (ref: Vehicle, required),
  latitude: Number (-90 to 90),
  longitude: Number (-180 to 180),
  speed: Number,
  timestamp: Date (default: now)
}
```

### Alert
```javascript
{
  fault: ObjectId (ref: Fault, required),
  vehicle: ObjectId (ref: Vehicle, required),
  priority: Enum ["High", "Medium", "Low"] (required), // Matches fault category
  solved: Boolean (default: false),
  acknowledgedBy: String (default: null), // Optional: which NFC/device confirmed it
  timestamp: Date (default: now)
}
```

**Note**: Alert routes are not exposed via REST API. Alerts are created internally when dispatch occurs and managed through MQTT/WebSocket events.

### Route
```javascript
{
  vehicle: ObjectId (ref: Vehicle, required),
  fault: ObjectId (ref: Fault, required),
  waypoints: [[Number]] (array of [lat, lng] pairs, required),
  distance: Number (meters, required),
  duration: Number (seconds, required),
  source: Enum ["osrm", "haversine"] (default: "osrm"),
  isFallback: Boolean (default: false),
  calculatedAt: Date (default: now),
  routeStartTime: Date (default: now), // When route animation/execution starts
  status: Enum ["active", "completed", "cancelled", "superseded"] (default: "active"),
  geometry: Mixed, // Optional: GeoJSON LineString
  summary: String, // Optional: Route summary
  createdAt: Date, // Auto-generated (from timestamps: true)
  updatedAt: Date // Auto-generated (from timestamps: true)
}
```

**Route Recalculation Conditions**:
- Triggers when: deviation from route > 200m AND distance to destination > 500m
- Old route status: "superseded"
- New route status: "active"
- New routeStartTime: current time

### User
```javascript
{
  username: String (required, 3-30 chars, alphanumeric + _-),
  email: String (required, unique, lowercase, max 320 chars),
  password: String (required, min 8 chars, hashed with bcrypt, 10 rounds),
  role: ObjectId (ref: Role, required)
}
```

**Username Validation**:
- Length: 3-30 characters
- Pattern: `/^[a-zA-Z0-9_-]+$/` (alphanumeric, underscore, hyphen only)
- Cannot start or end with underscore or hyphen
- Trimmed before storage

**Email Validation**:
- Pattern: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- Max length: 320 characters
- Lowercased and trimmed before storage

**Password Validation**:
- Minimum 8 characters
- Must meet complexity requirements (validated in controller)
- Hashed with bcrypt (10 rounds)

### Role
```javascript
{
  name: String (required, unique),
  description: String,
  permissions: [String]
}
```

### HardwareDevice
```javascript
{
  device_id: String (required, unique),
  vehicle: ObjectId (ref: Vehicle),
  status: Enum ["active", "inactive", "maintenance"] (default: "active"),
  installed_at: Date (default: now)
}
```

### AlertCategory
```javascript
{
  category_name: String (unique, required)
}
```

### FaultCategory
```javascript
{
  category_name: String (unique, required)
}
```

---

## Services

### Cache Service (`services/cacheService.js`)

**Purpose**: In-memory caching with TTL support.

**Features**:
- TTL-based expiration
- Pattern-based deletion
- Automatic cleanup (every 60 seconds)
- Statistics tracking (hits, misses, hit rate)

**Usage**:
```javascript
cache.set('key', value, ttlSeconds);
cache.get('key');
cache.del('key');
cache.delPattern('pattern:*');
```

### Routing Service (`services/routingService.js`)

**Purpose**: Route calculation using OSRM with Haversine fallback.

**Features**:
- OSRM integration (public API)
- Circuit breaker pattern
- Route caching (5 minutes)
- Fallback to straight-line distance
- Metrics tracking

**Circuit Breaker**:
- Opens after 3 consecutive failures
- Recovery timeout: 60 seconds
- Half-open state for testing

### GPS Service (`services/gpsService.js`)

**Purpose**: Centralized GPS data retrieval with fallback strategy.

**Features**:
- Latest GPS per vehicle
- Batch GPS retrieval
- Default location fallback (Karachi center)
- GPS freshness validation
- Caching (5 seconds TTL)

### ML Service (`services/mlService.js`)

**Purpose**: Client for ML dispatch microservice.

**Features**:
- Health check
- Vehicle prediction
- Model information
- Training endpoint
- Automatic fallback on failure

### Logger Service (`services/logger.js`)

**Purpose**: Winston-based logging configuration.

**Features**:
- File logging (error.log, combined.log)
- Console logging (development)
- JSON format
- Log rotation (5MB max, 5 files)

### Socket Service (`services/socketService.js`)

**Purpose**: Socket.io server management.

**Features**:
- Server initialization
- Connection handling
- Event emission (all clients, rooms)
- CORS configuration

### Prototype Timer Service (`services/prototypeTimerService.js`)

**Purpose**: Auto-resolution timers for prototype mode and testing.

**Features**:
- 30-second auto-resolution timer
- Timer cancellation when vehicle status changes
- Timer tracking per vehicle
- Automatic fault resolution (replicates MQTT resolution logic)
- Works for all vehicles (with or without devices)

**Key Functions**:
- `startAutoResolutionTimer(vehicleId, faultId, vehicle, fault)`: Start 30-second timer
- `cancelTimer(vehicleId)`: Cancel active timer
- `cancelTimerIfNotWorking(vehicleId, newStatus)`: Cancel if status changes away from "working"
- `hasActiveTimer(vehicleId)`: Check if timer exists
- `getActiveTimerCount()`: Get count of active timers

**Auto-Resolution Process**:
1. Timer starts when vehicle arrives at fault location (within 50m)
2. After 30 seconds, automatically:
   - Updates fault status to "resolved"
   - Completes ongoing trip
   - Updates vehicle status to "available"
   - Cancels active routes
   - Marks alert as solved
   - Emits WebSocket events

---

## System Flows

### 1. Fault Reporting and Dispatch Flow

```
┌─────────────┐
│ External    │
│ System      │
└──────┬──────┘
       │ POST /api/faults
       │ { fault_type, location, category, ... }
       ▼
┌─────────────────────┐
│ faultController.js  │
│ reportFault()       │
└──────┬──────────────┘
       │
       ├─► Create Fault (status: "waiting")
       │
       ├─► Invalidate cache
       │
       ├─► Emit WebSocket: 'fault:created'
       │
       └─► Auto-dispatch (async)
           │
           ▼
┌─────────────────────┐
│ dispatchController  │
│ dispatchFaultTo... │
└──────┬──────────────┘
       │
       ├─► Find available vehicles
       │
       ├─► Score vehicles (Rule/ML)
       │   ├─ Performance (25%)
       │   ├─ Fatigue (20%)
       │   ├─ Location Exp (15%)
       │   ├─ Fault Type Exp (15%)
       │   └─ Criticality (25%)
       │
       ├─► Select best vehicle
       │
       ├─► Update Fault (status: "pending_confirmation")
       ├─► Update Vehicle (status: "onRoute")
       │
       └─► Send MQTT Alert
           │
           ▼
┌─────────────────────┐
│ alertController.js  │
│ sendDispatchAlert() │
└──────┬──────────────┘
       │
       ├─► Create Alert record
       └─► Publish MQTT: device/{device_id}/dispatch
```

### 2. Driver Confirmation Flow

```
┌─────────────┐
│ Hardware    │
│ Device      │
└──────┬──────┘
       │ MQTT: vehicle/{vehicle_number}/confirmation
       │ { fault_id, confirmed: true }
       ▼
┌─────────────────────┐
│ mqttService.js      │
│ message handler     │
└──────┬──────────────┘
       │
       ├─► Find Vehicle
       ├─► Clear dispatch timeout
       │
       ├─► Update Fault (status: "assigned")
       │
       ├─► Check for existing ongoing trip
       │   └─ If exists: Reuse existing trip
       │   └─ If not: Create new Trip
       │       ├─ vehicle: vehicle._id
       │       ├─ driver: vehicle.assigned_driver
       │       ├─ start_time: now
       │       ├─ start_location: "Depot"
       │       └─ status: "ongoing"
       │
       ├─► Update Vehicle (status: "working")
       │
       └─► Emit WebSocket events:
           ├─ 'vehicle:confirmation'
           ├─ 'fault:updated'
           └─ 'vehicle:status-change'
```

### 3. GPS Tracking and Arrival Detection Flow

```
┌─────────────┐
│ Hardware    │
│ Device      │
└──────┬──────┘
       │ POST /api/gps
       │ { vehicle, latitude, longitude, speed }
       ▼
┌─────────────────────┐
│ gpsController.js    │
│ addPoint()          │
└──────┬──────────────┘
       │
       ├─► Validate coordinates
       ├─► Create GPS record
       ├─► Invalidate cache
       ├─► Emit WebSocket: 'vehicle:gps-update'
       │
       └─► checkVehicleArrival()
           │
           ├─► Find vehicle (status: "onRoute" or "working")
           ├─► Find assigned fault
           ├─► Calculate distance to fault
           │
           └─► If distance <= 50m:
               ├─► Update Vehicle (status: "working" if not already)
               ├─► Mark Route (status: "completed")
               ├─► Start auto-resolution timer (30s) if not already started
               └─► Emit WebSocket: 'vehicle:arrived'
```

### 4. Fault Resolution Flow

```
┌─────────────┐
│ Hardware    │
│ Device      │
└──────┬──────┘
       │ MQTT: vehicle/{vehicle_number}/resolved
       │ { fault_id, resolved: true }
       ▼
┌─────────────────────┐
│ mqttService.js      │
│ message handler     │
└──────┬──────────────┘
       │
       ├─► Find Fault
       ├─► Update Fault (status: "resolved")
       │
       ├─► Find ongoing Trip
       ├─► Update Trip
       │   ├─ status: "completed"
       │   ├─ end_time: now
       │   └─ end_location: fault.fault_location
       │
       ├─► Update Vehicle (status: "available")
       ├─► Cancel active routes
       │
       ├─► Update Alert (solved: true)
       │
       └─► Emit WebSocket events:
           ├─ 'vehicle:resolved'
           ├─ 'fault:updated'
           └─ 'vehicle:status-change'
```

### 5. Auto-Resolution Timer Flow (Prototype Mode)

```
┌─────────────────────┐
│ Vehicle arrives     │
│ at fault location   │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ prototypeTimer      │
│ startAutoResolution │
│ Timer()             │
└──────┬──────────────┘
       │
       ├─► Cancel existing timer (if any)
       ├─► Start 30-second timer
       │
       └─► After 30 seconds:
           │
           ▼
┌─────────────────────┐
│ autoResolveFault()  │
└──────┬──────────────┘
       │
       ├─► Update Fault (status: "resolved")
       ├─► Complete Trip
       ├─► Update Vehicle (status: "available")
       ├─► Cancel active routes
       ├─► Update Alert (solved: true)
       └─► Emit WebSocket events
```

### 6. Route Recalculation Flow

```
┌─────────────────────┐
│ GPS Update          │
│ (vehicle onRoute)   │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ checkAndRecalculate │
│ Route()             │
└──────┬──────────────┘
       │
       ├─► Find active route
       ├─► Calculate expected position on route
       ├─► Calculate deviation from route
       │
       └─► If deviation > 200m AND distance > 500m:
           │
           ├─► Calculate new route (OSRM/Haversine)
           ├─► Mark old route (status: "superseded")
           ├─► Create new route (status: "active")
           │   └─ routeStartTime: now
           └─► Emit WebSocket: 'route:updated'
```

### 7. Dispatch Timeout Flow

```
┌─────────────────────┐
│ Dispatch sent       │
│ (1 minute timer)    │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Timeout fires       │
│ (no confirmation)   │
└──────┬──────────────┘
       │
       ├─► Clear timeout
       ├─► Add vehicle to timed-out set
       │
       ├─► Reset Vehicle (status: "available")
       │
       ├─► If fault still "pending_confirmation":
       │   ├─► Reset Fault (status: "waiting")
       │   └─► Auto-redispatch (exclude timed-out vehicle)
       │
       └─► Emit WebSocket events
```

### 8. Stuck Vehicle Cleanup Flow

```
┌─────────────────────┐
│ Periodic Job        │
│ (every 30 seconds)  │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ checkStuckVehicles()│
└──────┬──────────────┘
       │
       ├─► Find vehicles (status: "onRoute" or "working")
       │
       ├─► For each vehicle:
       │   ├─► Check for active fault
       │   ├─► Check for active dispatch timeout
       │   │
       │   └─► If no active fault AND no timeout:
       │       ├─► Reset Vehicle (status: "available")
       │       ├─► Cancel active routes
       │       └─► Emit WebSocket: 'vehicle:status-change'
       │
       └─► Invalidate cache
```

---

## WebSocket Events

The backend emits the following WebSocket events via Socket.io for real-time updates:

### Vehicle Events
- `vehicle:gps-update` - GPS coordinates updated
  ```json
  {
    "vehicleId": "string",
    "latitude": Number,
    "longitude": Number,
    "speed": Number,
    "timestamp": Date
  }
  ```
- `vehicle:status-change` - Vehicle status changed
  ```json
  {
    "vehicleId": "string",
    "status": "available|idle|onRoute|working",
    "updatedFields": Object
  }
  ```
- `vehicle:confirmation` - Driver confirmed dispatch
  ```json
  {
    "vehicleId": "string",
    "vehicleNumber": "string",
    "faultId": "string",
    "status": "assigned"
  }
  ```
- `vehicle:resolved` - Fault resolved by vehicle
  ```json
  {
    "vehicleId": "string",
    "vehicleNumber": "string",
    "faultId": "string",
    "status": "resolved"
  }
  ```
- `vehicle:arrived` - Vehicle arrived at fault location
  ```json
  {
    "vehicleId": "string",
    "faultId": "string",
    "distance": Number
  }
  ```
- `vehicle:update` - Vehicle data updated

### Fault Events
- `fault:created` - New fault reported
  ```json
  {
    "fault": {
      "_id": "string",
      "fault_type": "string",
      "fault_location": "string",
      "category": "High|Medium|Low",
      "status": "waiting",
      "latitude": Number,
      "longitude": Number,
      "detail": "string",
      "reported_date": Date
    }
  }
  ```
- `fault:updated` - Fault status/data updated
  ```json
  {
    "fault": {
      "_id": "string",
      "status": "waiting|pending_confirmation|assigned|resolved",
      "assigned_vehicle": "string" // if assigned
    }
  }
  ```
- `fault:dispatched` - Fault dispatched to vehicle
  ```json
  {
    "faultId": "string",
    "vehicleId": "string",
    "dispatchResult": Object
  }
  ```

### Dispatch Events
- `dispatch:complete` - Dispatch engine batch processing complete
  ```json
  {
    "dispatched": Number,
    "failed": Number,
    "total": Number
  }
  ```

### Route Events
- `route:updated` - Route recalculated
  ```json
  {
    "vehicleId": "string",
    "faultId": "string",
    "route": {
      "waypoints": [[Number]],
      "distance": Number,
      "duration": Number,
      "source": "osrm|haversine"
    }
  }
  ```

---

## MQTT Communication

### MQTT Topics

**Subscriptions** (Backend listens):
- `vehicle/{vehicle_number}/confirmation` - Driver confirmation message
- `vehicle/{vehicle_number}/resolved` - Fault resolution message

**Publications** (Backend sends):
- `device/{device_id}/dispatch` - Dispatch alert to hardware device

### MQTT Message Formats

**Confirmation Message** (from device):
```json
{
  "fault_id": "string (ObjectId as string)",
  "confirmed": true
}
```

**Resolution Message** (from device):
```json
{
  "fault_id": "string (ObjectId as string)",
  "resolved": true
}
```

**Dispatch Alert Message** (to device):
```json
{
  "fault_id": "string (ObjectId as string)",
  "fault_details": "string (fault_type at fault_location)"
}
```

### MQTT Connection Management

- **Protocol**: MQTT over TLS (mqtts)
- **Reconnection**: Automatic with exponential backoff
- **Max Reconnect Attempts**: 10
- **Message Queue**: Messages queued when disconnected (max 100)
- **QoS Level**: 1 (at least once delivery)
- **Keepalive**: 60 seconds

### Prototype Mode MQTT Behavior

When `PROTOTYPE_MODE=true`:
- MQTT alerts are mocked (logged instead of sent) if device is missing
- Vehicles without devices can still be dispatched
- Mock topic: `device/MOCK_DEVICE/dispatch`

---

## Configuration

### Environment Variables

```env
# MongoDB
MONGO_URI=mongodb://localhost:27017/fleet_management

# Server
PORT=5000
NODE_ENV=development|production

# JWT
JWT_SECRET=your_secret_key

# MQTT
MQTT_BROKER=your-broker.hivemq.cloud
MQTT_PORT=8883
MQTT_USERNAME=your_username
MQTT_PASSWORD=your_password

# Dispatch Engine
DISPATCH_ENGINE=Rule|AI
ML_SERVICE_URL=http://localhost:8000
ML_SERVICE_TIMEOUT=5000
ML_SERVICE_ENABLED=true
ENABLE_COMPARISON_LOGGING=false

# Prototype Mode
PROTOTYPE_MODE=false

# Frontend (for CORS/WebSocket)
FRONTEND_URL=http://localhost:5173

# Logging
LOG_LEVEL=debug|info|warn|error
```

### MongoDB Connection Options

```javascript
{
  maxPoolSize: 10,              // Max connections
  minPoolSize: 2,               // Min connections
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  bufferCommands: false
}
```

---

## Deployment

### Docker Deployment

```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

### Production Checklist

- [ ] Set strong `JWT_SECRET`
- [ ] Enable MongoDB authentication
- [ ] Use secure MQTT connection (TLS)
- [ ] Configure CORS for production domains
- [ ] Set up error monitoring
- [ ] Enable HTTPS
- [ ] Configure log aggregation
- [ ] Set up database backups
- [ ] Review security headers
- [ ] Set `PROTOTYPE_MODE=false`
- [ ] Configure rate limiting (currently disabled - re-enable in `middleware/rateLimiter.js`)
- [ ] Set `NODE_ENV=production` (enables strict authentication on all endpoints)

### Health Checks

- Root endpoint: `GET /` - Returns "Fleet backend running 🚀"
- MongoDB connection status in logs
- MQTT connection status in logs

---

## Error Handling

### Common Error Scenarios

1. **MongoDB Connection Failure**
   - Retry logic in connection options
   - Logs error with stack trace
   - Application continues (graceful degradation)

2. **MQTT Connection Failure**
   - Auto-reconnection (max 10 attempts)
   - Message queuing when offline
   - Logs connection state

3. **OSRM Service Failure**
   - Circuit breaker pattern
   - Automatic fallback to Haversine
   - Route caching to reduce load

4. **ML Service Unavailable**
   - Automatic fallback to rule-based engine
   - Logs warning
   - Dispatch continues normally

5. **GPS Data Missing**
   - Default location fallback (Karachi center)
   - Logs warning
   - System continues operation

---

## Performance Optimizations

1. **Caching**
   - GPS data: 5 seconds TTL
   - Routes: 5 minutes TTL
   - Vehicles: 30 seconds TTL
   - Faults: 30 seconds TTL

2. **Batch Queries**
   - Performance scores: Batch aggregation
   - Fatigue levels: Batch aggregation
   - GPS data: Batch retrieval
   - Location/fault type experience: Batch queries

3. **Database Indexes**
   - Vehicle status
   - Fault status + reported_date
   - GPS vehicle + timestamp
   - Route vehicle + status

4. **Connection Pooling**
   - MongoDB: 2-10 connections
   - MQTT: Single connection with queuing

---

## Security

1. **Authentication**
   - JWT tokens (7-day expiry)
   - Password hashing (bcrypt, 10 rounds)

2. **Authorization**
   - Role-based access control
   - Route-level protection

3. **Input Validation**
   - Coordinate validation
   - Email/username/password validation
   - MongoDB injection prevention (Mongoose)

4. **MQTT Security**
   - TLS encryption
   - Authentication required

---

## Monitoring and Logging

### Log Levels
- **error**: Errors and exceptions
- **warn**: Warnings and recoverable issues
- **info**: Important events (dispatch, status changes)
- **debug**: Detailed debugging information

### Log Files
- `logs/error.log` - Error-level logs
- `logs/combined.log` - All logs

### Key Events Logged
- Dispatch operations
- Vehicle status changes
- Fault lifecycle
- MQTT messages
- Route calculations
- Cache operations
- Database queries

---

## Testing

### Manual Testing

1. **Fault Reporting**
   ```bash
   node scripts/externalFaultSender.js
   ```

2. **Dispatch Engine**
   ```bash
   curl -X POST http://localhost:5000/api/dispatch/run \
     -H "Authorization: Bearer TOKEN"
   ```

3. **GPS Updates**
   ```bash
   curl -X POST http://localhost:5000/api/gps \
     -H "Content-Type: application/json" \
     -d '{"vehicle": "VEHICLE_ID", "latitude": 24.8607, "longitude": 67.0011}'
   ```

### Prototype Mode

When `PROTOTYPE_MODE=true`:
- Vehicles without devices can be dispatched
- MQTT alerts are mocked (logged instead of sent) if device is missing
- Auto-resolution timer starts when vehicle arrives at fault location (30 seconds)
- System works without physical hardware devices

**Auto-Resolution Timer**:
- Starts when vehicle arrives within 50m of fault location
- Duration: 30 seconds
- Automatically resolves fault, completes trip, and resets vehicle status
- Works for all vehicles (with or without devices)
- Timer is cancelled if vehicle status changes away from "working"

---

## Future Enhancements

1. **GPS-Based Distance** (Phase 2)
   - Real-time distance calculation
   - Traffic integration
   - Route optimization

2. **Advanced ML Features**
   - Model retraining
   - Feature importance analysis
   - Performance comparison

3. **Multi-Fault Dispatch**
   - Batch optimization
   - Global assignment algorithm

4. **Shift Management**
   - Work shift definitions
   - Shift-based fatigue calculation

5. **Analytics Dashboard**
   - Performance metrics
   - Dispatch statistics
   - Vehicle utilization

---

## Support and Maintenance

### Common Issues

1. **Vehicles Stuck in "onRoute"**
   - Check periodic cleanup job
   - Verify MQTT confirmation received
   - Check dispatch timeout

2. **Routes Not Recalculating**
   - Verify GPS updates are being sent
   - Check deviation threshold (200m)
   - Verify route calculation service

3. **Dispatch Not Working**
   - Check available vehicles
   - Verify device assignments
   - Check MQTT connection

### Debugging

- Enable debug logging: `LOG_LEVEL=debug`
- Check MQTT connection status in logs
- Monitor WebSocket connections
- Review cache statistics
- Check route calculation metrics

---

---

## Development Mode Behavior

### Optional Authentication

In development mode (`NODE_ENV !== 'production'`), many endpoints use `optionalAuth` middleware which:
- **Development**: Allows requests to proceed without authentication
- **Production**: Requires valid JWT token

**Affected Endpoints**:
- `GET /api/vehicles`
- `PUT /api/vehicles/:id`
- `GET /api/faults`
- `POST /api/faults`
- `GET /api/faults/categories`
- `POST /api/gps`
- `GET /api/gps/latest/:vehicleId`
- `GET /api/gps/track/:vehicleId`
- `GET /api/routes/calculate`

**Always Require Authentication** (regardless of environment):
- `POST /api/vehicles` (admin/dispatcher)
- `DELETE /api/vehicles/:id` (admin)
- `POST /api/vehicles/assign-device` (admin/dispatcher)
- `GET /api/drivers` (all roles)
- `POST /api/drivers` (admin/dispatcher)
- `POST /api/drivers/assign` (admin/dispatcher)
- `POST /api/faults/categories` (admin/dispatcher)
- `POST /api/dispatch/run` (all authenticated users)
- `GET /api/trips` (all authenticated users)
- `POST /api/trips/start` (all authenticated users)
- `POST /api/trips/:id/end` (all authenticated users)
- `GET /api/devices` (all authenticated users)
- `POST /api/devices` (admin/dispatcher)
- `GET /api/users` (all authenticated users)
- `GET /api/users/me` (all authenticated users)
- `PUT /api/users/:id` (all authenticated users)

---

## Rate Limiting

**Current Status**: ⚠️ **DISABLED** for development/testing

Rate limiting middleware exists in `middleware/rateLimiter.js` but is currently commented out/disabled across all routes. To enable:

1. Uncomment rate limiter imports in route files
2. Uncomment rate limiter usage in `index.js` and route files
3. Configure appropriate limits for production

---

**Documentation Version**: 2.0  
**Last Updated**: 2025-01-XX  
**Status**: ✅ Complete and Verified

