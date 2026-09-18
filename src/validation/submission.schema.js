const { z } = require('zod');

// The honeypot field name is intentionally boring/plausible ("website") so
// bots that auto-fill every visible-looking field trip it, while real
// users never see it (it's hidden with CSS in the rendered widget — see
// src/widget-client/widget.v1.js). It is OPTIONAL and always a string;
// its mere presence-with-content is the spam signal, checked in
// services/spamCheck.service.js, not here.
const submissionSchema = z.object({
  widgetId: z.string().min(1, 'widgetId is required'),
  data: z
    .record(z.string().max(5000))
    .refine((obj) => Object.keys(obj).length <= 50, 'too many fields submitted'),
  website: z.string().max(5000).optional(), // honeypot
});

module.exports = { submissionSchema };
