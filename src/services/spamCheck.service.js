/**
 * Honeypot spam control. The widget renders a field called "website" that
 * is hidden from real users with CSS (display:none — see
 * src/widget-client/widget.v1.js) but still present in the DOM, so simple
 * bots that fill in every input on a form end up filling it. A human never
 * sees or fills it.
 *
 * A non-empty honeypot value is treated as spam. The caller decides how to
 * respond (public.controller.js returns a fake-success 2xx so the bot gets
 * no signal that it was caught — never tip off the scraper).
 */
function isHoneypotTriggered(honeypotValue) {
  return typeof honeypotValue === 'string' && honeypotValue.trim().length > 0;
}

module.exports = { isHoneypotTriggered };
