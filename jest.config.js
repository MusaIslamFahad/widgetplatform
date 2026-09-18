module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true,
  // Jobs in jobQueue.test.js use real timers with a short wait — keep a
  // generous global timeout so slower CI machines don't flake.
  testTimeout: 15000,
};
