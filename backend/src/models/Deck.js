import Joi from 'joi';

// Entity name pattern: alphanumeric + hyphens, no spaces
const entityNamePattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/;

// Entity schema
const entitySchema = Joi.object({
  name: Joi.string()
    .pattern(entityNamePattern)
    .min(1)
    .max(50)
    .required()
    .messages({
      'string.pattern.base': 'Entity name must contain only letters, numbers, and hyphens (no spaces)',
      'string.min': 'Entity name must be at least 1 character',
      'string.max': 'Entity name must not exceed 50 characters'
    }),
  images: Joi.array()
    .items(Joi.string())
    .min(1)
    .required()
});

// Deck schema
export const deckSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required(),
  name: Joi.string()
    .min(1)
    .max(200)
    .required()
    .messages({
      'string.min': 'Deck name must be at least 1 character',
      'string.max': 'Deck name must not exceed 200 characters'
    }),
  createdAt: Joi.date()
    .iso()
    .required(),
  updatedAt: Joi.date()
    .iso()
    .required(),
  visualStyle: Joi.string()
    .max(1000)
    .allow('')
    .default('')
    .messages({
      'string.max': 'Visual style must not exceed 1000 characters'
    }),
  entities: Joi.object()
    .pattern(
      entityNamePattern,
      entitySchema
    )
    .default({}),
  themeImages: Joi.array()
    .items(Joi.string())
    .max(10)
    .default([])
    .messages({
      'array.max': 'Maximum 10 theme images allowed per deck'
    }),
  isTest: Joi.boolean()
    .default(false),
  slides: Joi.array()
    .items(Joi.string())
    .default([])
});

// Validation for deck creation
export const createDeckSchema = Joi.object({
  name: Joi.string()
    .min(1)
    .max(200)
    .required()
    .messages({
      'string.min': 'Deck name must be at least 1 character',
      'string.max': 'Deck name must not exceed 200 characters',
      'any.required': 'Deck name is required'
    }),
  visualStyle: Joi.string()
    .max(1000)
    .allow('')
    .default('')
    .messages({
      'string.max': 'Visual style must not exceed 1000 characters'
    }),
  isTest: Joi.boolean()
    .default(false)
});

// Validation for deck update
export const updateDeckSchema = Joi.object({
  name: Joi.string()
    .min(1)
    .max(200)
    .messages({
      'string.min': 'Deck name must be at least 1 character',
      'string.max': 'Deck name must not exceed 200 characters'
    }),
  visualStyle: Joi.string()
    .max(1000)
    .allow('')
    .messages({
      'string.max': 'Visual style must not exceed 1000 characters'
    }),
  isTest: Joi.boolean()
}).min(1); // At least one field must be present

// Validation for adding entity
export const addEntitySchema = Joi.object({
  entityName: Joi.string()
    .pattern(entityNamePattern)
    .min(1)
    .max(50)
    .required()
    .messages({
      'string.pattern.base': 'Entity name must contain only letters, numbers, and hyphens (no spaces)',
      'string.min': 'Entity name must be at least 1 character',
      'string.max': 'Entity name must not exceed 50 characters',
      'any.required': 'Entity name is required'
    })
});

// Validation for entity name (used when removing)
export const entityNameSchema = Joi.string()
  .pattern(entityNamePattern)
  .min(1)
  .max(50)
  .required()
  .messages({
    'string.pattern.base': 'Entity name must contain only letters, numbers, and hyphens (no spaces)',
    'any.required': 'Entity name is required'
  });

// Validation for creating deck from text
export const createDeckFromTextSchema = Joi.object({
  name: Joi.string()
    .min(1)
    .max(200)
    .required()
    .messages({
      'string.min': 'Deck name must be at least 1 character',
      'string.max': 'Deck name must not exceed 200 characters',
      'any.required': 'Deck name is required'
    }),
  text: Joi.string()
    .min(1)
    .required()
    .messages({
      'string.min': 'Text content is required',
      'any.required': 'Text content is required'
    }),
  visualStyle: Joi.string()
    .max(1000)
    .allow('')
    .default('')
    .messages({
      'string.max': 'Visual style must not exceed 1000 characters'
    }),
  isTest: Joi.boolean()
    .default(false)
});

export default {
  deckSchema,
  createDeckSchema,
  updateDeckSchema,
  addEntitySchema,
  entityNameSchema,
  createDeckFromTextSchema
};
