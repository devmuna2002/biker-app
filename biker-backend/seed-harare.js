const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
});

async function seed() {
    try {
        await client.connect();
        console.log('Connected for Seeding');

        // 1. Seed Harare GeoZone
        const zoneId = uuidv4();
        await client.query(`
      INSERT INTO geo_zones (id, code, name, "minLat", "maxLat", "minLng", "maxLng", "enabledServices", "isActive", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
    `, [
            zoneId, 'HRE_CORE', 'Harare Metropolitan',
            -18.1500, -17.7000, 30.8500, 31.1500,
            ['bike', 'courier', 'local_services'], true
        ]);
        console.log('Seeded Harare Metropolitan Zone');

        // 2. Seed Delivery Services
        const services = [
            { type: 'bike', base: 100, perKm: 50 },
            { type: 'courier', base: 250, perKm: 80 },
            { type: 'local_services', base: 500, perKm: 120 }
        ];

        for (const s of services) {
            await client.query(`
        INSERT INTO services (id, type, "baseFareCents", "perKmCents", "isActive", "currency", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      `, [uuidv4(), s.type, s.base, s.perKm, true, 'USD']);
        }
        console.log('Seeded Delivery Services (Bike, Courier, Local Services)');

        console.log('RENEWAL COMPLETE: Database is clean and ready with Harare zones & services.');
    } catch (err) {
        console.error('Seed Error:', err);
    } finally {
        await client.end();
    }
}

seed();
