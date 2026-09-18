const express = require('express');
const { publicCors } = require('../middleware/cors');
const { perIpLimiter, perWidgetLimiter } = require('../middleware/rateLimiters');
const asyncHandler = require('../middleware/asyncHandler');
const publicController = require('../controllers/public.controller');

const router = express.Router();

// publicCors also transparently answers the OPTIONS preflight the browser
// sends before the cross-origin POST below (the `cors` package intercepts
// and short-circuits OPTIONS requests itself).
router.use(publicCors);

router.get('/widgets/:id/config', asyncHandler(publicController.getConfig));

router.post('/submissions', perIpLimiter, perWidgetLimiter, asyncHandler(publicController.submit));

module.exports = router;
