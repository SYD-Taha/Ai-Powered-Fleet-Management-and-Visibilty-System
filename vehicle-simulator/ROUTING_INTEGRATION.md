# Vehicle Simulator Routing Integration

## Overview

The vehicle simulator uses its own routing service that is aligned with the backend routing service to ensure consistency across the system.

## Routing Service Alignment

The simulator's routing service (`vehicle-simulator/services/routingService.js`) has been aligned with the backend routing service (`backend/services/routingService.js`) to ensure:

1. **Consistent Coordinate Format**: Both use `[lat, lng]` arrays for waypoints
2. **Consistent Distance Units**: Both return distance in meters
3. **Consistent Cache Key Format**: Both use the same cache key format (no `toFixed()`)
4. **Consistent Metadata**: Both include `isFallback`, `calculatedAt`, and `source` fields

## GPS Data Flow

### Simulator → Backend

1. **GPS Updates**: The simulator sends GPS updates to the backend via `POST /api/gps`
2. **Route Calculation**: The simulator can calculate routes independently, but the backend also calculates routes at dispatch time
3. **Route Synchronization**: When the backend calculates a route at dispatch, it's sent to the frontend via WebSocket. The simulator should use the backend-calculated route if available.

## Route Calculation Strategy

### When Simulator Should Calculate Routes

- **Manual Route Calculation**: When user manually requests a route in the simulator
- **Fallback**: If backend route is unavailable

### When to Use Backend Routes

- **Primary Source**: Always prefer backend-calculated routes from dispatch events
- **Route Updates**: Use backend route updates when vehicle GPS changes significantly (>100m from route start)

## Route Recalculation

The backend automatically recalculates routes when:
- Vehicle GPS updates
- Vehicle has moved > 100m from route start point
- Vehicle has an active route

The simulator should listen for `route:updated` WebSocket events and update its route accordingly.

## Coordinate Systems

- **Real GPS**: Uses lat/lng coordinates (24.8607, 67.0011 for Karachi center)
- **Simulated Coordinates**: Uses x/y coordinates (0-100 range) for demo purposes
- **Conversion**: Use `xyToLatLng()` and `latLngToXY()` utilities for conversion

## Cache Strategy

- **Simulator Cache**: 5 minutes TTL (matching backend)
- **Cache Key Format**: `${lat},${lng}_${lat},${lng}` (no rounding)
- **Cache Invalidation**: Clear cache when route is recalculated

## Error Handling

- **OSRM Failure**: Falls back to Haversine straight-line distance
- **Network Errors**: Retry with exponential backoff
- **Invalid Coordinates**: Validate before route calculation

## Best Practices

1. **Always validate coordinates** before route calculation
2. **Use backend routes** when available (from dispatch events)
3. **Listen for route updates** via WebSocket
4. **Cache routes** to reduce API calls
5. **Handle fallback routes** gracefully (mark with `isFallback: true`)


