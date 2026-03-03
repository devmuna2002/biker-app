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

        const res = await client.query(`
      SELECT n.nspname as schema, t.typname as type 
      FROM pg_type t 
      JOIN pg_namespace n ON n.oid = t.typnamespace 
      WHERE t.typtype = 'e';
    `);
        console.log('Available enums:', res.rows.map(r => r.type));

        for (let row of res.rows) {
            const typeName = row.type;
            // Rename 'cargo' to 'local_services' if it exists in the enum
            try {
                await client.query(`ALTER TYPE public.${typeName} RENAME VALUE 'cargo' TO 'local_services'`);
                console.log(`Successfully renamed 'cargo' in ${typeName}`);
            } catch (e) {
                // console.log(`Could not rename cargo in ${typeName}: ${e.message}`);
            }
        }

        console.log('Data migration complete');
    } catch (err) {
        console.error('Error fixing enums:', err);
    } finally {
        await client.end();
    }
}

fix();
