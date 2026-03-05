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
    console.log('Connecting to Supabase...');
    await client.connect();

    // 1. Extend trials for all bikers to 2030
    console.log('Extending biker trials/subscriptions...');
    const futureDate = '2030-01-01';
    await client.query(`
        UPDATE bikers 
        SET 
            "trialExpiryDate" = $1,
            "subscriptionExpiryDate" = $1,
            "subscriptionStatus" = 'active',
            "isOnline" = true,
            "isAvailable" = true,
            "verificationStatus" = 'approved'
    `, [futureDate]);

    // 2. Clear any active orders that might be blocking bikers
    console.log('Clearing old active orders...');
    await client.query(`
        UPDATE orders 
        SET status = 'cancelled' 
        WHERE status IN ('assigned', 'picked_up', 'in_transit')
    `);

    // 3. Ensure all users have some money in their wallet
    console.log('Funding test user wallets...');
    await client.query(`
        UPDATE users 
        SET "walletBalanceCents" = 50000 
        WHERE "walletBalanceCents" < 1000
    `);

    console.log('Ready! All bikers are now fully online, verified, and have trials until 2030.');

    // Summary
    const list = await client.query('SELECT b.id, b."isOnline", b."isAvailable", b."trialExpiryDate" FROM bikers b;');
    console.table(list.rows);

    await client.end();
}

run().catch(err => {
    console.error('FAILED TO FIX BIKERS:', err);
    process.exit(1);
});
