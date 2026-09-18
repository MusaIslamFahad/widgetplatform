// Wrap an async controller so a rejected promise reaches errorHandler.js
// instead of crashing the process. Used on every route: `asyncHandler(fn)`.
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
