/**
 * SaveWise Password Complexity & Strength Validation Module
 * Enforces: Min 8 chars, >=1 Uppercase, >=1 Lowercase, >=1 Digit, >=1 Special Character
 */

export function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }

  const errors = [];
  if (password.length < 8) errors.push('at least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('at least 1 uppercase letter (A-Z)');
  if (!/[a-z]/.test(password)) errors.push('at least 1 lowercase letter (a-z)');
  if (!/[0-9]/.test(password)) errors.push('at least 1 numerical digit (0-9)');
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('at least 1 special character (e.g. !@#$%^&*)');

  if (errors.length > 0) {
    return {
      valid: false,
      error: `Password is too weak. It must contain ${errors.join(', ')}.`
    };
  }

  return { valid: true };
}

export function evaluatePasswordStrength(password = '') {
  const criteria = {
    hasMinLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasDigit: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };

  const metCount = Object.values(criteria).filter(Boolean).length;
  const isAllMet = metCount === 5;

  let label = 'Weak';
  let color = '#ef4444'; // Red
  let percent = 20;

  if (!password) {
    label = '';
    percent = 0;
  } else if (!criteria.hasMinLength || metCount <= 2) {
    label = 'Weak';
    color = '#ef4444';
    percent = Math.min(metCount * 15, 35);
  } else if (metCount === 3 || metCount === 4) {
    label = 'Normal';
    color = '#f59e0b'; // Amber/Yellow
    percent = 65;
  } else if (isAllMet && password.length < 12) {
    label = 'Strong';
    color = '#10b981'; // Green
    percent = 85;
  } else if (isAllMet && password.length >= 12) {
    label = 'Very Strong';
    color = '#059669'; // Emerald
    percent = 100;
  }

  return {
    criteria,
    metCount,
    isAllMet,
    label,
    color,
    percent
  };
}
