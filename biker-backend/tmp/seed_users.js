/**
 * Seed script — creates test accounts in the live DB.
 * Run: node tmp/seed_users.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const http = require('http');

function post(path, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const req = http.request({
            hostname: 'localhost', port: 3003, path, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
        }, res => {
            let raw = '';
            res.on('data', c => raw += c);
            res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(raw); } });
        });
        req.on('error', reject);
        req.write(data); req.end();
    });
}

const USERS = [
    // Bikers
    { name: 'Test Biker 1', email: 'driver.1@biker.local', password: 'password123', role: 'driver', vehicleType: 'bike', vehicleDetails: 'Honda CB500' },
    { name: 'Test Biker 2', email: 'driver.2@biker.local', password: 'password123', role: 'driver', vehicleType: 'courier', vehicleDetails: 'Delivery Scooter' },
    { name: 'Test Customer', email: 'user.1@biker.local', password: 'password123', role: 'customer' },
    { name: 'Admin User', email: 'admin.1@biker.local', password: 'password123', role: 'admin' },
];

async function seed() {
    console.log('Seeding users...\n');
    for (const u of USERS) {
        const res = await post('/api/auth/register', u).catch(e => ({ success: false, message: e.message }));
        if (res.success) {
            console.log(`✅  ${u.role.padEnd(8)} | ${u.email}`);
        } else if (res.message?.includes('already registered') || res.message?.includes('already exists')) {
            console.log(`⏭  ${u.role.padEnd(8)} | ${u.email}  (already exists)`);
        } else {
            console.log(`❌  ${u.role.padEnd(8)} | ${u.email}  ERROR: ${res.message || JSON.stringify(res)}`);
        }
    }
    console.log('\nAll done! You can now log in with these credentials:\n');
    USERS.forEach(u => console.log(`  ${u.role.padEnd(8)}  email: ${u.email}  password: ${u.password}`));
}

seed().catch(console.error);
