import axios from "axios";

// Determine the correct API base URL
// If VITE_API_URL contains a Docker service name (like "backend:5000"), 
// and we're running in browser (not in Docker), use localhost instead
const getApiBaseURL = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;
  
  // If no env URL, use localhost
  if (!envUrl) {
    return "http://localhost:5000";
  }
  
  // If URL contains Docker service name (backend:5000) and we're in browser
  // (browser can't resolve Docker service names), use localhost
  if (envUrl.includes("backend:") || envUrl.includes("backend/")) {
    // Replace Docker service name with localhost
    return envUrl.replace(/http:\/\/backend(:\d+)?/, "http://localhost$1");
  }
  
  return envUrl;
};

const API = axios.create({
  baseURL: getApiBaseURL(),
});

// Export API instance for use in other services
export default API;

// Add request interceptor for authentication (prepared for future use)
API.interceptors.request.use(
  (config) => {
    // Get token from localStorage if available
    const token = localStorage.getItem("authToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
API.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle common errors
    if (error.response) {
      // Server responded with error status
      console.error("API Error:", error.response.status, error.response.data);
    } else if (error.request) {
      // Request made but no response received
      console.error("Network Error:", error.request);
    } else {
      // Something else happened
      console.error("Error:", error.message);
    }
    return Promise.reject(error);
  }
);

// Get all vehicles
export const getVehicles = async () => {
  try {
    const res = await API.get("/api/vehicles");
    return res.data;
  } catch (error) {
    console.error("Failed to fetch vehicles:", error);
    throw error;
  }
};

// Get latest GPS location for one vehicle
export const getVehicleLocation = async (vehicleId: string) => {
  try {
    const res = await API.get(`/api/gps/latest/${vehicleId}`);
    return res.data;
  } catch (error) {
    console.error(`Failed to fetch GPS for vehicle ${vehicleId}:`, error);
    throw error;
  }
};

// Get all faults
export const getFaults = async () => {
  try {
    const res = await API.get("/api/faults");
    return res.data;
  } catch (error) {
    console.error("Failed to fetch faults:", error);
    throw error;
  }
};

// Authentication functions
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  username: string;
  email: string;
  password: string;
  role?: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
}

export const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  try {
    const res = await API.post("/api/auth/login", credentials);
    return res.data;
  } catch (error: any) {
    console.error("Login failed:", error);
    throw error;
  }
};

export const register = async (credentials: RegisterCredentials): Promise<{ message: string; user: any }> => {
  try {
    const res = await API.post("/api/auth/register", {
      ...credentials,
      role: credentials.role || "user",
    });
    return res.data;
  } catch (error: any) {
    console.error("Registration failed:", error);
    throw error;
  }
};

// Dispatch functions
export const runDispatchEngine = async (): Promise<{ message: string; dispatched: number; failed: number; results: any[] }> => {
  try {
    const res = await API.post("/api/dispatch/run");
    return res.data;
  } catch (error: any) {
    console.error("Dispatch failed:", error);
    throw error;
  }
};