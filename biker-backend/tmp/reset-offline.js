const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function resetOffline() {
    const client = new Client({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    });

    try {
        await client.connect();
        // Set ALL bikers to offline — they will go online when they next open the app
        const res = await client.query(`
      UPDATE bikers SET "isOnline" = false, "isAvailable" = false
      WHERE "isOnline" = true
      RETURNING id
    `);
        console.log(`Reset ${res.rowCount} biker(s) to offline.`);
    } catch (err) {
        console.error('DB Error:', err.message);
    } finally {
        await client.end();
    }
}

resetOffline();
