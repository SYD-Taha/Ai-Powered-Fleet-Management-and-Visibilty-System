# Fix Auto-Resolution Timer Timing - Implementation Plan

## Problem Analysis

**Current Issue:**
- Auto-resolution timer starts too early (during confirmation/acknowledgment)
- Timer starts when vehicle is still "onRoute" or just confirmed
- Vehicle hasn't reached fault location yet
- Timer completes before vehicle arrives, causing premature fault resolution
- Vehicle status changes to "available" and fault resolves mid-journey

**Root Cause:**
- Timer is started in `dispatchController.js` during auto-confirmation (line 863)
- Timer is started in `mqttService.js` during MQTT confirmation (line 167)
- Both happen before vehicle arrives at fault location
- GPS arrival detection exists but doesn't start the timer

**Expected Behavior:**
- Timer should only start when vehicle actually arrives at fault location
- Timer should start when vehicle status becomes "working" AND vehicle is at fault
- Timer should be cancelled if vehicle status changes away from "working"

---

## Solution Overview

Move timer start from confirmation/acknowledgment to actual arrival detection:
1. Remove timer start from auto-confirmation (dispatchController.js)
2. Remove timer start from MQTT confirmation (mqttService.js)
3. Add timer start in GPS arrival detection (gpsController.js)
4. Add timer start when vehicle status changes to "working" (vehicleController.js or middleware)
5. Add timer cancellation when vehicle status changes away from "working"
6. Ensure timer only starts once (prevent duplicates)

---

## Implementation Plan

### Step 1: Remove Timer Start from Auto-Confirmation
**Priority**: Critical  
**File**: `backend/controllers/dispatchController.js`  
**Lines**: 860-864

**Current Code:**
```javascript
// Start auto-resolution timer in prototype mode for vehicles without devices
// Timer will trigger after vehicle arrives and works for 2-5 minutes
if (prototypeMode && !selectedVehicle.assigned_device) {
  await startAutoResolutionTimer(selectedVehicle._id.toString(), fault._id.toString(), selectedVehicle, fault);
}
```

**Action**: Remove this block entirely. Timer will start when vehicle arrives.

**Changes**:
1. Remove lines 860-864 (timer start in auto-confirmation)
2. Update comment if needed

**Dependencies**: None  
**Testing**: Verify timer doesn't start during auto-confirmation

---

### Step 2: Remove Timer Start from MQTT Confirmation
**Priority**: Critical  
**File**: `backend/mqttService.js`  
**Lines**: 164-168

**Current Code:**
```javascript
// Start auto-resolution timer in prototype mode for vehicles without devices
const prototypeMode = process.env.PROTOTYPE_MODE === 'true';
if (prototypeMode && !vehicle.assigned_device) {
  await startAutoResolutionTimer(vehicle._id.toString(), fault._id.toString(), vehicle, fault);
}
```

**Action**: Remove this block. Timer will start when vehicle arrives.

**Note**: The MQTT confirmation handler also sets vehicle status to "working" immediately (line 156), which is incorrect. This should be fixed separately, but for now we're just removing the timer start.

**Changes**:
1. Remove lines 164-168 (timer start in MQTT confirmation)
2. Keep the rest of the confirmation logic intact

**Dependencies**: None  
**Testing**: Verify timer doesn't start during MQTT confirmation

---

### Step 3: Add Timer Start in GPS Arrival Detection
**Priority**: Critical  
**File**: `backend/controllers/gpsController.js`  
**Lines**: 96-124 (in `checkVehicleArrival` function)

**Current Code:**
```javascript
if (distanceMeters <= 50) {
  vehicle.status = 'working';
  await vehicle.save();
  // ... WebSocket events ...
  logger.info('Vehicle arrived at fault location', {...});
}
```

**Action**: Add timer start after vehicle status is set to "working" and saved.

