require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('🔄 Iniciando migración de cotización del dólar para Metal-Ce...\n');

        // 1. Crear tabla configuracion
        console.log('1️⃣  Creando tabla configuracion...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS configuracion (
                id SERIAL PRIMARY KEY,
                clave VARCHAR(100) UNIQUE NOT NULL,
                valor TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('   ✅ Tabla configuracion creada\n');

        // 2. Insertar cotización por defecto
        console.log('2️⃣  Insertando cotización por defecto (1200)...');
        await client.query(`
            INSERT INTO configuracion (clave, valor) VALUES ('cotizacion_dolar', '1200')
            ON CONFLICT (clave) DO NOTHING;
        `);
        console.log('   ✅ Cotización insertada\n');

        // 3. Insertar configuración de visibilidad
        console.log('3️⃣  Insertando configuración de visibilidad de pesos...');
        await client.query(`
            INSERT INTO configuracion (clave, valor) VALUES ('mostrar_precio_pesos', 'true')
            ON CONFLICT (clave) DO NOTHING;
        `);
        console.log('   ✅ Configuración de visibilidad insertada\n');

        // 4. Agregar columna moneda a products (ARS por defecto para Metal-Ce)
        console.log('4️⃣  Agregando columna moneda a products (default ARS)...');
        await client.query(`
            ALTER TABLE products ADD COLUMN IF NOT EXISTS moneda VARCHAR(3) DEFAULT 'ARS';
        `);
        console.log('   ✅ Columna moneda agregada\n');

        console.log('🎉 ¡Migración completada exitosamente!');
        console.log('   Ahora podés reiniciar el servidor con: node server.js');
    } catch (err) {
        console.error('❌ Error en la migración:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
