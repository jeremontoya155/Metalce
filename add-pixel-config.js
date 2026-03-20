// Script para agregar configuración de Pixel ID a la base de datos
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false
});

async function addPixelConfig() {
    try {
        console.log('🔄 Agregando configuración de Pixel ID...');
        
        await pool.query(`
            INSERT INTO configuracion (clave, valor, updated_at)
            VALUES ('pixel_id', '', CURRENT_TIMESTAMP)
            ON CONFLICT (clave) DO NOTHING
        `);
        
        console.log('✅ Configuración de Pixel ID agregada exitosamente!');
        console.log('💡 Ahora puedes configurar tu Pixel ID desde /admin/cotizacion');
        
        await pool.end();
        process.exit(0);
    } catch (err) {
        console.error('❌ Error al agregar configuración:', err.message || err);
        console.error('Detalles completos:', err);
        await pool.end();
        process.exit(1);
    }
}

addPixelConfig();