**Implementation:**
```javascript
if (distanceMeters <= 50) {
  vehicle.status = 'working';
  await vehicle.save();
  
  // Invalidate cache
  cache.delPattern('vehicles:*');
  
  // Emit WebSocket events
  const io = getIO();
  if (io) {
    io.emit('vehicle:arrived', {
      vehicleId: vehicleId.toString(),
      faultId: fault._id.toString(),
      status: 'working'
    });
    
    io.emit('vehicle:status-change', {
      vehicleId: vehicleId.toString(),
      status: 'working',
      updatedFields: { status: 'working' }
    });
  }
  
  logger.info('Vehicle arrived at fault location', {
    vehicleId: vehicleId.toString(),
    faultId: fault._id.toString(),
    distance: distanceMeters.toFixed(2)
  });
  
  // Start auto-resolution timer only for vehicles without devices in prototype mode
  const prototypeMode = process.env.PROTOTYPE_MODE === 'true';
  if (prototypeMode && !vehicle.assigned_device) {
    await startAutoResolutionTimer(
      vehicleId.toString(),
      fault._id.toString(),
      vehicle,
      fault
    );
    logger.info('Started auto-resolution timer after vehicle arrival', {
      vehicleId: vehicleId.toString(),
      faultId: fault._id.toString()
    });
  }
}
```

**Changes**:
1. Import `startAutoResolutionTimer` from prototypeTimerService
2. Add timer start logic after vehicle status is set to "working"
3. Only start timer for vehicles without devices in prototype mode
4. Add logging for timer start

**Dependencies**: Steps 1, 2 (removing timer from other locations)  
**Testing**: Verify timer starts when vehicle arrives at fault location

---

### Step 4: Add Timer Start for Simulator Arrival
**Priority**: High  
**File**: `backend/controllers/vehicleController.js` or create middleware  
**Lines**: 69-97 (in `updateVehicle` function)

**Problem**: Vehicle simulator updates status to "working" via API, but timer doesn't start.

**Solution Options**:
- Option A: Add timer start in `vehicleController.js` when status changes to "working"
- Option B: Create middleware that detects status change to "working" and starts timer
- Option C: Simulator should call a specific endpoint that handles arrival

**Recommended**: Option A - Add logic in `updateVehicle` to detect status change to "working" and check if vehicle is at fault location.

**Implementation:**
```javascript
export const updateVehicle = async (req, res) => {
  try {
    const oldVehicle = await Vehicle.findById(req.params.id);
    const v = await Vehicle.findByIdAndUpdate(req.params.id, req.body, { new: true });
    
    // Invalidate vehicle cache
    cache.delPattern('vehicles:*');
    
    // Check if status changed to "working" (vehicle arrived)
    const statusChangedToWorking = req.body.status === 'working' && 
                                   oldVehicle?.status !== 'working';
    
    if (statusChangedToWorking) {
      // Find assigned fault for this vehicle
      const fault = await Fault.findOne({
        assigned_vehicle: v._id,
        status: { $in: ['assigned', 'pending_confirmation'] }
      });
      
      if (fault) {
        // Check if vehicle is at fault location (GPS proximity)
        const latestGPS = await GPS.findOne({ vehicle: v._id })
          .sort({ timestamp: -1 })
          .select('latitude longitude')
          .lean();
        
        if (latestGPS && fault.latitude && fault.longitude) {
          const distanceKm = calculateDistance(
            latestGPS.latitude, latestGPS.longitude,
            fault.latitude, fault.longitude
          );
          const distanceMeters = distanceKm * 1000;
          
          // If within 50 meters, start timer
          if (distanceMeters <= 50) {
            const prototypeMode = process.env.PROTOTYPE_MODE === 'true';
            if (prototypeMode && !v.assigned_device) {
              await startAutoResolutionTimer(
                v._id.toString(),
                fault._id.toString(),
                v,
                fault
              );
              logger.info('Started auto-resolution timer after status change to working', {
                vehicleId: v._id.toString(),
                faultId: fault._id.toString()
              });
            }
          }
        }
      }
    }
    
    // Emit WebSocket events for vehicle updates
    const io = getIO();
    // ... rest of existing code ...
  } catch (e) { res.status(400).json({ error: e.message }); }
};
```

**Changes**:
1. Import `startAutoResolutionTimer` and `calculateDistance`
2. Import `Fault` and `GPS` models
3. Add logic to detect status change to "working"
4. Check GPS proximity to fault location
5. Start timer if vehicle is at fault location

**Dependencies**: Step 3  
**Testing**: Verify timer starts when simulator updates status to "working" and vehicle is at fault

---

### Step 5: Add Timer Cancellation Logic
**Priority**: Medium  
**File**: `backend/services/prototypeTimerService.js`  
**Function**: `cancelTimer` (already exists, but needs enhancement)

**Problem**: Timer should be cancelled if vehicle status changes away from "working" before timer completes.

