# AI-Powered Fleet Management and Visibility System

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.8%2B-blue.svg)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-18.3-blue.svg)](https://reactjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.0%2B-green.svg)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

A comprehensive, production-ready fleet management system with intelligent AI-powered dispatch engine, real-time GPS tracking, and advanced visibility features. The system automatically assigns vehicles to faults using machine learning and rule-based algorithms, optimizing fleet operations through intelligent decision-making.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Project](#running-the-project)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

The AI-Powered Fleet Management and Visibility System is a full-stack solution designed to optimize fleet operations through intelligent vehicle dispatch, real-time tracking, and comprehensive fleet management. The system combines rule-based algorithms with machine learning to make optimal dispatch decisions based on vehicle performance, location experience, fault type expertise, and workload balancing.

### Key Capabilities

- **Intelligent Dispatch**: Dual-engine system (Rule-Based and ML) for optimal vehicle assignment
- **Real-Time Tracking**: Live GPS tracking with route calculation and arrival detection
- **Automated Workflows**: End-to-end automation from fault reporting to resolution
- **Hardware Integration**: MQTT-based communication with ESP32/Arduino devices
- **Comprehensive Dashboard**: Modern React-based frontend with real-time updates
- **Scalable Architecture**: Microservices-based design with Docker support

## ✨ Features

### Core Fleet Management

- **Vehicle Management**: Complete CRUD operations with status tracking (available, idle, onRoute, working)
- **Driver Management**: Driver assignment and vehicle-driver relationship management
- **Fault Management**: Fault reporting with priority categorization (High/Medium/Low) and automatic dispatch
- **Trip Tracking**: Automated trip lifecycle management (create → ongoing → completed)
- **GPS Tracking**: Real-time GPS coordinate tracking with historical route data
- **Hardware Device Management**: ESP32/Arduino device registration and assignment

### AI Dispatch Engine

#### Dual Engine Support

1. **Rule-Based Engine** (Default)
   - Multi-factor weighted scoring algorithm
   - Performance History (25% weight)
   - Fatigue Level (20% weight)
   - Location Experience (15% weight)
   - Fault Type Experience (15% weight)
   - Criticality Matching (25% weight)

2. **ML Engine** (Machine Learning)
   - RandomForest-based prediction model
   - Automatic fallback to rule-based if ML service unavailable
   - Feature extraction from vehicle and fault data
   - Distance calculation with routing integration

#### Intelligent Features

- **Automated Vehicle Selection**: Best vehicle selection for waiting faults
- **Performance-Based Scoring**: Historical success ratio consideration
- **Workload Balancing**: Fatigue level tracking to prevent overworking
- **Location Intelligence**: Previous experience at fault location
- **Fault Type Expertise**: Specialization tracking for fault types
- **Priority Matching**: Critical faults assigned to high performers

### Real-Time Communication

- **MQTT Integration**: Secure MQTT communication with hardware devices
- **WebSocket Support**: Real-time updates to frontend via Socket.io
- **Dispatch Alerts**: Automatic notifications to hardware devices
- **Status Synchronization**: Real-time status updates across all components

### Authentication & Security

- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access Control**: Admin, Dispatcher, and Viewer roles
- **Password Security**: bcrypt hashing with 10 rounds
- **MQTT Security**: TLS encryption for broker connections
- **Input Validation**: Comprehensive validation for all inputs

### Advanced Features

- **Route Calculation**: OSRM integration with Haversine fallback
- **Arrival Detection**: Automatic detection when vehicle arrives at fault location (50m threshold)
- **Route Recalculation**: Dynamic route updates on deviation (>200m)
- **Auto-Resolution**: Automatic fault resolution with configurable timers
- **Caching**: In-memory caching for performance optimization
- **Logging**: Comprehensive logging with Winston

## 🏗️ Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│              (React + TypeScript + Vite)                     │
│         Real-time Dashboard with Map Visualization          │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP/WebSocket
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                      Backend API                            │
│              (Node.js + Express + MongoDB)                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Controllers → Services → Models                     │  │
│  │  - Dispatch Engine (Rule/ML)                         │  │
│  │  - GPS Tracking & Route Calculation                   │  │
│  │  - MQTT Service                                        │  │
│  │  - Socket.io (Real-time Updates)                     │  │
│  └──────────────────────────────────────────────────────┘  │
└───────┬───────────────────┬───────────────────┬─────────────┘
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   MongoDB    │  │  MQTT Broker │  │  ML Service  │
│  (Database)  │  │   (HiveMQ)   │  │   (Python)   │
└──────────────┘  └──────────────┘  └──────────────┘
        │                   │                   │
        │                   │                   │
┌───────▼───────────────────▼───────────────────▼─────────────┐
│              Vehicle Simulator (Optional)                    │
│         (Node.js - For Testing/Demo Purposes)               │
└─────────────────────────────────────────────────────────────┘
```

### Component Interaction

1. **Frontend** → Communicates with Backend via REST API and WebSocket
2. **Backend** → Manages business logic, dispatch engine, and data persistence
3. **ML Service** → Provides machine learning predictions for dispatch decisions
4. **MQTT Broker** → Handles communication with hardware devices
5. **Vehicle Simulator** → Simulates vehicle movement for testing/demo

## 🛠️ Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js 5.1
- **Database**: MongoDB (Mongoose ODM)
- **Real-time**: Socket.io
- **Messaging**: MQTT (HiveMQ Cloud)
- **Routing**: OSRM (Open Source Routing Machine)
- **Authentication**: JWT (jsonwebtoken)
- **Logging**: Winston
- **Validation**: Custom validation utilities

### Frontend
- **Framework**: React 18.3
- **Language**: TypeScript
- **Build Tool**: Vite
- **UI Components**: Radix UI + shadcn/ui
- **Styling**: Tailwind CSS
- **State Management**: React Query (TanStack Query)
- **Routing**: React Router DOM
- **Maps**: MapLibre GL
- **Real-time**: Socket.io Client
- **Forms**: React Hook Form + Zod

### ML Service
- **Framework**: FastAPI
- **Language**: Python 3.8+
- **ML Library**: scikit-learn
- **Data Processing**: pandas, numpy
- **Model Persistence**: joblib

### Vehicle Simulator
- **Runtime**: Node.js 18+
- **HTTP Client**: Axios
- **MQTT Client**: mqtt (v5.3.0)

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Version Control**: Git

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

### Required Software

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **Python** (v3.8 or higher) - [Download](https://www.python.org/)
- **MongoDB** (v6.0 or higher) - [Download](https://www.mongodb.com/try/download/community) or use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- **Git** - [Download](https://git-scm.com/)
- **Docker** (optional, for containerized deployment) - [Download](https://www.docker.com/)

### Required Services

- **MQTT Broker** - [HiveMQ Cloud](https://www.hivemq.com/cloud/) (free tier available) or self-hosted
- **OSRM Server** (optional) - Public API available, or self-hosted for production

### Development Tools (Optional)

- **Postman** or **Insomnia** - For API testing
- **MongoDB Compass** - For database management
- **MQTT Client** - For testing MQTT communication

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd "Ai Powered Fleet Management and Visibilty System"
```

### 2. Backend Setup

```bash
cd backend
npm install
```

### 3. Frontend Setup

```bash
cd ../frontend
npm install
```

### 4. ML Service Setup

```bash
cd ../ml-service

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Train initial model
python scripts/train_model.py
```

### 5. Vehicle Simulator Setup (Optional)

```bash
cd ../vehicle-simulator
npm install
```

## ⚙️ Configuration

### Backend Configuration

Create a `.env` file in the `backend` directory:

```env
# MongoDB Configuration
MONGO_URI=mongodb://localhost:27017/fleet_management
# Or for MongoDB Atlas:
# MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/fleet_management

# Server Configuration
PORT=5000
NODE_ENV=development

# JWT Secret (Generate a strong random string in production!)
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production

# MQTT Configuration
MQTT_BROKER=your-broker.hivemq.cloud
MQTT_PORT=8883
MQTT_USERNAME=your_mqtt_username
MQTT_PASSWORD=your_mqtt_password

# ML Service Configuration
ML_SERVICE_URL=http://localhost:8000
ML_SERVICE_TIMEOUT=5000
ML_SERVICE_ENABLED=true

# Dispatch Engine Configuration
DISPATCH_ENGINE=Rule  # Options: "Rule" or "AI"
ENABLE_COMPARISON_LOGGING=false

# Prototype Mode (for development/testing)
PROTOTYPE_MODE=false

# Frontend URL (for CORS/WebSocket)
FRONTEND_URL=http://localhost:5173

# Logging
LOG_LEVEL=info  # Options: debug, info, warn, error
```

### Frontend Configuration

Create a `.env` file in the `frontend` directory:

```env
VITE_API_URL=http://localhost:5000
VITE_WS_URL=ws://localhost:5000
```

### ML Service Configuration

Create a `.env` file in the `ml-service` directory:

```env
PORT=8000
MODEL_PATH=models/dispatch_ml_model.pkl
LOG_LEVEL=INFO
```

### Vehicle Simulator Configuration

Create a `.env` file in the `vehicle-simulator` directory:

```env
# Backend API Configuration
BACKEND_URL=http://localhost:5000
AUTH_TOKEN=your_jwt_token_here

# Optional: Auto-login credentials
AUTH_EMAIL=user@example.com
AUTH_PASSWORD=password123

# MQTT Configuration
MQTT_BROKER=your-broker.hivemq.cloud
MQTT_PORT=8883
MQTT_USERNAME=your_mqtt_username
MQTT_PASSWORD=your_mqtt_password

# Simulation Settings
GPS_UPDATE_INTERVAL=3000
DISPATCH_CHECK_INTERVAL=5000
AVERAGE_SPEED=40
WORK_TIME_MIN=5
WORK_TIME_MAX=15
```

### Database Initialization

After setting up MongoDB, initialize the database roles:

```bash
cd backend
node create_role.js
```

This creates the default roles (Admin, Dispatcher, Viewer) in the database.

## 🏃 Running the Project

### Development Mode

#### Option 1: Run All Services Individually

**Terminal 1 - Backend:**
```bash
cd backend
npm start
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

**Terminal 3 - ML Service:**
```bash
cd ml-service
source venv/bin/activate  # or venv\Scripts\activate on Windows
uvicorn app.main:app --reload --port 8000
```

**Terminal 4 - Vehicle Simulator (Optional):**
```bash
cd vehicle-simulator
npm start
```

#### Option 2: Docker Compose (Recommended)

```bash
# From project root
docker-compose up --build
```

This will start all services:
- Backend: `http://localhost:5000`
- Frontend: `http://localhost:5173`
- ML Service: `http://localhost:8000`

### Production Mode

1. Set `NODE_ENV=production` in all `.env` files
2. Use Docker Compose for deployment
3. Configure production MongoDB, MQTT broker, and other services
4. Set strong `JWT_SECRET` values
5. Enable HTTPS for all services
6. Configure proper CORS settings

## 📁 Project Structure

```
Ai Powered Fleet Management and Visibilty System/
├── backend/                    # Node.js Backend API
│   ├── controllers/           # Business logic controllers
│   │   ├── dispatchController.js    # AI dispatch engine
│   │   ├── vehicleController.js
│   │   ├── faultController.js
│   │   ├── gpsController.js
│   │   └── ...
│   ├── models/                # Mongoose schemas
│   ├── routes/                # API route definitions
│   ├── services/              # Business services
│   │   ├── mlService.js       # ML service client
│   │   ├── routingService.js  # Route calculation
│   │   ├── socketService.js   # WebSocket management
│   │   └── ...
│   ├── middleware/            # Express middleware
│   ├── utils/                 # Utility functions
│   ├── scripts/               # Utility scripts
│   ├── index.js               # Application entry point
│   └── package.json
│
├── frontend/                  # React Frontend
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── pages/            # Page components
│   │   ├── services/        # API services
│   │   ├── hooks/           # Custom React hooks
│   │   └── ...
│   └── package.json
│
├── ml-service/                # Python ML Service
│   ├── app/
│   │   ├── main.py          # FastAPI application
│   │   ├── services/        # ML services
│   │   └── schemas/         # API schemas
│   ├── scripts/
│   │   └── train_model.py   # Model training script
│   ├── models/              # Trained ML models
│   ├── requirements.txt
│   └── Dockerfile
│
├── vehicle-simulator/         # Vehicle Simulator
│   ├── services/
│   │   ├── vehicleSimulator.js
│   │   ├── apiClient.js
│   │   ├── mqttPublisher.js
│   │   └── routingService.js
│   ├── config/
│   ├── index.js
│   └── package.json
│
├── mds/                      # Documentation files
│   ├── SYSTEM_ARCHITECTURE.md
│   ├── FRONTEND_DOCUMENTATION.md
│   └── ...
│
├── docker-compose.yml        # Docker Compose configuration
└── README.md                 # This file
```

## 📚 API Documentation

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "password123",
  "role": "dispatcher"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "username": "johndoe",
    "email": "john@example.com",
    "role": "dispatcher"
  }
}
```

### Vehicle Management

#### Get All Vehicles
```http
GET /api/vehicles
Authorization: Bearer <token>
```

#### Add Vehicle
```http
POST /api/vehicles
Authorization: Bearer <token>
Content-Type: application/json

