require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function deleteAllProducts() {
    const client = await pool.connect();
    
    try {
        console.log('🔍 Verificando productos actuales...\n');
        
        // Ver productos actuales
        const currentProducts = await client.query('SELECT id, name, price, stock FROM products ORDER BY id');
        console.log('📦 Productos actuales en la base de datos:');
        console.table(currentProducts.rows);
        
        console.log(`\n⚠️  ADVERTENCIA: Se eliminarán TODOS los ${currentProducts.rows.length} productos.`);
        console.log('⚠️  Esta acción eliminará en cascada:');
        console.log('   - Ofertas relacionadas');
        console.log('   - Items de carritos');
        console.log('   - Referencias en órdenes');
        console.log('   - Cualquier otra relación con productos\n');
        
        console.log('🚀 Ejecutando eliminación en cascada...\n');
        
        await client.query('BEGIN');
        
        // Primero, eliminar ofertas relacionadas
        const deleteOfertas = await client.query('DELETE FROM ofertas WHERE product_id IS NOT NULL RETURNING id');
        console.log(`🗑️  Ofertas eliminadas: ${deleteOfertas.rowCount}`);
        
        // Eliminar ofertas generales relacionadas
        const deleteOfertasGen = await client.query('DELETE FROM ofertas_generales RETURNING id');
        console.log(`🗑️  Ofertas generales eliminadas: ${deleteOfertasGen.rowCount}`);
        
        // Verificar si existe la tabla cart_items antes de intentar eliminar
        const tableExists = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'cart_items'
            );
        `);
        
        if (tableExists.rows[0].exists) {
            const deleteCartItems = await client.query('DELETE FROM cart_items WHERE product_id IS NOT NULL RETURNING id');
            console.log(`🗑️  Items de carrito eliminados: ${deleteCartItems.rowCount}`);
        } else {
            console.log('ℹ️  Tabla cart_items no existe, saltando...');
        }
        
        // Eliminar TODOS los productos
        const deleteResult = await client.query('DELETE FROM products RETURNING id, name');
        
        console.log(`\n✅ Productos eliminados: ${deleteResult.rowCount}`);
        if (deleteResult.rowCount > 0) {
            console.log('\n🗑️  Listado de productos eliminados:');
            console.table(deleteResult.rows);
        }
        
        // Reiniciar el contador de IDs (opcional)
        await client.query('ALTER SEQUENCE products_id_seq RESTART WITH 1');
        console.log('🔄 Contador de IDs reiniciado a 1');
        
        // Verificar que no queden productos
        const remainingProducts = await client.query('SELECT COUNT(*) as total FROM products');
        console.log(`\n📦 Productos restantes: ${remainingProducts.rows[0].total}`);
        
        await client.query('COMMIT');
        console.log('\n✅ ¡Eliminación completada exitosamente!');
        console.log('💡 La base de datos está limpia y lista para nuevos productos.\n');
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\n❌ Error al eliminar productos:', err.message);
        console.error('📋 Detalles:', err);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

// Ejecutar la función
deleteAllProducts()
    .then(() => {
        console.log('🎉 Proceso finalizado correctamente');
        process.exit(0);
    })
    .catch(err => {
        console.error('💥 Error fatal:', err);
        process.exit(1);
    });
