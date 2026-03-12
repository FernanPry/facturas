const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function checkSchema() {
    try {
        console.log('--- 🔍 Diagnóstico de Base de Datos ---');
        
        // 1. Probar conexión
        const timeRes = await pool.query('SELECT NOW()');
        console.log('✅ Conexión establecida:', timeRes.rows[0].now);

        // 2. Verificar tabla users
        console.log('\n--- Estructura de la tabla "users" ---');
        const usersColumns = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        `);
        
        if (usersColumns.rows.length === 0) {
            console.log('❌ La tabla "users" NO existe.');
        } else {
            const columns = usersColumns.rows.map(r => r.column_name);
            console.log('Columnas encontradas:', columns.join(', '));
            
            const required = ['id', 'name', 'lastname', 'company', 'sector', 'phone', 'email', 'password_hash', 'r_eq'];
            const missing = required.filter(col => !columns.includes(col));
            
            if (missing.length > 0) {
                console.log('⚠️ Faltan columnas críticas:', missing.join(', '));
            } else {
                console.log('✅ Todas las columnas necesarias están presentes.');
            }
        }

        // 3. Verificar tabla invoices
        console.log('\n--- Estructura de la tabla "invoices" ---');
        const invColumns = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'invoices'
        `);
        
        if (invColumns.rows.length === 0) {
            console.log('❌ La tabla "invoices" NO existe.');
        } else {
            console.log('Columnas encontradas:', invColumns.rows.map(r => r.column_name).join(', '));
        }

        process.exit(0);
    } catch (err) {
        console.error('❌ Error durante el diagnóstico:', err.message);
        process.exit(1);
    }
}

checkSchema();
