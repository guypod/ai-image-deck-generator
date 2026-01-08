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
  apiKeys: Joi.object({
    googleImagen: Joi.string()
      .min(10)
      .max(500)
      .allow(null, '')
      .messages({
        'string.min': 'Google Imagen API key must be at least 10 characters',
        'string.max': 'Google Imagen API key must not exceed 500 characters'
      }),
    openaiDalle: Joi.string()
      .min(10)
      .max(500)
      .allow(null, '')
      .messages({
        'string.min': 'OpenAI DALL-E API key must be at least 10 characters',
        'string.max': 'OpenAI DALL-E API key must not exceed 500 characters'
      })
  }).required(),
  defaultService: Joi.string()
    .valid('google-imagen', 'openai-dalle')
    .required()
    .messages({
      'any.only': 'Default service must be either google-imagen or openai-dalle',
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
  apiKeys: Joi.object({
    googleImagen: Joi.string()
      .min(10)
      .max(500)
      .allow(null, '', '***masked***')
      .messages({
        'string.min': 'Google Imagen API key must be at least 10 characters',
        'string.max': 'Google Imagen API key must not exceed 500 characters'
      }),
    openaiDalle: Joi.string()
      .min(10)
      .max(500)
      .allow(null, '', '***masked***')
      .messages({
        'string.min': 'OpenAI DALL-E API key must be at least 10 characters',
        'string.max': 'OpenAI DALL-E API key must not exceed 500 characters'
      })
  }),
  defaultService: Joi.string()
    .valid('google-imagen', 'openai-dalle')
    .messages({
      'any.only': 'Default service must be either google-imagen or openai-dalle'
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

// Validation for testing API key
export const testApiKeySchema = Joi.object({
  service: Joi.string()
    .valid('google-imagen', 'openai-dalle')
    .required()
    .messages({
      'any.only': 'Service must be either google-imagen or openai-dalle',
      'any.required': 'Service is required'
    }),
  apiKey: Joi.string()
    .min(10)
    .max(500)
    .required()
    .messages({
      'string.min': 'API key must be at least 10 characters',
      'string.max': 'API key must not exceed 500 characters',
      'any.required': 'API key is required'
    })
});

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
 * Mask API key for security (show only last 4 characters)
 */
export function maskApiKey(key) {
  if (!key || key.length <= 4) {
    return '***masked***';
  }
  return '***' + key.slice(-4);
}

/**
 * Mask settings for client response
 */
export function maskSettings(settings) {
  return {
    ...settings,
    apiKeys: {
      googleImagen: settings.apiKeys.googleImagen ? maskApiKey(settings.apiKeys.googleImagen) : null,
      openaiDalle: settings.apiKeys.openaiDalle ? maskApiKey(settings.apiKeys.openaiDalle) : null
    },
    googleSlides: {
      connected: !!settings.googleSlides?.credentials,
      email: settings.googleSlides?.credentials?.email || null
    }
  };
}

export default {
  settingsSchema,
  updateSettingsSchema,
  testApiKeySchema,
  exportDeckSchema,
  maskApiKey,
  maskSettings
};
