# AI Dispatch System - Implementation Complete ✅

## Overview

The AI Dispatch Engine has been successfully implemented with intelligent vehicle selection and complete trip lifecycle automation. The system now supports **two dispatch engines**:
1. **Rule-Based Engine**: Multi-factor weighted scoring algorithm (default, backward compatible)
2. **ML Engine**: Machine learning-based prediction using trained models

The system automatically:
- Selects the best vehicle based on multiple weighted factors (rule-based) or ML predictions
- Supports environment variable toggle to switch between engines
- Automatically falls back to rule-based if ML service is unavailable
- Creates trips when drivers confirm
- Ends trips when faults are resolved
- Updates vehicle statuses throughout the lifecycle
- Prioritizes alerts based on fault criticality

---

## 🤖 AI Algorithm Features

### 1. **Multi-Factor Vehicle Scoring**

The AI evaluates vehicles based on 5 key factors:

#### **Performance Score (25% weight)**
- Calculates historical success ratio: `resolved_faults / total_assigned_faults`
- Range: 0-1 (0 = poor, 1 = excellent)
- New vehicles get neutral score of 0.5
- Bonus: Up to +25 points

#### **Fatigue Level (20% weight)**
- Counts faults handled today
- Penalty: -5 points per fault (max -30 points)
- Prevents overworking teams

#### **Location Experience (15% weight)**
- Checks if vehicle has resolved faults at exact location before
- Bonus: +15 points if experienced
- Helps assign local experts

#### **Fault Type Experience (15% weight)**
- Checks if vehicle has handled this fault_type before
- Bonus: +15 points if experienced
- Matches specialized teams to familiar problems

#### **Criticality Matching (25% weight)**
- **High priority faults** (category="High"):
  - Only vehicles with >70% performance get +25 bonus
  - Ensures best teams handle critical issues
- **Medium priority** (category="Medium"):
  - Vehicles with >50% performance get +15 bonus
- **Low priority** (category="Low"):
  - Any vehicle gets +10 bonus
  - Less critical work can be done by any team

### 2. **Scoring Formula**

```javascript
Base Score = 100

Final Score = Base 
            + (Performance Ratio × 25)
            - (Fatigue Count × 5, max -30)
            + (Location Experience ? 15 : 0)
            + (Fault Type Experience ? 15 : 0)
            + (Criticality Match Bonus)

// Select vehicle with highest score
```

### 3. **Example Scenarios**

#### **Scenario A: High Priority Power Failure**
```
Fault: Power Failure at Gulshan Block 3 [High Priority]

Vehicle V001:
- Performance: 85% → +21.25 points
- Fatigue: 2 faults today → -10 points
- Location exp: Yes → +15 points
- Fault type exp: Yes → +15 points
- High priority + high performer → +25 points
Total: 156.25 points ✅ SELECTED

Vehicle V002:
- Performance: 60% → +15 points
- Fatigue: 0 faults → 0 points
- Location exp: No → 0 points
- Fault type exp: No → 0 points
- High priority but medium performer → 0 points
Total: 115 points
```

#### **Scenario B: Low Priority Issue**
```
Fault: Sensor Malfunction at DHA [Low Priority]

Vehicle V002:
- Performance: 40% → +10 points
- Fatigue: 1 fault → -5 points
- Location exp: Yes → +15 points
- Fault type exp: Yes → +15 points
- Low priority → +10 points (any vehicle eligible)
Total: 145 points ✅ SELECTED

Vehicle V001:
- Performance: 85% → +21.25 points
- Fatigue: 4 faults → -20 points
- Location exp: No → 0 points
- Fault type exp: No → 0 points
- Low priority → +10 points
Total: 111.25 points (too tired for this job)
```

---

## 🔄 Complete Automated Flow

### **Phase 1: Fault Arrives**
```
externalFaultSender.js sends fault
   ↓
POST /api/faults
   ↓
Fault created with status="waiting"
```

### **Phase 2: AI Dispatch**
```
POST /api/dispatch/run (manual trigger or scheduled)
   ↓
AI Engine evaluates ALL available vehicles
   ↓
Scores each vehicle (0-200+ points)
   ↓
Selects best match
   ↓
Updates:
  - Fault status → "pending_confirmation"
  - Vehicle status → "onRoute"
  - Fault.assigned_vehicle → selected vehicle
   ↓
Creates Alert with priority matching fault category
   ↓
Sends MQTT to device with priority tag
```

### **Phase 3: Driver Confirms (Automatic)**
```
Hardware device receives MQTT alert
   ↓
Driver presses "Accept" button
   ↓
Device publishes to: vehicle/{vehicle_number}/confirmation
   ↓
mqttService.js receives confirmation
   ↓
Auto-updates:
  - Fault status → "assigned"
  - Vehicle status → "working"
  - Creates Trip:
      * vehicle: assigned vehicle
      * driver: vehicle's assigned driver
      * start_time: now
      * start_location: "Depot"
      * status: "ongoing"
```

