// ============================================================================
// API RESPONSE HELPERS
// Consistent response format across all endpoints
// ============================================================================

/**
 * Success response
 * @param {Response} res - Express response object
 * @param {string} message - Success message
 * @param {object} data - Response data
 * @param {number} statusCode - HTTP status code (default 200)
 */
const success = (res, message, data = null, statusCode = 200) => {
  const response = {
    success: true,
    message,
  };

  if (data !== null) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
};

/**
 * Error response
 * @param {Response} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default 400)
 * @param {object} errors - Validation errors or details
 */
const error = (res, message, statusCode = 400, errors = null) => {
  const response = {
    success: false,
    message,
  };

  if (errors !== null) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};

/**
 * Paginated response
 */
const paginated = (res, message, data, pagination) => {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.limit),
    },
  });
};

/**
 * Server error (500)
 */
const serverError = (res, err) => {
  console.error('[SERVER ERROR]', err);
  return res.status(500).json({
    success: false,
    message: 'Internal server error. Please try again later.',
  });
};

module.exports = {
  success,
  error,
  paginated,
  serverError,
};
