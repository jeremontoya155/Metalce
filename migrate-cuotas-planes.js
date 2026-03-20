// Migración: Agregar soporte para múltiples planes de cuotas por categoría
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    try {
        console.log('🔄 Agregando columna cuotas_planes...');
        
        await pool.query(`
            ALTER TABLE categorias ADD COLUMN IF NOT EXISTS cuotas_planes TEXT DEFAULT '[]'
        `);
        
        console.log('✅ Columna cuotas_planes agregada');

        // Migrar datos existentes
        const result = await pool.query(`
            UPDATE categorias 
            SET cuotas_planes = CONCAT('[{"cuotas":', cuotas_max, ',"interes":', interes_cuotas, '}]')
            WHERE cuotas_max > 0 AND (cuotas_planes IS NULL OR cuotas_planes = '[]')
            RETURNING id, nombre, cuotas_max, interes_cuotas, cuotas_planes
        `);

        if (result.rowCount > 0) {
            console.log(`✅ ${result.rowCount} categorías migradas:`);
            result.rows.forEach(r => {
                console.log(`   - ${r.nombre}: ${r.cuotas_planes}`);
            });
        } else {
            console.log('ℹ️  No había datos de cuotas existentes para migrar');
        }

        console.log('\n🎉 Migración completada exitosamente');
        console.log('Ahora podés configurar múltiples planes de cuotas por categoría');
        
    } catch (err) {
        console.error('❌ Error en migración:', err.message);
    } finally {
        await pool.end();
    }
}

migrate();
