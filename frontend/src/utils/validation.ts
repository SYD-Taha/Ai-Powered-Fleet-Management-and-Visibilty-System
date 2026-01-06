// ===========================
// Frontend Validation Utility Functions
// ===========================

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  errors?: string[];
}

export interface PasswordValidationResult extends ValidationResult {
  requirements: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecialChar: boolean;
  };
  strength: 'weak' | 'medium' | 'strong';
}

/**
 * Validate email format
 * @param email - Email address to validate
 * @returns Validation result with isValid boolean and error message
 */
export const validateEmail = (email: string): ValidationResult => {
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
    isValid: true
  };
};

/**
 * Validate password strength
 * @param password - Password to validate
 * @returns Validation result with isValid boolean, errors array, requirements met, and strength indicator
 */
export const validatePassword = (password: string): PasswordValidationResult => {
  const errors: string[] = [];
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
  let strength: 'weak' | 'medium' | 'strong' = 'weak';
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
 * @param username - Username to validate
 * @returns Validation result with isValid boolean and error message
 */
export const validateUsername = (username: string): ValidationResult => {
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
    isValid: true
  };
};

/**
 * Get password strength color for UI
 * @param strength - Password strength level
 * @returns Color class or hex value
 */
export const getPasswordStrengthColor = (strength: 'weak' | 'medium' | 'strong'): string => {
  switch (strength) {
    case 'strong':
      return 'text-green-600';
    case 'medium':
      return 'text-yellow-600';
    case 'weak':
    default:
      return 'text-red-600';
  }
};

/**
 * Get password strength background color for progress bar
 * @param strength - Password strength level
 * @returns Color class or hex value
 */
export const getPasswordStrengthBgColor = (strength: 'weak' | 'medium' | 'strong'): string => {
  switch (strength) {
    case 'strong':
      return 'bg-green-500';
    case 'medium':
      return 'bg-yellow-500';
    case 'weak':
    default:
      return 'bg-red-500';
  }
};

