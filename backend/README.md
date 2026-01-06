# Fleet Management System with AI Dispatch Engine

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.1-blue.svg)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-8.17-green.svg)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

A comprehensive fleet management system with an intelligent AI-powered dispatch engine that automatically assigns vehicles to faults based on performance history, location experience, fault type expertise, and workload balancing.

## 🚀 Features

### Core Functionality
- **Vehicle Management**: Complete CRUD operations for fleet vehicles with status tracking
- **Driver Management**: Driver assignment and vehicle-driver relationships
- **Fault Management**: Fault reporting with priority categorization (High/Medium/Low)
- **Trip Tracking**: Automated trip lifecycle management (create → ongoing → completed)
- **GPS Tracking**: Real-time GPS coordinate tracking and historical route data
- **Hardware Device Management**: ESP32/Arduino device registration and assignment

### AI Dispatch Engine
- **Dual Engine Support**: 
  - **Rule-Based Engine** (default): Multi-factor weighted scoring algorithm
  - **ML Engine**: Machine learning-based prediction with automatic fallback
  
- **Intelligent Vehicle Selection**: Multi-factor scoring algorithm that considers:
  - **Performance History** (25% weight): Historical success ratio
  - **Fatigue Level** (20% weight): Daily workload to prevent overworking
  - **Location Experience** (15% weight): Previous experience at fault location
  - **Fault Type Experience** (15% weight): Expertise with specific fault types
  - **Criticality Matching** (25% weight): Priority-based assignment to high performers
  
- **ML Features** (when ML engine enabled):
  - Distance calculation (routing service with Haversine fallback)
  - Past performance scoring
  - Fault history tracking
  - Fatigue calculation
  - Fault severity mapping
  
- **Automated Workflow**:
  - Automatic vehicle selection for waiting faults
  - Environment variable toggle to switch engines
  - Automatic fallback to rule-based if ML service unavailable
  - MQTT-based dispatch alerts to hardware devices
  - Driver confirmation handling
  - Automatic trip creation and completion
  - Vehicle status updates throughout lifecycle

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (Admin, Dispatcher, Viewer)
- Secure password hashing with bcrypt
- User management and profile updates

