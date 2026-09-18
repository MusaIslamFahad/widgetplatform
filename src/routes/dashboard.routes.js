const express = require('express');
const { adminCors } = require('../middleware/cors');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const dashboardController = require('../controllers/dashboard.controller');

const router = express.Router();

router.use(adminCors);
router.use(requireAuth);

router.get('/overview', asyncHandler(dashboardController.overview));
router.get('/widgets/:id/stats', asyncHandler(dashboardController.widgetStats));
router.get('/submissions', asyncHandler(dashboardController.submissions));

module.exports = router;
