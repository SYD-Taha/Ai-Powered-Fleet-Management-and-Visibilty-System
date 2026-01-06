# 422 Error Diagnosis Guide

## Error Description
```
INFO: 127.0.0.1:60119 - "POST /api/predict HTTP/1.1" 422 Unprocessable Content
```

A **422 Unprocessable Content** error from FastAPI indicates that Pydantic validation failed. This means the request data doesn't match the expected schema requirements.

## Enhanced Logging Added

I've added comprehensive logging to identify the exact source of validation errors:

### 1. In `backend/controllers/dispatchController.js`
- **Location**: Lines ~873-924 (ML candidate extraction)
- **What it logs**:
  - Raw values before calculation (coordinates, performance, fatigue, etc.)
  - Calculated candidate values
  - Validation issues for each candidate
  - Vehicle ID and number for context

### 2. In `backend/services/mlService.js`
- **Location**: Lines ~55-140 (ML service client)
- **What it logs**:
  - Original candidate values received
  - Formatted/parsed values
  - Validation errors for NaN or out-of-range values
  - Full FastAPI error response (including Pydantic validation details)
  - Candidates that were sent (when 422 error occurs)

## Schema Requirements (from `ml-service/app/schemas/dispatch_schemas.py`)

Each candidate must have:

| Field | Type | Constraints |
|-------|------|-------------|
| `distance_m` | float | ≥ 0 (not NaN) |
| `distance_cat` | int | 0, 1, or 2 |
| `past_perf` | float | 1-10 (not NaN) |
| `fault_history` | int | ≥ 0 (not NaN) |
| `fatigue_h` | float | 0-24 (not NaN) |
| `fault_severity` | int | 1, 2, or 3 |

## Common Causes

### 1. **NaN Values**
The most likely cause. NaN can occur when:
- **distance_m**: Invalid coordinates (null, undefined, or non-numeric) → Haversine calculation returns NaN
- **past_perf**: If `performance` is NaN → `(NaN * 9) + 1 = NaN`
- **fatigue_h**: If `fatigueCount` is NaN → `Math.min(NaN, 24) = NaN`

### 2. **Type Mismatches**
- String values instead of numbers (will fail parseFloat/parseInt)
- Undefined/null values not properly handled

### 3. **Out of Range Values**
- `past_perf` < 1 or > 10
- `fatigue_h` > 24
- `distance_cat` not in [0, 1, 2]
- `fault_severity` not in [1, 2, 3]

## How to Diagnose

When the error occurs, check the logs for:

### Step 1: Check `dispatchController.js` logs
Look for:
```
Invalid ML candidate values detected
```
This will show:
- Which vehicle has the problem
- The exact candidate values
- Which specific fields failed validation
- Raw input values used in calculations

### Step 2: Check `mlService.js` logs
Look for:
```
ML service error response
```
This will show:
- The full FastAPI error response (includes Pydantic validation details)
- The candidates that were sent
- Which field(s) failed validation

### Step 3: Check FastAPI logs
The FastAPI service should log validation errors with details like:
```
ValidationError: 1 validation error for PredictRequest
candidates -> 0 -> distance_m
  ensure this value is greater than or equal to 0 (type=value_error.number.not_ge; limit_value=0)
```

## Fixes Applied

1. **Coordinate validation**: Added `Number()` conversion and NaN checks before Haversine calculation
2. **Pre-send validation**: Added validation in `mlService.js` before sending to FastAPI
3. **Enhanced error logging**: Full error details are now logged including the exact field causing issues

## Next Steps

1. **Run the dispatch again** and check the logs
2. **Look for the specific field** that's failing validation
3. **Check the raw values** to understand why the calculation produced invalid values
4. **Add targeted fixes** based on the specific field causing the issue

## Example Log Output

When an error occurs, you should see logs like:

```json
{
  "level": "error",
  "message": "Invalid candidate values detected",
  "vehicleId": "...",
  "vehicleNumber": "V001",
  "candidate": {
    "distance_m": NaN,
    "distance_cat": 0,
    "past_perf": 5.5,
    ...
  },
  "validationIssues": [
    "distance_m: NaN (calculated from lat1:null, lon1:null, ...)"
  ],
  "rawValues": {
    "vehicleLat": null,
    "vehicleLon": null,
    ...
  }
}
```

This will tell you exactly which field is causing the problem and why.

