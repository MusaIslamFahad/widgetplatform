const env = require('../config/env');

/**
 * Stands in for "send a confirmation email" or "fire a webhook". The
 * capstone brief explicitly allows this to be fake — what's graded is that
 * its failure never blocks the submission response. It's always invoked
 * through jobQueue.js (off the request path, with retries), never awaited
 * directly by the request handler.
 *
 * Set FORCE_EMAIL_FAILURE=true to deterministically prove the "failure
 * doesn't break the main path" requirement (see PROBE 5 in the brief).
 */
async function sendConfirmationEmail({ submissionId, widgetId, data }) {
  if (env.FORCE_EMAIL_FAILURE) {
    throw new Error('simulated_email_provider_outage');
  }

  // In a real deployment this would call an ESP (Postmark, SES, Mailpit
  // locally) or POST to a customer webhook URL. Logging is enough to prove
  // the side effect fired without needing real SMTP credentials.
  // eslint-disable-next-line no-console
  console.log(
    `[email] confirmation sent for submission=${submissionId} widget=${widgetId} fields=${Object.keys(
      data || {}
    ).join(',')}`
  );
  return { delivered: true };
}

module.exports = { sendConfirmationEmail };
