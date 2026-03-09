const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function testConnection() {
    try {
        const res = await pool.query('SELECT NOW()');
        console.log('✅ Conexión exitosa:', res.rows[0]);
        process.exit(0);
    } catch (err) {
        console.error('❌ Error de conexión:', err.message);
        process.exit(1);
    }
}

testConnection();
