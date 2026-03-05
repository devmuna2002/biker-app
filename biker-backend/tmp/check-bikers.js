const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkBikers() {
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
        const res = await client.query(`
      SELECT b.id, b."isOnline", b."isAvailable", b."updatedAt", b."verificationStatus",
             b."subscriptionStatus", b."trialExpiryDate",
             u.name, u.email, u.role
      FROM bikers b
      LEFT JOIN users u ON b."userId" = u.id
      ORDER BY b.id
    `);

        console.log('--- All Bikers Status ---');
        res.rows.forEach(r => {
            console.log(`[${r.id}] ${r.name || 'N/A'} (${r.email})`);
            console.log(`    Online: ${r.isOnline} | Available: ${r.isAvailable}`);
            console.log(`    Verification: ${r.verificationStatus} | Sub: ${r.subscriptionStatus}`);
            console.log(`    Trial Expiry: ${r.trialExpiryDate}`);
            console.log(`    Last Updated: ${r.updatedAt}`);
            console.log('');
        });

        // Count how many are online
        const onlineCount = res.rows.filter(r => r.isOnline).length;
        console.log(`Total bikers: ${res.rows.length}, Online: ${onlineCount}`);
    } catch (err) {
        console.error('DB Error:', err.message);
    } finally {
        await client.end();
    }
}

checkBikers();
