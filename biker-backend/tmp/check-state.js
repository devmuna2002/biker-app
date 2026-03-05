const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function checkState() {
    const client = new Client({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: process.env.DB_SSL === 'true' || process.env.DB_SSL === undefined ? { rejectUnauthorized: false } : false,
    });

    try {
        await client.connect();

        // 1. Bikers
        const bRes = await client.query(`
          SELECT b.id, b."isOnline", b."isAvailable", b."updatedAt", b."verificationStatus",
                 b."subscriptionStatus", b."trialExpiryDate",
                 u.name, u.email, u.role
          FROM bikers b
          LEFT JOIN users u ON b."userId" = u.id
          ORDER BY b.id
        `);

        console.log('--- Bikers Status ---');
        bRes.rows.forEach(r => {
            console.log(`[Biker ${r.id}] ${r.name || 'N/A'} (Online: ${r.isOnline}, Avail: ${r.isAvailable})`);
        });

        // 2. Active Orders
        const oRes = await client.query(`
            SELECT id, status, "bikerId", "userId", "pickupAddress", "createdAt"
            FROM orders
            WHERE status != 'completed' AND status != 'cancelled'
            ORDER BY "createdAt" DESC
            LIMIT 10
        `);

        console.log('\n--- Active Orders ---');
        oRes.rows.forEach(r => {
            console.log(`[Order ${r.id}] Status: ${r.status}, Biker: ${r.bikerId || 'None'}, User: ${r.userId}, Created: ${r.createdAt}`);
        });

        // 3. Tracking Sessions Unique check
        const tRes = await client.query(`
            SELECT "orderId", count(*) 
            FROM tracking_sessions
            GROUP BY "orderId"
            HAVING count(*) > 1
        `);
        if (tRes.rows.length > 0) {
            console.log('\n--- Duplicate Tracking Sessions ---');
            tRes.rows.forEach(r => {
                console.log(`Order ${r.orderId} has ${r.count} sessions!`);
            });
        }

    } catch (err) {
        console.error('DB Error:', err.message);
    } finally {
        await client.end();
    }
}

checkState();
