const { Client } = require('pg');
const client = new Client({
    host: 'aws-1-eu-north-1.pooler.supabase.com',
    port: 6543,
    user: 'postgres.zpaegcvszjfuccfuxuty',
    password: 'SMuna33002002',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
});
async function run() {
    await client.connect();
    const res = await client.query('SELECT b.id, b."isOnline", b."isAvailable", b."vehicleType" FROM bikers b WHERE id=1;');
    console.table(res.rows);
    await client.end();
}
run().catch(console.error);
