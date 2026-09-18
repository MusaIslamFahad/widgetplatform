// A thrown AppError carries its own HTTP status, so any controller can just
// `throw new AppError(404, 'widget_not_found', 'Widget not found')` and the
// central error handler (middleware/errorHandler.js) turns it into the
// correctly-shaped JSON error response. Nothing here ever produces a 500 for
// input the caller controls — 500s are reserved for genuine bugs.
class AppError extends Error {
  constructor(statusCode, code, message, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

module.exports = AppError;
