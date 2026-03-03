const db = require('../config/db');

exports.updateLocation = async (req, res) => {
    try {
        const { rider_id, lat, lng } = req.body;
        const query = `
            UPDATE riders 
            SET current_lat = $1, current_lng = $2, last_updated = CURRENT_TIMESTAMP
            WHERE id = $3
            RETURNING *
        `;
        const { rows } = await db.query(query, [lat, lng, rider_id]);

        if (rows.length === 0) return res.status(404).json({ message: 'Rider not found' });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getRiders = async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM riders');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
