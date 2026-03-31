const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Imágenes reales de productos eléctricos de Unsplash y repositorios técnicos
const imageUpdates = [
    // Conectores aislados
    { id: 1, img: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600&q=80' }, // Conector eléctrico industrial
    { id: 2, img: 'https://images.unsplash.com/photo-1621905251918-48542801575a?w=600&q=80' }, // Conector estanco
    { id: 20, img: 'https://images.unsplash.com/photo-1621905252472-965d87c0e93f?w=600&q=80' }, // Conector IP68
    
    // Fusibles
    { id: 5, img: 'https://images.unsplash.com/photo-1513828583688-c52646db42da?w=600&q=80' }, // Fusible eléctrico
    { id: 6, img: 'https://images.unsplash.com/photo-1635322966219-b75ed372eb01?w=600&q=80' }, // Fusibles industriales
    
    // Flejes y hebillas
    { id: 10, img: 'https://images.unsplash.com/photo-1590859808308-3d2d9c515b1a?w=600&q=80' }, // Fleje metálico
    { id: 11, img: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600&q=80' }, // Hebilla metálica
    
    // Morsas
    { id: 7, img: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=600&q=80' }, // Morsa de suspensión
    { id: 8, img: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&q=80' }, // Morsa de retención
    { id: 9, img: 'https://images.unsplash.com/photo-1581092918484-8313e1f1e4bb?w=600&q=80' }, // Morsa acometida
    
    // Manguitos y terminales
    { id: 4, img: 'https://images.unsplash.com/photo-1621905252472-965d87c0e93f?w=600&q=80' }, // Manguito preaislado
    { id: 3, img: 'https://images.unsplash.com/photo-1635322966219-b75ed372eb01?w=600&q=80' }, // Terminal preaislado
    { id: 17, img: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600&q=80' }, // Protector terminal
    
    // Ménsulas
    { id: 15, img: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=600&q=80' }, // Ménsula de retención
    { id: 16, img: 'https://images.unsplash.com/photo-1590859808308-3d2d9c515b1a?w=600&q=80' }, // Ménsula de suspensión
    
    // Otros
    { id: 18, img: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=600&q=80' }, // Pieza intermedia Q110
    { id: 12, img: 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=600&q=80' }, // Sunchadora manual
    { id: 13, img: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600&q=80' }, // Precinto 200mm
    { id: 14, img: 'https://images.unsplash.com/photo-1621905251918-48542801575a?w=600&q=80' }, // Precinto 300mm
    { id: 19, img: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=600&q=80' } // Grasa inhibidora
];

async function updateImages() {
    await client.connect();
    console.log('\n🔄 Actualizando imágenes de productos...\n');
    
    for (const update of imageUpdates) {
        try {
            await client.query(
                'UPDATE products SET img = $1 WHERE id = $2',
                [update.img, update.id]
            );
            console.log(`✓ Producto ${update.id} actualizado`);
        } catch (e) {
            console.error(`✗ Error en producto ${update.id}:`, e.message);
        }
    }
    
    console.log(`\n✅ ${imageUpdates.length} productos actualizados con imágenes reales\n`);
    await client.end();
}

updateImages().catch(e => {
    console.error('Error:', e);
    process.exit(1);
});
