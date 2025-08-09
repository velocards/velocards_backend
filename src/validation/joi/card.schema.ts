import Joi from 'joi';

// US State codes
const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC'
];

// Supported country codes
const SUPPORTED_COUNTRIES = ['US'];

// Phone number regex for E.164 format
const E164_PHONE_REGEX = /^\+[1-9]\d{1,14}$/;

// Name validation regex (letters, spaces, hyphens, apostrophes)
const NAME_REGEX = /^[a-zA-Z\s\-']+$/;

// Postal code regex (US format)
const US_POSTAL_REGEX = /^\d{5}(-\d{4})?$/;

// Create card schema
export const createCardSchema = Joi.object({
  body: Joi.object({
    // Card Configuration
    type: Joi.string().valid('single_use', 'multi_use').required(),
    programId: Joi.number()
      .integer()
      .positive()
      .required()
      .messages({
        'number.integer': 'Program ID must be an integer',
        'number.positive': 'Program ID must be positive'
      }),
    fundingAmount: Joi.number()
      .positive()
      .min(10)
      .max(10000)
      .required()
      .messages({
        'number.positive': 'Funding amount must be positive',
        'number.min': 'Minimum funding amount is $10',
        'number.max': 'Maximum funding amount is $10,000'
      }),
    spendingLimit: Joi.number()
      .positive()
      .max(10000)
      .optional()
      .messages({
        'number.positive': 'Spending limit must be positive',
        'number.max': 'Maximum spending limit is $10,000'
      }),
    expiresIn: Joi.number()
      .integer()
      .min(1)
      .max(365)
      .optional()
      .messages({
        'number.integer': 'Expiry days must be an integer',
        'number.min': 'Minimum expiry is 1 day',
        'number.max': 'Maximum expiry is 365 days'
      }),
    
    // Cardholder Information - ALL REQUIRED
    firstName: Joi.string()
      .min(2)
      .max(50)
      .pattern(NAME_REGEX)
      .trim()
      .required()
      .messages({
        'string.min': 'First name must be at least 2 characters',
        'string.max': 'First name cannot exceed 50 characters',
        'string.pattern.base': 'First name can only contain letters, spaces, hyphens, and apostrophes'
      }),
    lastName: Joi.string()
      .min(2)
      .max(50)
      .pattern(NAME_REGEX)
      .trim()
      .required()
      .messages({
        'string.min': 'Last name must be at least 2 characters',
        'string.max': 'Last name cannot exceed 50 characters',
        'string.pattern.base': 'Last name can only contain letters, spaces, hyphens, and apostrophes'
      }),
    phoneNumber: Joi.string()
      .pattern(E164_PHONE_REGEX)
      .required()
      .messages({
        'string.pattern.base': 'Phone number must be in international format (e.g., +1234567890)'
      }),
    
    // Billing Address - ALL REQUIRED
    streetAddress: Joi.string()
      .min(5)
      .max(255)
      .trim()
      .required()
      .messages({
        'string.min': 'Street address must be at least 5 characters',
        'string.max': 'Street address cannot exceed 255 characters'
      }),
    city: Joi.string()
      .min(2)
      .max(100)
      .pattern(/^[a-zA-Z\s\-'.]+$/)
      .trim()
      .required()
      .messages({
        'string.min': 'City must be at least 2 characters',
        'string.max': 'City cannot exceed 100 characters',
        'string.pattern.base': 'City can only contain letters and common punctuation'
      }),
    state: Joi.string()
      .valid(...US_STATES)
      .required()
      .messages({
        'any.only': 'Please provide a valid 2-letter US state code'
      }),
    postalCode: Joi.string()
      .pattern(US_POSTAL_REGEX)
      .required()
      .messages({
        'string.pattern.base': 'Please provide a valid US ZIP code (e.g., 12345 or 12345-6789)'
      }),
    country: Joi.string()
      .valid(...SUPPORTED_COUNTRIES)
      .required()
      .messages({
        'any.only': 'Please provide a valid 2-letter country code'
      }),
    
    // Optional Fields
    nickname: Joi.string()
      .max(100)
      .trim()
      .optional()
      .messages({
        'string.max': 'Nickname cannot exceed 100 characters'
      }),
    merchantRestrictions: Joi.object({
      allowedCategories: Joi.array().items(Joi.string()).optional(),
      blockedCategories: Joi.array().items(Joi.string()).optional(),
      allowedMerchants: Joi.array().items(Joi.string()).optional(),
      blockedMerchants: Joi.array().items(Joi.string()).optional()
    }).optional()
  }).custom((value, helpers) => {
    if (value.spendingLimit && value.spendingLimit > value.fundingAmount) {
      return helpers.error('any.invalid');
    }
    return value;
  }).messages({
    'any.invalid': 'Spending limit cannot exceed funding amount'
  })
});

// Update card limits schema
export const updateCardLimitsSchema = Joi.object({
  params: Joi.object({
    cardId: Joi.string().uuid().required().messages({
      'string.guid': 'Invalid card ID format'
    })
  }),
  body: Joi.object({
    spendingLimit: Joi.number()
      .positive()
      .max(10000)
      .required()
      .messages({
        'number.positive': 'Spending limit must be positive',
        'number.max': 'Maximum spending limit is $10,000'
      })
  })
});

// Card ID parameter schema
export const cardIdParamSchema = Joi.object({
  params: Joi.object({
    cardId: Joi.string().uuid().required().messages({
      'string.guid': 'Invalid card ID format'
    })
  })
});

// Card transactions query schema
export const cardTransactionsQuerySchema = Joi.object({
  params: Joi.object({
    cardId: Joi.string().uuid().required().messages({
      'string.guid': 'Invalid card ID format'
    })
  }),
  query: Joi.object({
    page: Joi.number()
      .integer()
      .positive()
      .optional()
      .default(1)
      .messages({
        'number.positive': 'Page must be positive'
      }),
    limit: Joi.number()
      .integer()
      .positive()
      .max(100)
      .optional()
      .default(20)
      .messages({
        'number.positive': 'Limit must be positive',
        'number.max': 'Limit must be between 1 and 100'
      })
  })
});

// Create card session schema
export const createCardSessionSchema = Joi.object({
  params: Joi.object({
    cardId: Joi.string().uuid().required().messages({
      'string.guid': 'Invalid card ID format'
    })
  }),
  body: Joi.object({
    purpose: Joi.string()
      .valid('view_pan', 'view_cvv', 'view_full')
      .required()
      .messages({
        'any.only': 'Purpose must be one of: view_pan, view_cvv, view_full'
      })
  })
});

// Get secure card details schema
export const getSecureCardDetailsSchema = Joi.object({
  body: Joi.object({
    sessionId: Joi.string().uuid().required().messages({
      'string.guid': 'Invalid session ID format'
    }),
    token: Joi.string().min(64).max(64).required().messages({
      'string.min': 'Invalid token format',
      'string.max': 'Invalid token format'
    }),
    field: Joi.string().optional()
  })
});