{
  "vehicle_number": "V001",
  "status": "available"
}
```

### Fault Management

#### Report Fault
```http
POST /api/faults
Authorization: Bearer <token>
Content-Type: application/json

{
  "fault_type": "Power Failure",
  "fault_location": "Gulshan Block 3",
  "category": "High",
  "latitude": 24.8607,
  "longitude": 67.0011,
  "detail": "Complete power outage affecting 50+ houses"
}
```

**Note**: Faults are automatically dispatched after creation.

#### Get All Faults
```http
GET /api/faults
Authorization: Bearer <token>
```

### Dispatch Engine

#### Run Dispatch
```http
POST /api/dispatch/run
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Fault dispatched to V001",
  "result": {
    "fault_id": "...",
    "selected_vehicle": "V001",
    "selection_score": "156.25",
    "engine_used": "Rule",
    "score_breakdown": {
      "performance": "21.25",
      "fatigue": -10,
      "locationExp": 15,
      "faultTypeExp": 15,
      "criticalityMatch": 25
    }
  }
}
```

### GPS Tracking

#### Add GPS Point
```http
POST /api/gps
Authorization: Bearer <token>
Content-Type: application/json

{
  "vehicle": "<vehicle_id>",
  "latitude": 24.8607,
  "longitude": 67.0011,
  "speed": 45
}
```

#### Get Latest GPS
```http
GET /api/gps/latest/:vehicleId
Authorization: Bearer <token>
```

### ML Service Endpoints

#### Health Check
```http
GET /api/health
```

#### Predict Best Vehicle
```http
POST /api/predict
Content-Type: application/json

