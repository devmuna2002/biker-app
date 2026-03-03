const db = require('../config/db');
const { dispatchAI } = require('./gemini.service');

/**
 * Scoring Formula:
 * Score = (0.4 * distanceScore) + (0.25 * workloadScore) + (0.2 * reliabilityScore) + (0.15 * capacityScore) - trafficPenalty
 */
class DispatchService {
    static async getAvailableRiders() {
        const query = 'SELECT * FROM riders WHERE availability_status = TRUE';
        const { rows } = await db.query(query);
        return rows;
    }

    static calculateDistance(lat1, lon1, lat2, lon2) {
        // Simple Haversine or Euclidean for demo; in production use Google Maps distance matrix
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    static async runDispatchEngine(orderId) {
        try {
            // 1. Fetch Order
            const orderQuery = 'SELECT * FROM orders WHERE id = $1';
            const { rows: orderRows } = await db.query(orderQuery, [orderId]);
            if (orderRows.length === 0) throw new Error('Order not found');
            const order = orderRows[0];

            // 2. Fetch Available Riders
            const riders = await this.getAvailableRiders();
            if (riders.length === 0) return { success: false, message: 'No riders available' };

            // 3. Pre-rank using Deterministic scoring
            const candidates = riders.map(rider => {
                const distance = this.calculateDistance(order.pickup_lat, order.pickup_lng, rider.current_lat, rider.current_lng);

                // distanceScore: closer is better (inverse)
                const distanceScore = Math.max(0, 1 - (distance / 10)); // normalized to 10km max

                // workloadScore: fewer orders is better
                const workloadScore = Math.max(0, 1 - (rider.active_orders / 5)); // normalized to 5 max

                // reliabilityScore: based on rating
                const reliabilityScore = rider.rating / 5;

                // capacityScore: normalized
                const capacityScore = Math.min(1, rider.capacity / 3);

                // trafficPenalty: simplified random factor for mock
                const trafficPenalty = Math.random() * 0.1;

                const finalScore = (0.4 * distanceScore) + (0.25 * workloadScore) + (0.2 * reliabilityScore) + (0.15 * capacityScore) - trafficPenalty;

                return { ...rider, score: finalScore, distance };
            }).sort((a, b) => b.score - a.score);

            // 4. Gemini AI Final Ranking (Top 3 candidates)
            const aiData = {
                order: order,
                riders: candidates.slice(0, 3)
            };

            const aiResult = await dispatchAI(aiData);
            const selectedRiderId = aiResult.selected_rider;

            // 5. Update Database
            const assignQuery = 'UPDATE orders SET assigned_rider_id = $1, status = $2 WHERE id = $3';
            await db.query(assignQuery, [selectedRiderId, 'assigned', orderId]);

            const updateRiderQuery = 'UPDATE riders SET active_orders = active_orders + 1 WHERE id = $1';
            await db.query(updateRiderQuery, [selectedRiderId]);

            // 6. Log Recommendation
            const logQuery = `
                INSERT INTO ai_recommendations (order_id, ranked_riders, selected_rider, confidence_score, time_saved_minutes)
                VALUES ($1, $2, $3, $4, $5)
            `;
            await db.query(logQuery, [
                orderId,
                JSON.stringify(aiResult.ranked_riders),
                selectedRiderId,
                aiResult.confidence_score,
                aiResult.time_saved_minutes
            ]);

            return { success: true, riderId: selectedRiderId, aiResult };
        } catch (error) {
            console.error('Dispatch Engine Error:', error);
            throw error;
        }
    }
}

module.exports = DispatchService;
