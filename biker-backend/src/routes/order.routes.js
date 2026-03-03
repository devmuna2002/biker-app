const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');

router.post('/', orderController.createOrder);
router.get('/:id', orderController.getOrder);
router.post('/dispatch/:orderId', orderController.triggerDispatch);

module.exports = router;
