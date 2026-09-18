const db = require('../config/db');

/**
 * A deliberately small in-process job queue. It exists to demonstrate the
 * *pattern* the shared requirements ask for — "slow/bulk work off the
 * request path, retries + failure alert" — without pulling in Redis/BullMQ
 * for a $0, docker-compose-only stack.
 *
 * Handlers are registered by job type; enqueue() returns immediately (the
 * HTTP response is never blocked on this), and processing happens on the
 * next tick with exponential backoff between retries. This module is the
 * ONLY place that knows jobs run in-process — swapping it for a real queue
 * (SQS, BullMQ+Redis) later means changing this file, not any call site.
 */

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 200;

const handlers = new Map();

function registerHandler(jobType, handlerFn) {
  handlers.set(jobType, handlerFn);
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function runWithRetries(jobType, payload) {
  const handler = handlers.get(jobType);
  if (!handler) {
    console.error(`[jobQueue] no handler registered for job type "${jobType}"`);
    return;
  }

  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await handler(payload);
      return; // success
    } catch (err) {
      lastError = err;
      console.warn(`[jobQueue] "${jobType}" attempt ${attempt}/${MAX_ATTEMPTS} failed: ${err.message}`);
      if (attempt < MAX_ATTEMPTS) {
        await delay(BASE_DELAY_MS * 2 ** (attempt - 1));
      }
    }
  }

  // Every attempt failed — this is the "failure alert". In production this
  // insert would be paired with a page/Slack notification; here it's a
  // queryable audit trail that proves the failure was handled, not ignored.
  console.error(`[jobQueue] "${jobType}" exhausted ${MAX_ATTEMPTS} attempts — logging to failed_jobs`);
  await db('failed_jobs').insert({
    job_type: jobType,
    payload: JSON.stringify(payload),
    error: lastError ? lastError.message : 'unknown error',
    attempts: MAX_ATTEMPTS,
  });
}

// Fire-and-forget: the caller (the request handler) does NOT await this.
// Errors inside runWithRetries are already fully handled above, so there is
// no unhandled rejection risk here.
function enqueue(jobType, payload) {
  setImmediate(() => {
    runWithRetries(jobType, payload).catch((err) => {
      console.error(`[jobQueue] unexpected error processing "${jobType}":`, err);
    });
  });
}

module.exports = { registerHandler, enqueue };
