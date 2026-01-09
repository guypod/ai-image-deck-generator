import Joi from 'joi';

// Google OAuth credentials schema
const googleCredentialsSchema = Joi.object({
  clientId: Joi.string()
    .required(),
  clientSecret: Joi.string()
    .required(),
  refreshToken: Joi.string()
    .required(),
  email: Joi.string()
    .email()
    .required(),
  connectedAt: Joi.date()
    .iso()
    .required()
}).allow(null);

// Settings schema
export const settingsSchema = Joi.object({
  defaultService: Joi.string()
    .valid('openai-gpt-image', 'gemini-flash', 'gemini-pro')
    .required()
    .messages({
      'any.only': 'Default service must be openai-gpt-image, gemini-flash, or gemini-pro',
      'any.required': 'Default service is required'
    }),
  defaultVariantCount: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .required()
    .messages({
      'number.base': 'Default variant count must be a number',
      'number.min': 'Default variant count must be at least 1',
      'number.max': 'Default variant count must not exceed 10',
      'any.required': 'Default variant count is required'
    }),
  googleSlides: Joi.object({
    credentials: googleCredentialsSchema
  }).default({ credentials: null })
});

// Validation for updating settings
export const updateSettingsSchema = Joi.object({
  defaultService: Joi.string()
    .valid('openai-gpt-image', 'gemini-flash', 'gemini-pro')
    .messages({
      'any.only': 'Default service must be openai-gpt-image, gemini-flash, or gemini-pro'
    }),
  defaultVariantCount: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .messages({
      'number.base': 'Default variant count must be a number',
      'number.min': 'Default variant count must be at least 1',
      'number.max': 'Default variant count must not exceed 10'
    })
}).min(1); // At least one field must be present


// Validation for export request
export const exportDeckSchema = Joi.object({
  title: Joi.string()
    .min(1)
    .max(200)
    .messages({
      'string.min': 'Title must be at least 1 character',
      'string.max': 'Title must not exceed 200 characters'
    })
});

/**
 * Mask settings for client response
 */
export function maskSettings(settings) {
  return {
    ...settings,
    googleSlides: {
      connected: !!settings.googleSlides?.credentials,
      email: settings.googleSlides?.credentials?.email || null
    }
  };
}

export default {
  settingsSchema,
  updateSettingsSchema,
  exportDeckSchema,
  maskSettings
};