### Real-time Communication
- MQTT integration for hardware communication
- Real-time dispatch alerts to ESP32/Arduino devices
- Vehicle confirmation and resolution updates
- Secure MQTT connection (TLS)

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Usage](#usage)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## 🛠️ Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** or **yarn** package manager
- **MongoDB** (v6.0 or higher) - local or cloud instance
- **MQTT Broker** - HiveMQ Cloud (or any MQTT broker)

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend_ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration (see [Configuration](#configuration))

4. **Start MongoDB**
   ```bash
   # If using local MongoDB
   mongod
   
   # Or ensure your MongoDB Atlas connection string is correct
   ```

5. **Initialize database roles**
   ```bash
   node create_role.js
   ```

6. **Start the server**
   ```bash
   npm start
   ```

   The server will start on `http://localhost:5000` (or the port specified in your `.env`)

## ⚙️ Configuration

Create a `.env` file in the root directory with the following variables:

```env
# MongoDB Configuration
MONGO_URI=mongodb://localhost:27017/fleet_management
# Or for MongoDB Atlas:
# MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/fleet_management

# Server Configuration
PORT=5000

# JWT Secret (Generate a strong random string in production!)
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production

# MQTT Configuration (HiveMQ Cloud or your MQTT broker)
MQTT_BROKER=your-broker.hivemq.cloud
MQTT_PORT=8883
MQTT_USERNAME=your_mqtt_username
MQTT_PASSWORD=your_mqtt_password

# External API Configuration (optional, for testing)
BACKEND_FAULT_API=http://localhost:5000/api/faults
TEST_AUTH_TOKEN=your_test_jwt_token_here

# Prototype Mode Configuration (optional, for development/testing)
# When set to 'true', allows vehicles without assigned hardware devices to be dispatched
# MQTT alerts will be mocked (logged but not sent) for vehicles without devices
# Vehicles without devices will automatically resolve faults after 1-4 minutes (random)
# Default: false (devices required for dispatch)
PROTOTYPE_MODE=false
```

### Security Notes

- **Never commit `.env` files** to version control
- Generate a strong random string for `JWT_SECRET` in production
- Use environment-specific credentials for MQTT
- Enable MongoDB authentication in production

## 📁 Project Structure

```
backend_ai/
├── controllers/          # Business logic controllers
│   ├── alertController.js
│   ├── deviceController.js
│   ├── dispatchController.js    # AI dispatch engine
│   ├── driverController.js
│   ├── faultController.js
│   ├── gpsController.js
│   ├── tripController.js
│   ├── userController.js
│   └── vehicleController.js
├── middleware/           # Express middleware
│   └── auth.js          # JWT authentication & role authorization
├── models/              # Mongoose schemas
│   ├── Alert.js
│   ├── Driver.js
│   ├── Fault.js
│   ├── GPS.js
│   ├── HardwareDevice.js
│   ├── Role.js
│   ├── Trip.js
│   ├── User.js
│   └── Vehicle.js
├── routes/              # API route definitions
│   ├── alertRoutes.js
│   ├── authRoutes.js
│   ├── deviceRoutes.js
│   ├── dispatchRoutes.js
│   ├── driverRoutes.js
│   ├── faultRoutes.js
│   ├── gpsRoutes.js
│   ├── tripRoutes.js
│   ├── userRoutes.js
│   └── vehicleRoutes.js
├── mqttService.js       # MQTT client and message handling
├── index.js             # Application entry point
├── package.json
└── README.md
```

## 📚 API Documentation

### Authentication Endpoints

#### `POST /api/auth/register`
Register a new user.

**Request Body:**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "password123",
  "role": "dispatcher"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "_id": "...",
    "username": "johndoe",
    "email": "john@example.com",
    "role": "dispatcher"
  }
}
```

#### `POST /api/auth/login`
Authenticate user and receive JWT token.

**Request Body:**
```json
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

### Vehicle Endpoints

#### `GET /api/vehicles`
Get all vehicles (requires authentication).

**Headers:**
```
Authorization: Bearer <token>
```

#### `POST /api/vehicles`
Add a new vehicle (requires admin/dispatcher role).

**Request Body:**
```json
{
  "vehicle_number": "V001",
  "status": "available"
}
```

#### `POST /api/vehicles/assign-device`
Assign a hardware device to a vehicle (requires admin/dispatcher role).

**Request Body:**
```json
{
  "vehicleId": "<vehicle_id>",
  "deviceId": "<device_id>"
}
```

### Fault Management

#### `GET /api/faults`
Get all faults (requires authentication).

#### `POST /api/faults`
Report a new fault (requires authentication).

**Request Body:**
```json
{
  "fault_type": "Power Failure",
  "fault_location": "Gulshan Block 3",
  "category": "High",
  "detail": "Complete power outage affecting 50+ houses"
}
```

### AI Dispatch Engine

#### `POST /api/dispatch/run`
Run the dispatch engine to assign vehicles to waiting faults (requires authentication).

**Configuration:**
Set `DISPATCH_ENGINE` environment variable to `"Rule"` or `"AI"` (default: `"Rule"`).

**Response (Rule-Based Engine):**
```json
{
  "message": "Fault dispatched to V001",
  "result": {
    "fault_id": "...",
    "fault_type": "Power Failure",
    "fault_location": "Gulshan Block 3",
    "selected_vehicle": "V001",
    "device_id": "DVC001",
    "selection_score": "156.25",
    "engine_used": "Rule",
    "score_breakdown": {
      "base": 100,
      "performance": "21.25",
      "fatigue": -10,
      "locationExp": 15,
      "faultTypeExp": 15,
      "criticalityMatch": 25
    },
    "alert_priority": "High",
    "alternatives": [...]
  }
}
```

**Response (ML Engine):**
```json
{
  "message": "Fault dispatched to V001",
  "result": {
    "fault_id": "...",
    "fault_type": "Power Failure",
    "fault_location": "Gulshan Block 3",
    "selected_vehicle": "V001",
    "device_id": "DVC001",
    "selection_score": "0.85",
    "engine_used": "AI",
    "ml_available": true,
    "comparison_score": "156.25",
    "score_breakdown": {
      "base": "ML",
      "ml_score": "0.85",
      "ml_rank": 1,
      "total_candidates": 5
    },
    "alert_priority": "High",
    "alternatives": [...]
  }
}
```

### GPS Tracking

#### `POST /api/gps`
Add GPS point for a vehicle.

**Request Body:**
```json
{
  "vehicle": "<vehicle_id>",
  "latitude": 24.8607,
  "longitude": 67.0011,
  "speed": 45
}
```

#### `GET /api/gps/latest/:vehicleId`
Get latest GPS coordinates for a vehicle.

#### `GET /api/gps/track/:vehicleId?limit=100`
Get GPS track history for a vehicle.

## 🔄 System Workflow

### Complete Dispatch Flow

1. **Fault Reporting**: External system or API reports a fault
   ```
   POST /api/faults → Fault created with status: "waiting"
   ```

2. **AI Dispatch**: Dispatch engine selects best vehicle
   ```
   POST /api/dispatch/run → AI scoring algorithm evaluates vehicles
   → Best vehicle selected → MQTT alert sent to device
   ```

3. **Hardware Notification**: ESP32/Arduino receives dispatch
   ```
   MQTT Topic: device/{device_id}/dispatch
   Message: { fault_id, fault_details, ... }
   ```

4. **Driver Confirmation**: Driver accepts via hardware button
   ```
   Hardware publishes: vehicle/{vehicle_number}/confirmation
   → Backend receives → Fault status: "assigned"
   → Trip auto-created with status: "ongoing"
   → Vehicle status: "working"
   ```

5. **GPS Tracking**: Device sends GPS coordinates during trip
   ```
   Hardware publishes: vehicle/{vehicle_number}/gps
   → Backend stores GPS points
   ```

6. **Fault Resolution**: Driver marks fault as resolved
   ```
   Hardware publishes: vehicle/{vehicle_number}/resolved
   → Backend receives → Fault status: "resolved"
   → Trip status: "completed"
   → Vehicle status: "available"
   ```

## 🧪 Testing

### Prototype Mode

When `PROTOTYPE_MODE=true` is set in your `.env` file, the dispatch engine operates in prototype mode:

- **Vehicle Eligibility**: All available vehicles are eligible for dispatch, even if they don't have an assigned hardware device
- **MQTT Alerts**: For vehicles without devices, MQTT alerts are mocked (logged to console but not actually sent to the broker)
- **Auto-Confirmation**: Vehicles without devices are automatically confirmed when dispatched (no driver interaction needed)
- **Auto-Resolution**: When a vehicle without a device reaches "working" status, a timer automatically resolves the fault after a random delay between 1-4 minutes. This simulates the time taken to fix a task.
- **Alert Records**: Alert records are still created in the database for audit purposes
- **Use Case**: Ideal for testing the full dispatch flow when you have limited hardware devices or are in the prototyping phase

**Important Notes:**
- Prototype mode should only be used in development/testing environments
- In production, always set `PROTOTYPE_MODE=false` to ensure all vehicles have hardware devices
- When prototype mode is enabled, check console logs for `[MOCK MQTT]` messages indicating mocked alerts
- Auto-resolution timers start when vehicle status changes to "working" and complete the full resolution flow (fault resolved, trip completed, vehicle available, alert solved)

### Manual Testing with Postman

1. Import the Postman collection (if available)
2. Set up environment variables:
   - `base_url`: `http://localhost:5000`
   - `auth_token`: (will be set after login)

3. **Test Flow:**
   ```
   1. Register/Login → Get auth_token
   2. Create roles (if needed)
   3. Register device
   4. Add driver
   5. Add vehicle
   6. Assign device to vehicle
   7. Assign driver to vehicle
   8. Report fault
   9. Run AI dispatch
   10. Verify trip created
   ```

### Testing MQTT Dispatch

1. **Start backend server**
2. **Connect hardware device** to MQTT broker
3. **Subscribe hardware** to `device/{device_id}/dispatch`
4. **Trigger dispatch** via API
5. **Verify message** received on hardware

## 🚢 Deployment

### Production Checklist

- [ ] Set strong `JWT_SECRET` in environment variables
- [ ] Enable MongoDB authentication
- [ ] Use secure MQTT connection (TLS/mTLS)
- [ ] Configure CORS for production domains
- [ ] Set up error monitoring (e.g., Sentry)
- [ ] Enable HTTPS for API
- [ ] Set up log aggregation
- [ ] Configure rate limiting
- [ ] Set up database backups
- [ ] Review and update security headers

### Environment-Specific Configuration

**Development:**
```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://localhost:27017/fleet_management
```

**Production:**
```env
NODE_ENV=production
PORT=5000
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/fleet_management
MQTT_BROKER=production-broker.hivemq.cloud

# Dispatch Engine Configuration
DISPATCH_ENGINE=Rule  # or "AI" for ML engine
ML_SERVICE_URL=http://ml-service:8000
ML_SERVICE_TIMEOUT=5000
ML_SERVICE_ENABLED=true
ENABLE_COMPARISON_LOGGING=false
```

## 🤖 Dispatch Engine Configuration

### Engine Selection

The system supports two dispatch engines that can be toggled via environment variable:

- **Rule-Based Engine** (default): Multi-factor weighted scoring algorithm
- **ML Engine**: Machine learning-based prediction with automatic fallback

Set `DISPATCH_ENGINE=Rule` or `DISPATCH_ENGINE=AI` in your environment variables.

### Environment Variables

```env
# Dispatch Engine (default: "Rule")
DISPATCH_ENGINE=Rule

# ML Service Configuration (only needed if using AI engine)
ML_SERVICE_URL=http://localhost:8000
ML_SERVICE_TIMEOUT=5000
ML_SERVICE_ENABLED=true

# Comparison Logging (optional, disabled by default)
ENABLE_COMPARISON_LOGGING=false
```

### Automatic Fallback

If ML engine is selected but the ML service is unavailable, the system automatically falls back to the rule-based engine and logs a warning. This ensures dispatch never fails completely.

## 🤖 AI Dispatch Algorithm Details

### Rule-Based Engine

The rule-based dispatch engine uses a weighted scoring system:

### Scoring Formula

```
Base Score = 100

Final Score = Base
  + (Performance Ratio × 25)           # Up to +25
  - (Fatigue Level × 5, max -30)       # Up to -30
  + (Location Experience ? 15 : 0)     # +15 if experienced
  + (Fault Type Experience ? 15 : 0)   # +15 if experienced
  + Criticality Match Bonus            # +10 to +25
```

### Example Calculation

**Vehicle V001 with:**
- Performance: 85% (0.85)
- Fatigue: 2 faults today
- Location experience: Yes
- Fault type experience: Yes
- Fault category: High

**Score:**
```
100 + (0.85 × 25) - (2 × 5) + 15 + 15 + 25
= 100 + 21.25 - 10 + 15 + 15 + 25
= 166.25
```

## 🔐 Security

- **Authentication**: JWT tokens with 7-day expiry
- **Authorization**: Role-based access control (RBAC)
- **Password Security**: bcrypt hashing (10 rounds)
- **MQTT Security**: TLS encryption for broker connection
- **Input Validation**: Express JSON parser with size limits
- **CORS**: Configurable for production domains

## 📝 API Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (no/invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 409 | Conflict (duplicate entry) |
| 500 | Server Error |

## 🐛 Troubleshooting

### Common Issues

**MQTT Connection Failed**
- Verify broker credentials in `.env`
- Check network connectivity
- Ensure TLS port (8883) is accessible

**Device Not Receiving Dispatch**
- Verify device is subscribed to correct topic: `device/{device_id}/dispatch`
- Check device `device_id` matches database
- Verify MQTT client connection status in logs

**Authentication Errors**
- Check JWT token expiry
- Verify `JWT_SECRET` matches between requests
- Ensure token is included in `Authorization: Bearer <token>` header

**Database Connection Issues**
- Verify MongoDB is running
- Check `MONGO_URI` format
- Ensure network access to MongoDB instance

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Use ES6+ features
- Follow existing code structure
- Add comments for complex logic
- Update documentation for API changes

## 📄 License

This project is licensed under the ISC License.

## 👥 Authors

- **Your Name** - *Initial work*

## 🙏 Acknowledgments

- Express.js community
- MongoDB documentation
- MQTT.js library
- HiveMQ Cloud for MQTT broker services

## 📞 Support

For support, please open an issue in the repository or contact the development team.

---

**Version:** 1.0.0  
**Last Updated:** 2025-01-XX  
**Status:** ✅ Production Ready

