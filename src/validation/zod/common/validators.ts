import { z } from 'zod';

// Email validation with stricter rules
export const emailSchema = z.string()
  .trim()
  .email('Invalid email format')
  .toLowerCase()
  .max(255, 'Email too long')
  .refine(
    (email) => {
      // Additional email validation rules
      const parts = email.split('@');
      if (parts.length !== 2) return false;
      const [local, domain] = parts;
      
      // Check local part
      if (!local || local.length > 64) return false;
      if (local.startsWith('.') || local.endsWith('.')) return false;
      if (local.includes('..')) return false;
      
      // Check domain part
      if (!domain || domain.length > 253) return false;
      if (!domain.includes('.')) return false;
      if (domain.startsWith('.') || domain.endsWith('.')) return false;
      
      return true;
    },
    'Invalid email format'
  );

// UUID validation
export const uuidSchema = z.string()
  .uuid('Invalid UUID format')
  .toLowerCase();

// URL validation with protocol check
export const urlSchema = z.string()
  .url('Invalid URL format')
  .max(2048, 'URL too long')
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
      } catch {
        return false;
      }
    },
    'URL must use HTTP or HTTPS protocol'
  );

// Strong password validation
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long')
  .refine(
    (password) => /[A-Z]/.test(password),
    'Password must contain at least one uppercase letter'
  )
  .refine(
    (password) => /[a-z]/.test(password),
    'Password must contain at least one lowercase letter'
  )
  .refine(
    (password) => /[0-9]/.test(password),
    'Password must contain at least one number'
  )
  .refine(
    (password) => /[!@#$%^&*(),.?":{}|<>]/.test(password),
    'Password must contain at least one special character'
  );

// Phone number validation (E.164 format)
export const phoneNumberSchema = z.string()
  .regex(/^\+[1-9]\d{1,14}$/, 'Phone number must be in E.164 format (e.g., +1234567890)')
  .max(16, 'Phone number too long');

// IP address validation (IPv4 and IPv6)
export const ipAddressSchema = z.string()
  .refine(
    (ip) => {
      // IPv4 regex
      const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      
      // IPv6 regex (simplified)
      const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
      
      return ipv4Regex.test(ip) || ipv6Regex.test(ip);
    },
    'Invalid IP address format'
  );

// Currency code validation (ISO 4217)
export const currencyCodeSchema = z.string()
  .length(3, 'Currency code must be 3 characters')
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Invalid currency code format');

// Country code validation (ISO 3166-1 alpha-2)
export const countryCodeSchema = z.string()
  .length(2, 'Country code must be 2 characters')
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, 'Invalid country code format');

// Date validation with age restrictions
export const birthDateSchema = z.string()
  .refine(
    (date) => {
      const parsed = new Date(date);
      return !isNaN(parsed.getTime());
    },
    'Invalid date format'
  )
  .refine(
    (date) => {
      const birthDate = new Date(date);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        return age - 1 >= 18;
      }
      
      return age >= 18;
    },
    'Must be at least 18 years old'
  )
  .refine(
    (date) => {
      const birthDate = new Date(date);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      
      return age <= 120;
    },
    'Invalid birth date'
  );

// Monetary amount validation
export const monetaryAmountSchema = z.number()
  .positive('Amount must be positive')
  .multipleOf(0.01, 'Amount must have at most 2 decimal places')
  .max(999999999.99, 'Amount too large');

// Pagination schemas
export const paginationSchema = z.object({
  page: z.coerce
    .number()
    .int('Page must be an integer')
    .positive('Page must be positive')
    .default(1),
  limit: z.coerce
    .number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .default(20)
});

// Array length constraints
export const arrayLengthSchema = <T extends z.ZodTypeAny>(
  itemSchema: T,
  minLength: number = 0,
  maxLength: number = 100
) => {
  return z.array(itemSchema)
    .min(minLength, `Array must contain at least ${minLength} items`)
    .max(maxLength, `Array cannot contain more than ${maxLength} items`);
};

// Request size limit helper
export const maxStringLength = (maxLength: number) => {
  return z.string().max(maxLength, `String cannot exceed ${maxLength} characters`);
};

// Sanitized string factory (removes dangerous characters)
export const sanitizedString = (minLength?: number, maxLength?: number) => {
  let schema = z.string();
  
  if (minLength !== undefined) {
    schema = schema.min(minLength, `Must be at least ${minLength} characters`);
  }
  
  if (maxLength !== undefined) {
    schema = schema.max(maxLength, `Cannot exceed ${maxLength} characters`);
  }
  
  return schema.transform((str) => {
    // Remove null bytes
    str = str.replace(/\0/g, '');
    // Remove control characters except newline and tab
    str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    // Trim whitespace
    return str.trim();
  });
};

// For backward compatibility
export const sanitizedStringSchema = sanitizedString();

// Export all schemas as a namespace for easy access
export const CommonValidators = {
  email: emailSchema,
  uuid: uuidSchema,
  url: urlSchema,
  password: passwordSchema,
  phoneNumber: phoneNumberSchema,
  ipAddress: ipAddressSchema,
  currencyCode: currencyCodeSchema,
  countryCode: countryCodeSchema,
  birthDate: birthDateSchema,
  monetaryAmount: monetaryAmountSchema,
  pagination: paginationSchema,
  arrayLength: arrayLengthSchema,
  maxString: maxStringLength,
  sanitizedString: sanitizedStringSchema,
  sanitizedStringFactory: sanitizedString
};