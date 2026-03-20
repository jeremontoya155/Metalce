require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function fixCarritos() {
    const client = await pool.connect();
    
    try {
        console.log('🔧 Reparando tabla carritos...\n');
        
        await client.query('BEGIN');
        
        // Eliminar todos los carritos existentes
        const deleteResult = await client.query('DELETE FROM carritos RETURNING id');
        console.log(`🗑️  Carritos eliminados: ${deleteResult.rowCount}`);
        
        // Reiniciar la secuencia de IDs
        await client.query('ALTER SEQUENCE carritos_id_seq RESTART WITH 1');
        console.log('🔄 Secuencia de IDs reiniciada a 1');
        
        // Verificar
        const count = await client.query('SELECT COUNT(*) as total FROM carritos');
        console.log(`📊 Carritos restantes: ${count.rows[0].total}`);
        
        await client.query('COMMIT');
        console.log('\n✅ Tabla carritos reparada exitosamente!\n');
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\n❌ Error:', err.message);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

fixCarritos()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('💥 Error fatal:', err);
        process.exit(1);
    });
