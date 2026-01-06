import rateLimit from 'express-rate-limit';

// General API rate limiter - 100 requests per 15 minutes
// Skip vehicles route as it has its own more permissive limiter
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip general limiter for vehicles endpoint (has its own limiter)
    return req.path.startsWith('/api/vehicles');
  },
});

// Dispatch endpoint rate limiter - 20 requests per minute (stricter)
export const dispatchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Limit each IP to 20 requests per minute
  message: 'Too many dispatch requests. Please wait before trying again.',
  standardHeaders: true,
  legacyHeaders: false,
});

// GPS endpoint rate limiter - 200 requests per minute (high frequency allowed)
export const gpsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // Limit each IP to 200 requests per minute
  message: 'Too many GPS requests. Please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Authentication endpoints rate limiter - 10 requests per 15 minutes (stricter for security)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per 15 minutes
  message: 'Too many authentication attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Vehicles endpoint rate limiter - 500 requests per 15 minutes (permissive for simulator)
export const vehiclesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs (5x general limit)
  message: 'Too many vehicle requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

