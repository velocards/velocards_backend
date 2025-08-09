import Joi from 'joi';

// Profile update schema
export const updateProfileSchema = Joi.object({
  body: Joi.object({
    firstName: Joi.string().min(1).max(50).optional(),
    lastName: Joi.string().min(1).max(50).optional(),
    phoneNumber: Joi.string()
      .pattern(/^\+?[1-9]\d{1,14}$/)
      .optional()
      .messages({
        'string.pattern.base': 'Invalid phone number format'
      }),
    dateOfBirth: Joi.string()
      .optional()
      .custom((value, helpers) => {
        const dob = new Date(value);
        const age = (new Date()).getFullYear() - dob.getFullYear();
        if (age < 18 || age > 120) {
          return helpers.error('any.invalid');
        }
        return value;
      }, 'age validation')
      .messages({
        'any.invalid': 'Must be between 18 and 120 years old'
      }),
    address: Joi.object({
      street: Joi.string().min(1).max(100).optional(),
      city: Joi.string().min(1).max(50).optional(),
      state: Joi.string().min(1).max(50).optional(),
      postalCode: Joi.string().min(1).max(20).optional(),
      country: Joi.string().length(2).optional().messages({
        'string.length': 'Country must be 2-letter ISO code'
      })
    }).optional()
  }).min(1).messages({
    'object.min': 'At least one field must be provided for update'
  })
});

// Settings update schema
export const updateSettingsSchema = Joi.object({
  body: Joi.object({
    notifications: Joi.object({
      email: Joi.object({
        transactions: Joi.boolean().optional(),
        security: Joi.boolean().optional(),
        marketing: Joi.boolean().optional(),
        updates: Joi.boolean().optional()
      }).optional(),
      sms: Joi.object({
        transactions: Joi.boolean().optional(),
        security: Joi.boolean().optional()
      }).optional(),
      push: Joi.object({
        transactions: Joi.boolean().optional(),
        security: Joi.boolean().optional(),
        updates: Joi.boolean().optional()
      }).optional()
    }).optional(),
    security: Joi.object({
      twoFactorEnabled: Joi.boolean().optional(),
      loginAlerts: Joi.boolean().optional(),
      transactionAlerts: Joi.boolean().optional(),
      ipWhitelisting: Joi.boolean().optional(),
      allowedIps: Joi.array().items(Joi.string().ip()).optional()
    }).optional(),
    preferences: Joi.object({
      language: Joi.string().valid('en', 'es', 'fr', 'de', 'pt', 'zh', 'ja', 'ko').optional(),
      currency: Joi.string().length(3).optional().messages({
        'string.length': 'Currency must be 3-letter ISO code'
      }),
      timezone: Joi.string().optional(),
      dateFormat: Joi.string().valid('MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD').optional(),
      theme: Joi.string().valid('light', 'dark', 'system').optional()
    }).optional()
  }).min(1).messages({
    'object.min': 'At least one setting must be provided for update'
  })
});

// Balance history query schema
export const balanceHistoryQuerySchema = Joi.object({
  query: Joi.object({
    page: Joi.number()
      .integer()
      .positive()
      .default(1)
      .messages({
        'number.positive': 'Page must be positive'
      }),
    limit: Joi.number()
      .integer()
      .positive()
      .max(100)
      .default(20)
      .messages({
        'number.positive': 'Limit must be positive',
        'number.max': 'Limit must be between 1 and 100'
      }),
    from: Joi.date()
      .iso()
      .optional()
      .messages({
        'date.format': 'Invalid date format'
      }),
    to: Joi.date()
      .iso()
      .optional()
      .messages({
        'date.format': 'Invalid date format'
      }),
    type: Joi.string()
      .valid('deposit', 'card_funding', 'refund', 'withdrawal', 'fee', 'adjustment', 'all')
      .optional()
      .default('all'),
    sortBy: Joi.string()
      .valid('created_at', 'amount')
      .optional()
      .default('created_at'),
    sortOrder: Joi.string()
      .valid('asc', 'desc')
      .optional()
      .default('desc')
  })
});

// Authentication schemas
export const registerSchema = Joi.object({
  body: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Invalid email address'
    }),
    password: Joi.string().min(8).required().messages({
      'string.min': 'Password must be at least 8 characters'
    }),
    firstName: Joi.string().min(1).required().messages({
      'string.min': 'First name is required'
    }),
    lastName: Joi.string().min(1).required().messages({
      'string.min': 'Last name is required'
    }),
    phone: Joi.string().optional(),
    captchaToken: Joi.string().optional()
  })
});

export const loginSchema = Joi.object({
  body: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Invalid email address'
    }),
    password: Joi.string().min(1).required().messages({
      'string.min': 'Password is required'
    }),
    captchaToken: Joi.string().optional()
  })
});

export const refreshTokenSchema = Joi.object({
  body: Joi.object({
    refreshToken: Joi.string().min(1).optional().messages({
      'string.min': 'Refresh token is required'
    })
  })
});

export const forgotPasswordSchema = Joi.object({
  body: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Invalid email address'
    }),
    captchaToken: Joi.string().optional()
  })
});

export const resetPasswordSchema = Joi.object({
  body: Joi.object({
    token: Joi.string().min(1).required().messages({
      'string.min': 'Reset token is required'
    }),
    password: Joi.string().min(8).required().messages({
      'string.min': 'Password must be at least 8 characters'
    })
  })
});

export const verifyEmailSchema = Joi.object({
  body: Joi.object({
    token: Joi.string().min(1).required().messages({
      'string.min': 'Verification token is required'
    })
  })
});

export const resendVerificationSchema = Joi.object({
  body: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Invalid email address'
    })
  })
});

export const changePasswordSchema = Joi.object({
  body: Joi.object({
    oldPassword: Joi.string().min(1).required().messages({
      'string.min': 'Current password is required'
    }),
    newPassword: Joi.string().min(8).required().messages({
      'string.min': 'New password must be at least 8 characters'
    })
  })
});