### **Phase 4: Driver Resolves (Automatic)**
```
Driver fixes fault
   ↓
Driver presses "Resolved" button
   ↓
Device publishes to: vehicle/{vehicle_number}/resolved
   ↓
mqttService.js receives resolution
   ↓
Auto-updates:
  - Fault status → "resolved"
  - Trip status → "completed"
  - Trip end_time → now
  - Trip end_location → fault location
  - Vehicle status → "available"
  - Alert solved → true
```

---

## 📁 Files Modified

### 1. **models/Alert.js**
- Added `priority` field (High/Medium/Low)
- Matches fault category for proper alert handling

### 2. **controllers/alertController.js**
- Creates Alert record in database
- Includes priority in MQTT message
- Returns alert object for tracking

### 3. **controllers/dispatchController.js** (Complete Rewrite)
- 250+ lines of AI logic
- Multiple helper functions for scoring
- Detailed logging of scoring process
- Returns comprehensive dispatch results with:
  - Selected vehicle and score
  - Score breakdown by factor
  - Alternative vehicles (2nd and 3rd best)
  - Driver information
  - Alert priority

### 4. **mqttService.js**
- Auto-creates trips on confirmation
- Auto-ends trips on resolution
- Updates vehicle statuses throughout lifecycle
- Updates alert solved status
- Comprehensive error handling

---

## 🎯 API Response Example

```json
POST /api/dispatch/run

Response:
{
  "message": "Fault dispatched to V002",
  "result": {
    "fault_id": "67890abc...",
    "fault_type": "Power Failure",
    "fault_location": "Gulshan Block 3",
    "fault_category": "High",
    "selected_vehicle": "V002",
    "device_id": "ESP32_002",
    "driver": "Ahmed Khan",
    "selection_score": "156.25",
    "score_breakdown": {
      "base": 100,
      "performance": "21.25",
      "fatigue": -10,
      "locationExp": 15,
      "faultTypeExp": 15,
      "criticalityMatch": 25
    },
    "alert_priority": "High",
    "status": "pending_confirmation",
    "alternatives": [
      { "vehicle": "V001", "score": "142.50" },
      { "vehicle": "V003", "score": "128.00" }
    ]
  }
}
```

---

## 🧪 Testing the System

### **Step 1: Setup Test Data**
```javascript
// Create multiple vehicles with devices
// Assign drivers to vehicles
// Generate some historical faults for performance tracking
```

### **Step 2: Send Test Fault**
```bash
node externalFaultSender.js
# Sends fault every 20 seconds
```

### **Step 3: Trigger Dispatch**
```bash
curl -X POST http://localhost:5000/api/dispatch/run \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### **Step 4: Check Console Logs**
```
🚀 Running AI Dispatch Engine...
📋 Processing fault: Power Failure at Gulshan Block 3 [High priority]
🔍 Found 3 eligible vehicle(s)

📊 Vehicle Scoring Results:
  1. V002: Score 156.25
     Breakdown: { base: 100, performance: '21.25', fatigue: -10, ... }
  2. V001: Score 142.50
     Breakdown: { ... }
  3. V003: Score 128.00
     Breakdown: { ... }

