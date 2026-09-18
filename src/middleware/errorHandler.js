const { ZodError } = require('zod');
const AppError = require('../utils/AppError');

/**
 * Single place where any thrown error becomes an HTTP response. Route
 * handlers just `throw` (or call `next(err)`) and never construct error
 * JSON themselves — that's what keeps every error response the same shape:
 *   { "error": { "code": "...", "message": "...", "details"?: [...] } }
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'validation_failed',
        message: 'Request payload failed validation',
        details: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
      },
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
  }

  // Body too large (express.json's built-in limit) surfaces as a
  // PayloadTooLargeError from body-parser — map it to a clean 413.
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: { code: 'payload_too_large', message: 'Request body exceeds the allowed size.' },
    });
  }

  // Malformed JSON body also comes through body-parser as a SyntaxError.
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      error: { code: 'malformed_json', message: 'Request body is not valid JSON.' },
    });
  }

  // Genuinely unexpected — log the full error server-side, but never leak
  // internals to the client.
  // eslint-disable-next-line no-console
  console.error('[unhandled error]', err);
  return res.status(500).json({
    error: { code: 'internal_error', message: 'Something went wrong on our end.' },
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'not_found', message: `No route for ${req.method} ${req.path}` } });
}

module.exports = { errorHandler, notFoundHandler };
