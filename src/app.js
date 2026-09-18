const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');

const env = require('./config/env');
const { publicCors } = require('./middleware/cors');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const publicController = require('./controllers/public.controller');

const authRoutes = require('./routes/auth.routes');
const widgetsRoutes = require('./routes/widgets.routes');
const publicRoutes = require('./routes/public.routes');
const dashboardRoutes = require('./routes/dashboard.routes');

// Registers the background-job handlers as a side effect of being
// required. Must happen once, at startup, before any submission can enqueue
// a job.
require('./services/jobs.setup');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
  }

  // 100kb is generous for a lead-capture form and small enough that a
  // clearly-oversized payload gets an automatic, clean 413 from
  // body-parser before it ever reaches a handler.
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  // The embeddable script itself. Not under /api — it's meant to be
  // referenced directly from a <script src="..."> tag, the same way a CDN
  // asset would be.
  app.get(`/widget.${env.WIDGET_BUNDLE_VERSION}.js`, publicCors, publicController.serveBundle);

  app.use('/api/auth', authRoutes);
  app.use('/api/widgets', widgetsRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
