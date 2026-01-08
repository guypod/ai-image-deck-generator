/**
 * Validation middleware for request body, params, and query
 */

export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const data = req[source];
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      return res.status(400).json({
        error: errorMessage,
        details: error.details
      });
    }

    // Replace request data with validated/sanitized data
    req[source] = value;
    next();
  };
}

export default { validate };