✨ Selected Vehicle: V002 (Score: 156.25)
📡 Sending High priority MQTT alert to device/ESP32_002/dispatch
✅ High priority dispatch alert sent for fault 67890abc...
🎯 Dispatch complete! Alert sent to V002
```

### **Step 5: Simulate Device Confirmation**
```javascript
// Your hardware device should publish:
mqtt.publish("vehicle/V002/confirmation", JSON.stringify({
  fault_id: "67890abc...",
  confirmed: true
}));
```

### **Step 6: Check Auto-Trip Creation**
```
📥 Confirmation from V002: { fault_id: '...', confirmed: true }
✅ Fault 67890abc... assigned to vehicle V002
🚗 Trip 12345xyz... auto-created for V002
📍 Vehicle V002 status updated to working
```

### **Step 7: Simulate Fault Resolution**
```javascript
// Hardware device publishes:
mqtt.publish("vehicle/V002/resolved", JSON.stringify({
  fault_id: "67890abc...",
  resolved: true
}));
```

### **Step 8: Check Auto-Trip End**
```
📥 Resolution from V002: { fault_id: '...', resolved: true }
✅ Fault 67890abc... marked as resolved
🏁 Trip 12345xyz... auto-completed for V002
✅ Vehicle V002 status updated to available
🔔 Alert marked as solved for fault 67890abc...
```

---

## ⚙️ Configuration & Weights

Current scoring weights are defined in `dispatchController.js`:

```javascript
const WEIGHTS = {
  performance: 0.25,    // 25%
  fatigue: 0.20,        // 20%
  locationExp: 0.15,    // 15%
  faultTypeExp: 0.15,   // 15%
  criticality: 0.25     // 25%
};
```

You can adjust these by modifying the scoring logic in `scoreVehicle()` function.

---

## 🔮 Future Enhancements (Phase 2)

Ready to implement when needed:

### **1. GPS-Based Distance Calculation**
- Add vehicle GPS coordinates
- Calculate Haversine distance to fault
- Weight: 20% (adjust other weights proportionally)

### **2. Traffic Integration**
- Google Maps Distance Matrix API
- Real-time route duration
- Weight: 10%

### **3. Multi-Fault Dispatch**
- Handle multiple waiting faults simultaneously
- Optimize vehicle assignments globally

### **4. Rejection Handling**
- If driver rejects, auto-assign to 2nd best vehicle
- Track rejection reasons for learning

### **5. Shift Management**
- Define work shifts
- Calculate fatigue per shift instead of per day

### **6. Machine Learning**
- Train ML model on historical data
- Predict resolution times
- Optimize weights automatically

---

## 📊 Performance Metrics

The system now tracks:

✅ **Vehicle Performance**
- Success ratio (resolved/assigned)
- Based on historical fault data

✅ **Workload Balancing**
- Fatigue tracking (faults today)
- Prevents team burnout

✅ **Expertise Matching**
- Location experience
- Fault type experience

✅ **Priority Handling**
- High priority → high performers
- Critical issue routing

✅ **Complete Automation**
- Trip lifecycle (create → complete)
- Vehicle status transitions
- Alert management

---

## 🎉 Summary

### **Before (Hardcoded V001)**
- Only worked with vehicle V001
- No intelligence in selection
- Manual trip management
- No priority handling
- Incomplete automation

### **After (AI Dispatch)**
- Works with ALL vehicles
- Intelligent multi-factor scoring
- Automatic trip lifecycle
- Priority-based alert routing
- 100% automated flow
- Detailed analytics and logging
- Alternative vehicle suggestions

### **System Status**
- ✅ Phase 1 Complete (No GPS/Traffic)
- ✅ ML Dispatch Engine Integrated (with toggle and fallback)
- ⏳ Phase 2 Ready (GPS + Traffic integration)
- 🎯 Production Ready (with current features)

---

## 🔄 ML Dispatch Engine Integration

### **Engine Toggle Configuration**

The system supports switching between rule-based and ML dispatch engines via environment variable:

```env
# Dispatch Engine Selection
DISPATCH_ENGINE=Rule  # Options: "Rule" or "AI" (default: "Rule" for backward compatibility)

# ML Service Configuration
ML_SERVICE_URL=http://localhost:8000
ML_SERVICE_TIMEOUT=5000
ML_SERVICE_ENABLED=true

# Comparison Logging (optional)
ENABLE_COMPARISON_LOGGING=false  # Calculates rule-based score for ML selections when enabled
```

### **How It Works**

1. **Engine Selection**: System checks `DISPATCH_ENGINE` environment variable
   - `"Rule"`: Uses rule-based multi-factor scoring (default)
   - `"AI"`: Uses ML service for predictions

2. **ML Feature Extraction**: When ML engine is selected:
   - Extracts features: `distance_m`, `distance_cat`, `past_perf`, `fault_history`, `fatigue_h`, `fault_severity`
   - Batch-fetches GPS data for all vehicles
   - Uses routing service with Haversine fallback for distance calculation
   - Handles missing GPS data with default location (Karachi center)

3. **Automatic Fallback**: If ML service is unavailable:
   - Logs warning
   - Automatically falls back to rule-based engine
   - Dispatch never fails completely

4. **Comparison Logging** (optional):
   - When enabled, calculates rule-based score for ML-selected vehicle
   - Logs both scores for performance comparison
   - Disabled by default to avoid performance overhead

### **Response Format**

Both engines return compatible response format with additional fields:

```json
{
  "fault_id": "...",
  "selected_vehicle": "V001",
  "selection_score": "156.25",
  "engine_used": "AI",  // or "Rule"
  "ml_available": true,  // Only present if engine_used === "AI"
  "comparison_score": "142.50",  // Only present if comparison logging enabled
  "score_breakdown": { ... },
  "alternatives": [ ... ]
}
```

### **ML Feature Details**

The ML engine uses the following features:
- **distance_m**: Distance in meters (from routing service or Haversine)
- **distance_cat**: Categorical distance (0: <1000m, 1: <5000m, 2: >=5000m)
- **past_perf**: Past performance (0-10 scale, derived from 0-1 ratio)
- **fault_history**: Count of resolved faults with same fault_type
- **fatigue_h**: Fatigue in hours (fault count × 2, max 24)
- **fault_severity**: Severity level (1: Low, 2: Medium, 3: High)

### **Error Handling**

- **ML Service Unavailable**: Falls back to rule-based, sets `ml_available: false`
- **ML Service Timeout**: Falls back to rule-based, sets `ml_available: false`
- **Feature Extraction Error**: Falls back to rule-based, sets `ml_available: false`
- **Missing GPS Data**: Uses default location (Karachi: 24.8607, 67.0011), logs warning

---

**Implementation Date:** 2025-11-03  
**Last Updated:** 2025-01-XX (ML Integration)  
**Status:** ✅ Complete and Tested  
**Breaking Changes:** None (backward compatible)

