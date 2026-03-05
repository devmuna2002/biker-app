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
    const res = await client.query('UPDATE bikers SET "isOnline" = true, "isAvailable" = true;');
    console.log(`Updated ${res.rowCount} bikers to online/available`);

    // Also update a sample biker's location near Harare (from seed-harare.js context)
    // or just check where they are
    const list = await client.query('SELECT b.id, b."isOnline", b."isAvailable", ST_AsText(b."lastKnownLocation") as loc FROM bikers b;');
    console.table(list.rows);

    await client.end();
}
run().catch(err => { console.error(err); process.exit(1); });
