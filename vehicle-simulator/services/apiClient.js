import axios from 'axios';
import config from '../config/config.js';

class APIClient {
  constructor() {
    this.axios = axios.create({
      baseURL: config.BACKEND_URL,
      timeout: 10000,
      headers: config.AUTH_TOKEN ? {
        'Authorization': `Bearer ${config.AUTH_TOKEN}`
      } : {}
    });
    this.isAuthenticated = false;
    this.loginPromise = null; // Prevent concurrent login attempts
  }

  // Auto-login to get token (for development/testing)
  async login(email, password) {
    // Prevent concurrent login attempts
    if (this.loginPromise) {
      return await this.loginPromise;
    }

    this.loginPromise = (async () => {
      try {
        // Create a temporary axios instance without auth for login
        const loginAxios = axios.create({
          baseURL: config.BACKEND_URL,
          timeout: 10000
        });

        const response = await loginAxios.post('/api/auth/login', { email, password });
        
        if (response.data && response.data.token) {
          const token = response.data.token;
          
          // Update config
          config.AUTH_TOKEN = token;
          
          // Update the axios instance with new token
          this.axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          this.isAuthenticated = true;
          console.log('✅ Successfully authenticated with backend');
          return true;
        } else {
          console.error('❌ Login response missing token');
          return false;
        }
      } catch (error) {
        const statusCode = error.response?.status;
        const errorMessage = error.response?.data?.error || error.message;
        
        if (statusCode === 401 || statusCode === 400) {
          console.error(`❌ Failed to login: Invalid credentials - ${errorMessage}`);
        } else {
          console.error(`❌ Failed to login: ${errorMessage}`);
        }
        this.isAuthenticated = false;
        return false;
      } finally {
        // Clear the promise so we can retry if needed
        this.loginPromise = null;
      }
    })();

    return await this.loginPromise;
  }

  // Auto-login using credentials from config
  async autoLogin() {
    // If token is already set, skip login
    if (config.AUTH_TOKEN) {
      this.isAuthenticated = true;
      return true;
    }

    // If credentials are provided, use them to login
    if (config.AUTH_EMAIL && config.AUTH_PASSWORD) {
      console.log('🔐 Attempting automatic login...');
      return await this.login(config.AUTH_EMAIL, config.AUTH_PASSWORD);
    }

    // No credentials provided
    return false;
  }

  // Refresh token if we get 401 error
  async refreshTokenIfNeeded() {
    if (this.isAuthenticated && config.AUTH_EMAIL && config.AUTH_PASSWORD) {
      console.log('🔄 Token expired or invalid, attempting to refresh...');
      return await this.login(config.AUTH_EMAIL, config.AUTH_PASSWORD);
    }
    return false;
  }

  // Fetch all vehicles from backend
  async getVehicles() {
    try {
      const response = await this.axios.get('/api/vehicles');
      return response.data;
    } catch (error) {
      // If 401, try to refresh token
      if (error.response?.status === 401) {
        const refreshed = await this.refreshTokenIfNeeded();
        if (refreshed) {
          // Retry the request
          try {
            const response = await this.axios.get('/api/vehicles');
            return response.data;
          } catch (retryError) {
            console.error('❌ Failed to fetch vehicles after token refresh:', retryError.message);
            return [];
          }
        }
      }
      console.error('❌ Failed to fetch vehicles:', error.message);
      return [];
    }
  }

