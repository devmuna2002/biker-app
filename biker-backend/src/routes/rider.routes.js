const express = require('express');
const router = express.Router();
const riderController = require('../controllers/rider.controller');

router.post('/location', riderController.updateLocation);
router.get('/', riderController.getRiders);

module.exports = router;
