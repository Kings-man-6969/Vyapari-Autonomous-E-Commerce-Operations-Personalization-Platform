function errorHandler(err, req, res, next) {
  const message = err.message || (err.errors && err.errors[0]?.message) || (err.code ? `Database connection error (${err.code})` : 'An unexpected error occurred.');

  console.error('[Unhandled Error]', {
    code: err.code,
    message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method
  });

  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
  const code = err.code || (statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR');

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details: err.details || (process.env.NODE_ENV === 'development' ? err.stack : undefined)
    }
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`
    }
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