{
  "candidates": [
    {
      "distance_m": 1250.5,
      "distance_cat": 1,
      "past_perf": 8.2,
      "fault_history": 2,
      "fatigue_h": 4.0,
      "fault_severity": 3
    }
  ]
}
```

For complete API documentation, refer to:
- Backend: `backend/BACKEND_DOCUMENTATION.md`
- ML Service: `ml-service/README.md`

## 🚢 Deployment

### Docker Deployment

The project includes Docker Compose configuration for easy deployment:

```bash
docker-compose up -d --build
```

### Production Checklist

- [ ] Set strong `JWT_SECRET` in all services
- [ ] Enable MongoDB authentication
- [ ] Use secure MQTT connection (TLS)
- [ ] Configure CORS for production domains
- [ ] Set up error monitoring (e.g., Sentry)
- [ ] Enable HTTPS for all services
- [ ] Set up log aggregation
- [ ] Configure rate limiting
- [ ] Set up database backups
- [ ] Review and update security headers
- [ ] Set `PROTOTYPE_MODE=false`
- [ ] Set `NODE_ENV=production`
- [ ] Configure production MongoDB connection string
- [ ] Set up production MQTT broker credentials

### Environment-Specific Configuration

**Development:**
```env
NODE_ENV=development
PROTOTYPE_MODE=true
LOG_LEVEL=debug
```

**Production:**
```env
NODE_ENV=production
PROTOTYPE_MODE=false
LOG_LEVEL=info
DISPATCH_ENGINE=AI  # or "Rule"
```

## 🧪 Testing

### Manual Testing

1. **Fault Reporting**: Use the frontend or API to report a fault
2. **Dispatch**: Run the dispatch engine via API or automatic dispatch
3. **GPS Tracking**: Monitor vehicle movement on the map
4. **Resolution**: Complete the fault resolution workflow

### Prototype Mode

When `PROTOTYPE_MODE=true`:
- Vehicles without devices can be dispatched
- MQTT alerts are mocked (logged instead of sent)
- Auto-resolution timers simulate work completion
- Ideal for testing without physical hardware

### Vehicle Simulator

The vehicle simulator can be used for testing:
- Simulates vehicle movement along routes
- Publishes GPS updates via MQTT
- Responds to dispatch assignments
- Completes work automatically

## 🐛 Troubleshooting

### Common Issues

#### MongoDB Connection Failed
- Verify MongoDB is running
- Check `MONGO_URI` format
- Ensure network access to MongoDB instance

#### MQTT Connection Failed
- Verify broker credentials in `.env`
- Check network connectivity
- Ensure TLS port (8883) is accessible

#### ML Service Unavailable
- Check ML service is running on port 8000
- Verify `ML_SERVICE_URL` in backend `.env`
- System automatically falls back to rule-based engine

#### Authentication Errors
- Check JWT token expiry
- Verify `JWT_SECRET` matches between requests
- Ensure token is included in `Authorization: Bearer <token>` header

#### Frontend Not Connecting to Backend
- Verify `VITE_API_URL` in frontend `.env`
- Check CORS configuration in backend
- Ensure backend is running on correct port

### Debugging

- Enable debug logging: Set `LOG_LEVEL=debug` in `.env`
- Check MQTT connection status in logs
- Monitor WebSocket connections
- Review cache statistics
- Check route calculation metrics

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Follow existing code structure
- Use ES6+ features for JavaScript
- Follow PEP 8 for Python code
- Add comments for complex logic
- Update documentation for API changes

## 📄 License

This project is licensed under the ISC License.

## 👥 Authors

- **Syed Taha Jameel** - *Initial work*
- **Rimsha Masood** - *Initial work*
- **Saman Aslam** - *Initial work*
- **Zoya Ali** - *Initial work*

## 🙏 Acknowledgments

- Express.js community
- MongoDB documentation
- MQTT.js library
- HiveMQ Cloud for MQTT broker services
- OSRM for routing services
- React and TypeScript communities
- FastAPI and scikit-learn communities

## 📞 Support

For support, please:
- Open an issue in the repository
- Contact the development team
- Refer to the documentation in the `mds/` directory

## 📊 System Status

**Version:** 1.0.0  
**Last Updated:** January 2026  
**Status:** ✅ Production Ready

---

**Note**: This is a comprehensive fleet management system designed for production use. Ensure all security measures are properly configured before deploying to production.

