require('dotenv').config();
const { Client } = require('pg');

async function fix() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    });

    try {
        await client.connect();
        console.log('Connected to database');

        await client.query("UPDATE orders SET \"serviceType\" = 'local_services' WHERE \"serviceType\" = 'cargo'");
        await client.query("UPDATE bikers SET \"vehicleType\" = 'local_services' WHERE \"vehicleType\" = 'cargo'");
        await client.query("UPDATE geo_zones SET \"enabledServices\" = array_replace(\"enabledServices\", 'cargo', 'local_services') WHERE 'cargo' = ANY(\"enabledServices\")");

        console.log('Data migration complete');
    } catch (err) {
        console.error('Error updating data:', err);
    } finally {
        await client.end();
    }
}

fix();
