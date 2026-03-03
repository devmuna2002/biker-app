const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');

router.get('/kpis', analyticsController.getKPIs);
router.get('/ai-log', analyticsController.getAILogs);

module.exports = router;
