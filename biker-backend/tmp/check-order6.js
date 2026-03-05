const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function checkSessions() {
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

        const res = await client.query(`
            SELECT * FROM tracking_sessions WHERE "orderId" = 6
        `);

        if (res.rows.length > 0) {
            console.log(`Order 6 has ${res.rows.length} sessions in DB:`);
            console.log(JSON.stringify(res.rows, null, 2));
        } else {
            console.log('Order 6 has NO tracking sessions in DB.');
        }

    } catch (err) {
        console.error('DB Error:', err.message);
    } finally {
        await client.end();
    }
}

checkSessions();
