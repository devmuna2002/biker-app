const db = require('../config/db');

exports.getKPIs = async (req, res) => {
    try {
        const statsQuery = `
            SELECT 
                COUNT(*) as total_deliveries,
                AVG(actual_eta) as avg_delivery_time,
                SUM(CASE WHEN delay_minutes = 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as on_time_percentage
            FROM deliveries_log
        `;
        const { rows: stats } = await db.query(statsQuery);

        const riderQuery = `
            SELECT 
                COUNT(*) as total_riders,
                AVG(active_orders) as avg_workload,
                AVG(rating) as avg_rating
            FROM riders
        `;
        const { rows: riderStats } = await db.query(riderQuery);

        res.json({
            performance: stats[0],
            riders: riderStats[0],
            timestamp: new Date()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getAILogs = async (req, res) => {
    try {
        const query = 'SELECT * FROM ai_recommendations ORDER BY created_at DESC LIMIT 50';
        const { rows } = await db.query(query);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
