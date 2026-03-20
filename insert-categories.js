require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function insertCategories() {
    const client = await pool.connect();
    
    try {
        console.log('🔍 Verificando categorías existentes...\n');
        
        // Ver categorías actuales
        const currentCategories = await client.query('SELECT * FROM categorias ORDER BY orden, nombre');
        console.log('📦 Categorías actuales:');
        console.table(currentCategories.rows);
        
        await client.query('BEGIN');
        
        // Definir las categorías que se ven en tu imagen
        const categories = [
            {
                nombre: 'Smartphones',
                descripcion: 'Teléfonos celulares y dispositivos móviles',
                icono: '📱',
                color: '#0052A3',
                orden: 1
            },
            {
                nombre: 'Accesorios',
                descripcion: 'Cargadores, fundas, protectores y más',
                icono: '🔌',
                color: '#00B4D8',
                orden: 2
            },
            {
                nombre: 'Audio',
                descripcion: 'Auriculares, parlantes y dispositivos de audio',
                icono: '🎧',
                color: '#0096c7',
                orden: 3
            },
            {
                nombre: 'Tablets',
                descripcion: 'Tablets y dispositivos de lectura',
                icono: '📱',
                color: '#003d7a',
                orden: 4
            },
            {
                nombre: 'Computadoras',
                descripcion: 'Laptops, PCs y componentes',
                icono: '💻',
                color: '#48cae4',
                orden: 5
            }
        ];
        
        console.log('\n🚀 Insertando categorías...\n');
        
        for (const cat of categories) {
            // Verificar si ya existe
            const exists = await client.query(
                'SELECT id FROM categorias WHERE nombre = $1',
                [cat.nombre]
            );
            
            if (exists.rows.length === 0) {
                // Insertar nueva categoría
                const result = await client.query(
                    `INSERT INTO categorias (nombre, descripcion, icono, color, orden, activo) 
                     VALUES ($1, $2, $3, $4, $5, 1) 
                     RETURNING *`,
                    [cat.nombre, cat.descripcion, cat.icono, cat.color, cat.orden]
                );
                console.log(`✅ Categoría "${cat.nombre}" creada:`, result.rows[0]);
            } else {
                // Actualizar categoría existente para asegurar que esté activa
                const result = await client.query(
                    `UPDATE categorias 
                     SET descripcion = $1, icono = $2, color = $3, orden = $4, activo = 1
                     WHERE nombre = $5
                     RETURNING *`,
                    [cat.descripcion, cat.icono, cat.color, cat.orden, cat.nombre]
                );
                console.log(`🔄 Categoría "${cat.nombre}" actualizada:`, result.rows[0]);
            }
        }
        
        // Mostrar categorías finales
        const finalCategories = await client.query('SELECT * FROM categorias ORDER BY orden, nombre');
        console.log('\n📦 Categorías finales:');
        console.table(finalCategories.rows);
        
        await client.query('COMMIT');
        console.log('\n✅ ¡Categorías configuradas exitosamente!');
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\n❌ Error al insertar categorías:', err.message);
        console.error('   Stack:', err.stack);
    } finally {
        client.release();
        await pool.end();
    }
}

insertCategories();