  // Update vehicle status
  async updateVehicleStatus(vehicleId, status) {
    // Validate inputs
    if (!vehicleId) {
      console.error(`❌ Cannot update vehicle status: vehicleId is missing or invalid`);
      return false;
    }
    
    if (!status) {
      console.error(`❌ Cannot update vehicle status: status is missing`);
      return false;
    }
    
    // Ensure vehicleId is a string
    const vehicleIdStr = vehicleId.toString();
    
    try {
      const response = await this.axios.put(`/api/vehicles/${vehicleIdStr}`, { status });
      return true;
    } catch (error) {
      // Enhanced error logging for debugging
      const statusCode = error.response?.status;
      const statusText = error.response?.statusText;
      const errorData = error.response?.data;
      const requestUrl = `${this.axios.defaults.baseURL}/api/vehicles/${vehicleIdStr}`;
      
      // If 401, try to refresh token and retry
      if (statusCode === 401) {
        const refreshed = await this.refreshTokenIfNeeded();
        if (refreshed) {
          // Retry the request
          try {
            await this.axios.put(`/api/vehicles/${vehicleIdStr}`, { status });
            return true;
          } catch (retryError) {
            // Fall through to error handling below
            console.error(`❌ Failed to update vehicle ${vehicleIdStr} status after token refresh`);
          }
        }
        
        console.error(`❌ Failed to update vehicle ${vehicleIdStr} status: Authentication failed (401)`);
        console.error(`   ⚠️  Token may be expired or invalid. Auto-login will be attempted if credentials are configured.`);
        console.error(`   Request URL: ${requestUrl}`);
        console.error(`   Status being set: ${status}`);
      } else if (statusCode === 404) {
        console.error(`❌ Failed to update vehicle ${vehicleIdStr} status: Vehicle not found (404)`);
        console.error(`   ⚠️  Vehicle ID "${vehicleIdStr}" may be incorrect or vehicle doesn't exist in database`);
        console.error(`   Request URL: ${requestUrl}`);
        console.error(`   Status being set: ${status}`);
        if (errorData) {
          console.error(`   Response:`, errorData);
        }
      } else if (statusCode === 403) {
        console.error(`❌ Failed to update vehicle ${vehicleIdStr} status: Forbidden (403)`);
        console.error(`   ⚠️  User doesn't have permission to update vehicles`);
        console.error(`   Request URL: ${requestUrl}`);
      } else if (statusCode) {
        console.error(`❌ Failed to update vehicle ${vehicleIdStr} status: ${statusCode} ${statusText || 'Error'}`);
        console.error(`   Request URL: ${requestUrl}`);
        console.error(`   Status being set: ${status}`);
        if (errorData) {
          console.error(`   Response:`, errorData);
        }
      } else {
        // Network error or timeout
        console.error(`❌ Failed to update vehicle ${vehicleIdStr} status: ${error.message}`);
        console.error(`   ⚠️  Network error or timeout - check backend connection at ${this.axios.defaults.baseURL}`);
        console.error(`   Request URL: ${requestUrl}`);
      }
      
      return false;
    }
  }

  // Send GPS data
  async sendGPS(vehicleId, gpsData) {
    try {
      await this.axios.post('/api/gps', {
        vehicle: vehicleId,
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        speed: gpsData.speed || 0,
        heading: gpsData.heading || 0,
        timestamp: new Date()
      });
      return true;
    } catch (error) {
      // Don't log every GPS error (too verbose)
      return false;
    }
  }

  // Get dispatched faults assigned to specific vehicles
  // Backend AI dispatch assigns faults, simulator polls for them
  async getDispatchedFaults(vehicleIds) {
    try {
      const response = await this.axios.get('/api/faults');
      const allFaults = response.data || [];
      
      // Filter for faults assigned to our vehicles with status "pending_confirmation" or "assigned"
      const dispatchedFaults = allFaults.filter(fault => {
        // Check if fault is assigned to one of our vehicles
        const assignedVehicleId = fault.assigned_vehicle?._id || fault.assigned_vehicle;
        if (!assignedVehicleId) return false;
        
        // Convert to string for comparison
        const assignedIdStr = assignedVehicleId.toString();
        const vehicleIdStrs = vehicleIds.map(id => id.toString());
        
        // Check if assigned vehicle matches one of our vehicles
        const isAssignedToOurVehicle = vehicleIdStrs.includes(assignedIdStr);
        
        // Check if status is pending_confirmation or assigned
        const isDispatched = fault.status === 'pending_confirmation' || fault.status === 'assigned';
        
        return isAssignedToOurVehicle && isDispatched;
      });
      
      return dispatchedFaults;
    } catch (error) {
      console.error('❌ Failed to fetch dispatched faults:', error.message);
      return [];
    }
  }
}

export default new APIClient();