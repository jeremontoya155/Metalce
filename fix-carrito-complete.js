require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function fixCarritoItems() {
    const client = await pool.connect();
    
    try {
        console.log('🔧 Reparando tablas del carrito...\n');
        
        await client.query('BEGIN');
        
        // Eliminar todos los items del carrito
        const deleteItems = await client.query('DELETE FROM carrito_items RETURNING id');
        console.log(`🗑️  Items del carrito eliminados: ${deleteItems.rowCount}`);
        
        // Eliminar todos los carritos
        const deleteCarritos = await client.query('DELETE FROM carritos RETURNING id');
        console.log(`🗑️  Carritos eliminados: ${deleteCarritos.rowCount}`);
        
        // Reiniciar secuencias
        await client.query('ALTER SEQUENCE carrito_items_id_seq RESTART WITH 1');
        console.log('🔄 Secuencia carrito_items reiniciada a 1');
        
        await client.query('ALTER SEQUENCE carritos_id_seq RESTART WITH 1');
        console.log('🔄 Secuencia carritos reiniciada a 1');
        
        // Verificar
        const countItems = await client.query('SELECT COUNT(*) as total FROM carrito_items');
        const countCarritos = await client.query('SELECT COUNT(*) as total FROM carritos');
        
        console.log(`\n📊 Estado final:`);
        console.log(`   Items: ${countItems.rows[0].total}`);
        console.log(`   Carritos: ${countCarritos.rows[0].total}`);
        
        await client.query('COMMIT');
        console.log('\n✅ Tablas del carrito reparadas exitosamente!\n');
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\n❌ Error:', err.message);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

fixCarritoItems()
    .then(() => {
        console.log('✅ Proceso completado. Reinicia el servidor.\n');
        process.exit(0);
    })
    .catch(err => {
        console.error('💥 Error fatal:', err);
        process.exit(1);
    });
