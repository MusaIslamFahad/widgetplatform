const { z } = require('zod');

const WIDGET_TYPES = ['signup_form', 'cta', 'popover'];

const fieldSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_]+$/, 'field name must be alphanumeric/underscore'),
  label: z.string().min(1).max(200),
  type: z.enum(['text', 'email', 'textarea', 'checkbox']).default('text'),
  required: z.boolean().default(false),
});

const displayOptionsSchema = z
  .object({
    position: z.enum(['inline', 'bottom-right', 'bottom-left', 'center-modal']).optional(),
    delaySeconds: z.number().int().min(0).max(3600).optional(),
    theme: z.enum(['light', 'dark']).optional(),
  })
  .partial()
  .default({});

const createWidgetSchema = z.object({
  type: z.enum(WIDGET_TYPES),
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  fields: z.array(fieldSchema).min(1).max(20),
  buttonText: z.string().min(1).max(100).default('Submit'),
  displayOptions: displayOptionsSchema,
});

// Same shape, but every key optional (PATCH-style update via PUT).
const updateWidgetSchema = createWidgetSchema.partial();

module.exports = { WIDGET_TYPES, createWidgetSchema, updateWidgetSchema };
