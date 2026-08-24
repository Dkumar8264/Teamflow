const AppError = require('../utils/AppError');

const notFound = (req, res, next) => {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404));
};

const normalizeError = (error) => {
  if (error instanceof AppError) {
    return error;
  }

  if (error.name === 'ValidationError') {
    const details = Object.values(error.errors).map((item) => item.message);
    return new AppError('Validation failed', 400, details);
  }

  if (error.name === 'CastError') {
    return new AppError('Invalid resource id', 400);
  }

  if (error.type === 'entity.parse.failed') {
    return new AppError('Invalid JSON request body', 400);
  }

  if (error.code === 11000) {
    return new AppError('Duplicate field value entered', 409);
  }

  return new AppError('Server error', 500);
};

const errorHandler = (error, req, res, next) => {
  const normalizedError = normalizeError(error);
  const statusCode = normalizedError.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  const log = {
    method: req.method,
    path: req.originalUrl,
    statusCode,
    message: error.message
  };

  if (statusCode >= 500) {
    console.error('[error]', { ...log, stack: error.stack });
  } else {
    console.warn('[warn]', log);
  }

  res.status(statusCode).json({
    success: false,
    message: normalizedError.message,
    details: normalizedError.details,
    code: normalizedError.errorCode,
    stack: isProduction ? undefined : error.stack
  });
};

module.exports = {
  notFound,
  errorHandler
};
