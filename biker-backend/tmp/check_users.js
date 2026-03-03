require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Client } = require('pg');

async function listUsers() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    });

    try {
        await client.connect();
        const res = await client.query('SELECT id, name, email, role, "createdAt" FROM users ORDER BY "createdAt" DESC LIMIT 10');
        console.log('--- Last 10 registered users ---');
        console.table(res.rows);
    } catch (err) {
        console.error('Error fetching users:', err);
    } finally {
        await client.end();
    }
}

listUsers();
