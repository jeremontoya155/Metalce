require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function updateImages() {
    const client = await pool.connect();
    
    try {
        console.log('🖼️  Metal-Ce S.R.L - Actualización de Imágenes');
        console.log('==============================================\n');
        
        await client.query('BEGIN');
        
        // Actualizar imagen principal del hero (imagen2)
        const heroImage = 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=1920&h=600&fit=crop';
        
        await client.query(
            `UPDATE imagenes SET imagen2 = $1 WHERE id = 1`,
            [heroImage]
        );
        console.log('✅ Imagen principal actualizada (Hero Banner)');
        console.log(`   URL: ${heroImage}\n`);
        
        // Actualizar carrusel con imágenes de Metal-Ce
        const carouselUpdates = [
            {
                text: '🔧 Conectores y Terminales Eléctricos - Stock Permanente',
                img: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=1920&h=600&fit=crop',
                imagenMobile: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=800&h=600&fit=crop',
                color1: '#8B1538',
                color2: '#A91D47'
            },
            {
                text: '⚡ Materiales Eléctricos de Primera Calidad - Asesoramiento Técnico',
                img: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=1920&h=600&fit=crop',
                imagenMobile: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&h=600&fit=crop',
                color1: '#6B0F2A',
                color2: '#8B1538'
            },
            {
                text: '🏗️ Flejes, Morsas y Accesorios - Entrega Inmediata',
                img: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=1920&h=600&fit=crop',
                imagenMobile: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=800&h=600&fit=crop',
                color1: '#8B1538',
                color2: '#A91D47'
            }
        ];
        
        // Eliminar banners antiguos
        await client.query('DELETE FROM carousel');
        console.log('🗑️  Banners antiguos eliminados\n');
        
        // Insertar nuevos banners
        for (const banner of carouselUpdates) {
            await client.query(
                `INSERT INTO carousel (text, img, imagenMobile, color1, color2) 
                 VALUES ($1, $2, $3, $4, $5)`,
                [banner.text, banner.img, banner.imagenMobile, banner.color1, banner.color2]
            );
            console.log(`✅ Banner agregado: ${banner.text}`);
        }
        
        await client.query('COMMIT');
        
        console.log('\n==============================================');
        console.log('🎉 Imágenes actualizadas exitosamente!\n');
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\n❌ Error al actualizar imágenes:', err.message);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

updateImages()
    .then(() => {
        console.log('✅ Proceso completado correctamente');
        process.exit(0);
    })
    .catch(err => {
        console.error('💥 Error fatal:', err);
        process.exit(1);
    });
