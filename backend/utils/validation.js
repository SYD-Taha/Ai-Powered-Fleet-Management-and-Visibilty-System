// ===========================
// Validation Utility Functions
// ===========================

/**
 * Validate email format
 * @param {string} email - Email address to validate
 * @returns {Object} Validation result with isValid boolean and error message
 */
export const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return {
      isValid: false,
      error: 'Email is required'
    };
  }

  // Trim whitespace
  const trimmedEmail = email.trim();

  if (trimmedEmail.length === 0) {
    return {
      isValid: false,
      error: 'Email cannot be empty'
    };
  }

  // Email regex pattern: user@domain.com
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(trimmedEmail)) {
    return {
      isValid: false,
      error: 'Please enter a valid email address (e.g., user@example.com)'
    };
  }

  // Additional check: email should not be too long (RFC 5321 limit is 320 characters)
  if (trimmedEmail.length > 320) {
    return {
      isValid: false,
      error: 'Email address is too long (maximum 320 characters)'
    };
  }

  return {
    isValid: true,
    error: null
  };
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} Validation result with isValid boolean, errors array, and strength indicator
 */
export const validatePassword = (password) => {
  const errors = [];
  const requirements = {
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false
  };

  if (!password || typeof password !== 'string') {
    return {
      isValid: false,
      errors: ['Password is required'],
      requirements,
      strength: 'weak'
    };
  }

  // Minimum length: 8 characters
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  } else {
    requirements.minLength = true;
  }

  // At least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter (A-Z)');
  } else {
    requirements.hasUppercase = true;
  }

  // At least one lowercase letter
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter (a-z)');
  } else {
    requirements.hasLowercase = true;
  }

  // At least one number
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number (0-9)');
  } else {
    requirements.hasNumber = true;
  }

  // At least one special character
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)');
  } else {
    requirements.hasSpecialChar = true;
  }

  // Calculate password strength
  const metRequirements = Object.values(requirements).filter(Boolean).length;
  let strength = 'weak';
  if (metRequirements === 5) {
    strength = 'strong';
  } else if (metRequirements >= 3) {
    strength = 'medium';
  }

  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : [],
    requirements,
    strength
  };
};

/**
 * Validate username format
 * @param {string} username - Username to validate
 * @returns {Object} Validation result with isValid boolean and error message
 */
export const validateUsername = (username) => {
  if (!username || typeof username !== 'string') {
    return {
      isValid: false,
      error: 'Username is required'
    };
  }

  // Trim whitespace
  const trimmedUsername = username.trim();

  // Minimum length: 3 characters
  if (trimmedUsername.length < 3) {
    return {
      isValid: false,
      error: 'Username must be at least 3 characters long'
    };
  }

  // Maximum length: 30 characters
  if (trimmedUsername.length > 30) {
    return {
      isValid: false,
      error: 'Username must be no more than 30 characters long'
    };
  }

  // Allowed characters: alphanumeric, underscore, hyphen
  // No spaces allowed
  const usernameRegex = /^[a-zA-Z0-9_-]+$/;

  if (!usernameRegex.test(trimmedUsername)) {
    return {
      isValid: false,
      error: 'Username can only contain letters, numbers, underscores (_), and hyphens (-). No spaces allowed.'
    };
  }

  // Username cannot start or end with underscore or hyphen
  if (/^[_-]|[_-]$/.test(trimmedUsername)) {
    return {
      isValid: false,
      error: 'Username cannot start or end with underscore (_) or hyphen (-)'
    };
  }

  return {
    isValid: true,
    error: null
  };
};

/**
 * Validate all registration fields at once
 * @param {Object} data - Registration data with username, email, password
 * @returns {Object} Validation result with isValid boolean and errors object
 */
export const validateRegistration = (data) => {
  const errors = {};
  let isValid = true;

  // Validate username
  const usernameValidation = validateUsername(data.username);
  if (!usernameValidation.isValid) {
    errors.username = usernameValidation.error;
    isValid = false;
  }

  // Validate email
  const emailValidation = validateEmail(data.email);
  if (!emailValidation.isValid) {
    errors.email = emailValidation.error;
    isValid = false;
  }

  // Validate password
  const passwordValidation = validatePassword(data.password);
  if (!passwordValidation.isValid) {
    errors.password = passwordValidation.errors;
    isValid = false;
  }

  return {
    isValid,
    errors
  };
};

