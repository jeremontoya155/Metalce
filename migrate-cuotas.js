// Script para agregar columnas de exclusión de categorías y cuotas
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    try {
        console.log('🔄 Ejecutando migración...');
        
        // 1. Agregar categorias_excluidas a ofertas_generales
        await pool.query(`ALTER TABLE ofertas_generales ADD COLUMN IF NOT EXISTS categorias_excluidas TEXT DEFAULT ''`);
        console.log('✅ Columna categorias_excluidas agregada a ofertas_generales');
        
        // 2. Agregar cuotas_max a categorias
        await pool.query(`ALTER TABLE categorias ADD COLUMN IF NOT EXISTS cuotas_max INTEGER DEFAULT 0`);
        console.log('✅ Columna cuotas_max agregada a categorias');
        
        // 3. Agregar interes_cuotas a categorias
        await pool.query(`ALTER TABLE categorias ADD COLUMN IF NOT EXISTS interes_cuotas DECIMAL(5, 2) DEFAULT 0`);
        console.log('✅ Columna interes_cuotas agregada a categorias');
        
        console.log('\n🎉 Migración completada exitosamente');
    } catch (err) {
        console.error('❌ Error en migración:', err.message);
    } finally {
        await pool.end();
    }
}

migrate();
