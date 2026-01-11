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
    .valid('gemini-flash', 'gemini-pro')
    .required()
    .messages({
      'any.only': 'Default service must be gemini-flash or gemini-pro',
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
    credentials: googleCredentialsSchema,
    templateSlideUrl: Joi.string()
      .uri()
      .allow('', null)
      .default(null)
      .messages({
        'string.uri': 'Template slide URL must be a valid URL'
      }),
    templateSlideIndex: Joi.number()
      .integer()
      .min(1)
      .default(1)
      .messages({
        'number.base': 'Template slide index must be a number',
        'number.integer': 'Template slide index must be an integer',
        'number.min': 'Template slide index must be at least 1'
      })
  }).default({ credentials: null, templateSlideUrl: null, templateSlideIndex: 1 })
});

// Validation for updating settings
export const updateSettingsSchema = Joi.object({
  defaultService: Joi.string()
    .valid('gemini-flash', 'gemini-pro')
    .messages({
      'any.only': 'Default service must be gemini-flash or gemini-pro'
    }),
  defaultVariantCount: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .messages({
      'number.base': 'Default variant count must be a number',
      'number.min': 'Default variant count must be at least 1',
      'number.max': 'Default variant count must not exceed 10'
    }),
  googleSlidesTemplateUrl: Joi.string()
    .uri()
    .allow('', null)
    .messages({
      'string.uri': 'Template slide URL must be a valid URL'
    }),
  googleSlidesTemplateIndex: Joi.number()
    .integer()
    .min(1)
    .messages({
      'number.base': 'Template slide index must be a number',
      'number.integer': 'Template slide index must be an integer',
      'number.min': 'Template slide index must be at least 1'
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
    }),
  fromSlideIndex: Joi.number()
    .integer()
    .min(0)
    .messages({
      'number.base': 'fromSlideIndex must be a number',
      'number.integer': 'fromSlideIndex must be an integer',
      'number.min': 'fromSlideIndex must be at least 0'
    }),
  resume: Joi.boolean()
    .messages({
      'boolean.base': 'resume must be a boolean'
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
      email: settings.googleSlides?.credentials?.email || null,
      templateSlideUrl: settings.googleSlides?.templateSlideUrl || null,
      templateSlideIndex: settings.googleSlides?.templateSlideIndex || 1
    }
  };
}

export default {
  settingsSchema,
  updateSettingsSchema,
  exportDeckSchema,
  maskSettings
};
