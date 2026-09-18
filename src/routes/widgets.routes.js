const express = require('express');
const { adminCors } = require('../middleware/cors');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const widgetsController = require('../controllers/widgets.controller');

const router = express.Router();

router.use(adminCors);
router.use(requireAuth);

router.post('/', asyncHandler(widgetsController.create));
router.get('/', asyncHandler(widgetsController.list));
router.get('/:id', asyncHandler(widgetsController.getOne));
router.put('/:id', asyncHandler(widgetsController.update));
router.delete('/:id', asyncHandler(widgetsController.remove));
router.get('/:id/embed-snippet', asyncHandler(widgetsController.embedSnippet));

module.exports = router;
