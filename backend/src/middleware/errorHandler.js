/**
 * Global error handling middleware
 */

export function errorHandler(err, req, res, next) {
  // Log error for debugging
  console.error('Error:', err);

  // Default error
  let status = err.status || 500;
  let message = err.message || 'Internal server error';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    status = 400;
    message = err.details?.[0]?.message || err.message;
  }

  if (err.message?.includes('not found')) {
    status = 404;
  }

  if (err.message?.includes('already exists')) {
    status = 409;
  }

  if (err.message?.includes('API key')) {
    status = 401;
  }

  // Send error response
  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default {
  errorHandler,
  asyncHandler
};