**Current Code:**
```javascript
export const cancelTimer = (vehicleId) => {
  const timeoutId = activeTimers.get(vehicleId);
  if (timeoutId) {
    clearTimeout(timeoutId);
    activeTimers.delete(vehicleId);
    logger.info("Auto-resolution timer cancelled", { vehicleId });
  }
};
```

**Enhancement**: Add a function to cancel timer when vehicle status changes away from "working".

**Implementation:**
```javascript
/**
 * Cancel auto-resolution timer if vehicle status changes away from working
 * Called when vehicle status is updated
 * @param {String} vehicleId - Vehicle ObjectId as string
 * @param {String} newStatus - New vehicle status
 */
export const cancelTimerIfNotWorking = async (vehicleId, newStatus) => {
  try {
    // Only cancel if status is changing away from "working"
    if (newStatus !== 'working') {
      const timeoutId = activeTimers.get(vehicleId);
      if (timeoutId) {
        clearTimeout(timeoutId);
        activeTimers.delete(vehicleId);
        logger.info("Auto-resolution timer cancelled - vehicle status changed", {
          vehicleId,
          newStatus
        });
      }
    }
  } catch (error) {
    logger.error("Error cancelling timer on status change", {
      vehicleId,
      newStatus,
      error: error.message
    });
  }
};
```

**Changes**:
1. Add `cancelTimerIfNotWorking` function
2. Export the function
3. Call it in `vehicleController.js` when status changes

**Dependencies**: Step 4  
**Testing**: Verify timer is cancelled when vehicle status changes away from "working"

---

### Step 6: Prevent Duplicate Timers
**Priority**: Low  
**File**: `backend/services/prototypeTimerService.js`  
**Function**: `startAutoResolutionTimer`

**Problem**: Timer might be started multiple times if arrival is detected multiple times.

**Solution**: The existing `cancelTimer` call at line 35 already handles this, but we should verify it works correctly.

**Current Code:**
```javascript
// Cancel any existing timer for this vehicle
cancelTimer(vehicleId);
```

**Verification**: Ensure this is called before starting new timer. It should be fine, but add logging to confirm.

**Changes**:
1. Add logging to confirm existing timer is cancelled
2. Verify no duplicate timers are created

**Dependencies**: All previous steps  
**Testing**: Verify only one timer exists per vehicle

---

## Implementation Order

1. **Step 1**: Remove timer from auto-confirmation
2. **Step 2**: Remove timer from MQTT confirmation
3. **Step 3**: Add timer start in GPS arrival detection
4. **Step 4**: Add timer start for simulator arrival (status change handler)
5. **Step 5**: Add timer cancellation logic
6. **Step 6**: Verify duplicate prevention

---

## Files to Modify

1. `backend/controllers/dispatchController.js` - Remove timer start from auto-confirmation
2. `backend/mqttService.js` - Remove timer start from MQTT confirmation
3. `backend/controllers/gpsController.js` - Add timer start in arrival detection
4. `backend/controllers/vehicleController.js` - Add timer start for status change to "working"
5. `backend/services/prototypeTimerService.js` - Add cancellation function

---

## Testing Checklist

- [ ] Timer does NOT start during auto-confirmation
- [ ] Timer does NOT start during MQTT confirmation
- [ ] Timer starts when vehicle arrives at fault location (GPS detection)
- [ ] Timer starts when simulator updates status to "working" and vehicle is at fault
- [ ] Timer is cancelled if vehicle status changes away from "working"
- [ ] Only one timer exists per vehicle (no duplicates)
- [ ] Timer completes after 2-5 minutes and resolves fault
- [ ] Vehicle must be at fault location before timer starts
- [ ] Fault resolves only after vehicle has worked for 2-5 minutes

---

## Success Criteria

✅ Timer starts only when vehicle arrives at fault location  
✅ Timer starts for both GPS detection and simulator status updates  
✅ Timer is cancelled if vehicle leaves before completion  
✅ No premature fault resolution  
✅ Vehicle must complete journey before fault is resolved  
✅ All status transitions are correct and visible on dashboard

---

## Notes

- This fix ensures the timer only starts when vehicle is actually at the fault location
- Handles both GPS-based arrival detection and simulator-based status updates
- Prevents premature fault resolution
- Maintains backward compatibility
- All changes are incremental and testable

