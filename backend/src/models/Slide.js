import Joi from 'joi';

// Image metadata schema
const imageMetadataSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required(),
  filename: Joi.string()
    .pattern(/^image-\d{3}\.jpg$/)
    .required()
    .messages({
      'string.pattern.base': 'Image filename must match pattern: image-###.jpg'
    }),
  createdAt: Joi.date()
    .iso()
    .required(),
  service: Joi.string()
    .valid('google-imagen', 'openai-dalle', 'gemini-flash', 'gemini-pro')
    .required()
    .messages({
      'any.only': 'Service must be google-imagen, openai-dalle, gemini-flash, or gemini-pro'
    }),
  prompt: Joi.string()
    .min(1)
    .max(2000)
    .required()
    .messages({
      'string.min': 'Prompt must be at least 1 character',
      'string.max': 'Prompt must not exceed 2000 characters'
    }),
  sourceImageId: Joi.string()
    .uuid()
    .allow(null)
    .default(null),
  isPinned: Joi.boolean()
    .required()
});

// Slide schema
export const slideSchema = Joi.object({
  id: Joi.string()
    .pattern(/^slide-\d{3}$/)
    .required()
    .messages({
      'string.pattern.base': 'Slide ID must match pattern: slide-###'
    }),
  order: Joi.number()
    .integer()
    .min(0)
    .required()
    .messages({
      'number.base': 'Order must be a number',
      'number.min': 'Order must be at least 0'
    }),
  speakerNotes: Joi.string()
    .max(5000)
    .allow('')
    .default('')
    .messages({
      'string.max': 'Speaker notes must not exceed 5000 characters'
    }),
  imageDescription: Joi.string()
    .max(2000)
    .allow('')
    .default('')
    .messages({
      'string.max': 'Image description must not exceed 2000 characters'
    }),
  generatedImages: Joi.array()
    .items(imageMetadataSchema)
    .default([])
});

// Validation for slide creation
export const createSlideSchema = Joi.object({
  speakerNotes: Joi.string()
    .max(5000)
    .allow('')
    .default('')
    .messages({
      'string.max': 'Speaker notes must not exceed 5000 characters'
    }),
  imageDescription: Joi.string()
    .max(2000)
    .allow('')
    .default('')
    .messages({
      'string.max': 'Image description must not exceed 2000 characters'
    })
});

// Validation for slide update
export const updateSlideSchema = Joi.object({
  speakerNotes: Joi.string()
    .max(5000)
    .allow('')
    .messages({
      'string.max': 'Speaker notes must not exceed 5000 characters'
    }),
  imageDescription: Joi.string()
    .max(2000)
    .allow('')
    .messages({
      'string.max': 'Image description must not exceed 2000 characters'
    }),
  order: Joi.number()
    .integer()
    .min(0)
    .messages({
      'number.base': 'Order must be a number',
      'number.min': 'Order must be at least 0'
    })
}).min(1); // At least one field must be present

// Validation for reorder slides
export const reorderSlidesSchema = Joi.object({
  slideIds: Joi.array()
    .items(Joi.string().pattern(/^slide-\d{3}$/))
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one slide ID is required',
      'any.required': 'Slide IDs array is required'
    })
});

// Validation for image generation
export const generateImagesSchema = Joi.object({
  count: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .default(2)
    .messages({
      'number.base': 'Count must be a number',
      'number.min': 'Count must be at least 1',
      'number.max': 'Count must not exceed 10'
    }),
  service: Joi.string()
    .valid('google-imagen', 'openai-dalle')
    .default('google-imagen')
    .messages({
      'any.only': 'Service must be either google-imagen or openai-dalle'
    })
});

// Validation for image tweak
export const tweakImageSchema = Joi.object({
  imageId: Joi.string()
    .uuid()
    .required()
    .messages({
      'any.required': 'Image ID is required'
    }),
  prompt: Joi.string()
    .min(1)
    .max(500)
    .required()
    .messages({
      'string.min': 'Tweak prompt must be at least 1 character',
      'string.max': 'Tweak prompt must not exceed 500 characters',
      'any.required': 'Tweak prompt is required'
    }),
  count: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .default(2)
    .messages({
      'number.base': 'Count must be a number',
      'number.min': 'Count must be at least 1',
      'number.max': 'Count must not exceed 10'
    })
});

export default {
  slideSchema,
  createSlideSchema,
  updateSlideSchema,
  reorderSlidesSchema,
  generateImagesSchema,
  tweakImageSchema
};
