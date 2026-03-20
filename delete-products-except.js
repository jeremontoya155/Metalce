require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function deleteProductsExcept() {
    const client = await pool.connect();
    
    try {
        console.log('🔍 Verificando productos actuales...\n');
        
        // Ver productos actuales
        const currentProducts = await client.query('SELECT id, name, price, stock FROM products ORDER BY id');
        console.log('📦 Productos actuales:');
        console.table(currentProducts.rows);
        
        console.log(`\n⚠️  Se eliminarán ${currentProducts.rows.length - 3} productos.`);
        console.log('✅ Se mantendrán SOLO estos 3 productos:');
        console.log('   1. Nuevo');
        console.log('   2. iPhone 14 Pro Max');
        console.log('   3. ejemplo accesorio\n');
        
        // Preguntar confirmación (en Node.js necesitarías readline, pero aquí lo hacemos directo)
        console.log('🚀 Ejecutando eliminación...\n');
        
        await client.query('BEGIN');
        
        // Eliminar todos excepto los 3 especificados
        const deleteResult = await client.query(`
            DELETE FROM products 
            WHERE name NOT IN (
                'Nuevo',
                'iPhone 14 Pro Max',
                'ejemplo accesorio'
            )
            RETURNING id, name
        `);
        
        console.log(`✅ Productos eliminados: ${deleteResult.rowCount}`);
        if (deleteResult.rowCount > 0) {
            console.log('\n🗑️  Productos eliminados:');
            console.table(deleteResult.rows);
        }
        
        // Verificar productos restantes
        const remainingProducts = await client.query('SELECT id, name, price, stock FROM products ORDER BY id');
        console.log('\n📦 Productos restantes:');
        console.table(remainingProducts.rows);
        
        await client.query('COMMIT');
        console.log('\n✅ ¡Eliminación completada exitosamente!');
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\n❌ Error al eliminar productos:', err.message);
        console.error('   Stack:', err.stack);
    } finally {
        client.release();
        await pool.end();
    }
}

deleteProductsExcept();
