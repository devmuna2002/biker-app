const db = require('../config/db');
const DispatchService = require('../services/dispatch.service');

exports.createOrder = async (req, res) => {
    try {
        const { pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, item_description, preferred_delivery_time, delivery_type } = req.body;

        const query = `
            INSERT INTO orders (pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, item_description, preferred_delivery_time, delivery_type)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;
        const values = [pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, item_description, preferred_delivery_time, delivery_type];

        const { rows } = await db.query(query, values);
        const order = rows[0];

        // Trigger dispatch asynchronously
        DispatchService.runDispatchEngine(order.id).catch(err => console.error('Delayed dispatch err:', err));

        res.status(201).json(order);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const query = 'SELECT * FROM orders WHERE id = $1';
        const { rows } = await db.query(query, [id]);

        if (rows.length === 0) return res.status(404).json({ message: 'Order not found' });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.triggerDispatch = async (req, res) => {
    try {
        const { orderId } = req.params;
        const result = await DispatchService.runDispatchEngine(orderId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
