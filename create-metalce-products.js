require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const products = [
    // Conectores y Terminales
    {
        name: 'Conector Aislado Dentado Abulonado 16-25mm',
        description: 'Conector aislado dentado abulonado de alta resistencia para cables de 16 a 25mm. Ideal para instalaciones eléctricas domiciliarias e industriales. Material aislante de alta calidad con sistema de ajuste por perno.',
        img: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=800',
        price: 2850,
        stock: 150,
        bateria: 100,
        almacenamiento: 'N/A',
        estado: 'Nuevo'
    },
    {
        name: 'Conector Estanco Abulonado 35-50mm',
        description: 'Conector aislado dentado estanco abulonado para ambientes húmedos. Rango 35-50mm. Protección IP67, ideal para instalaciones a la intemperie. Certificado según normas IRAM.',
        img: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=800',
        price: 4200,
        stock: 85,
        bateria: 100,
        almacenamiento: 'N/A',
        estado: 'Nuevo'
    },
    {
        name: 'Terminal Preaislado de Conexión - Set x50',
        description: 'Set de 50 terminales preaislados de conexión para cables de 1.5 a 6mm². Colores surtidos según sección. Material cobre electrolítico estañado. Aislación en nylon de alta temperatura.',
        img: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800',
        price: 1850,
        stock: 200,
        bateria: 100,
        almacenamiento: 'Set x50',
        estado: 'Nuevo'
    },
    {
        name: 'Manguito de Empalme Preaislado 4-6mm²',
        description: 'Manguitos preaislados de empalme para cables de 4 a 6mm². Sistema de engaste por compresión. Color azul según norma. Pack x 100 unidades.',
        img: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=800',
        price: 3250,
        stock: 120,
        bateria: 100,
        almacenamiento: 'Pack x100',
        estado: 'Nuevo'
    },
    {
        name: 'Fusible Neozed D02 16A - Caja x10',
        description: 'Fusibles Neozed sistema D02 de 16 amperes. Calibre normalizado según norma DIN. Alta capacidad de ruptura. Caja conteniendo 10 unidades. Rosca E14.',
        img: 'https://images.unsplash.com/photo-1513828583688-c52646db42da?w=800',
        price: 4800,
        stock: 60,
        bateria: 100,
        almacenamiento: 'Caja x10',
        estado: 'Nuevo'
    },
    {
        name: 'Fusible Neozed D02 25A - Caja x10',
        description: 'Fusibles Neozed sistema D02 de 25 amperes. Calibre normalizado según norma DIN. Alta capacidad de ruptura. Caja conteniendo 10 unidades. Rosca E14.',
        img: 'https://images.unsplash.com/photo-1513828583688-c52646db42da?w=800',
        price: 5200,
        stock: 60,
        bateria: 100,
        almacenamiento: 'Caja x10',
        estado: 'Nuevo'
    },
    
    // Morsas y Acometidas
    {
        name: 'Morsa de Suspensión para Cable 10-25mm',
        description: 'Morsa de suspensión fabricada en aleación de aluminio. Para cables de 10 a 25mm. Sistema de ajuste rápido. Resistente a la corrosión. Ideal para tendidos aéreos.',
        img: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800',
        price: 3650,
        stock: 95,
        bateria: 100,
        almacenamiento: 'N/A',
        estado: 'Nuevo'
    },
    {
        name: 'Morsa de Retención Tipo A - Heavy Duty',
        description: 'Morsa de retención de alta resistencia tipo A. Construcción en acero galvanizado. Capacidad de carga 500kg. Sistema de ajuste por tuerca hexagonal. Uso industrial.',
        img: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800',
        price: 6850,
        stock: 45,
        bateria: 100,
        almacenamiento: 'N/A',
        estado: 'Nuevo'
    },
    {
        name: 'Morsa de Acometida Domiciliaria Duplex',
        description: 'Morsa de acometida domiciliaria tipo duplex. Para cables de 6 a 16mm. Aluminio fundido con tratamiento anticorrosivo. Fácil instalación. Incluye tornillería.',
        img: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800',
        price: 2950,
        stock: 180,
        bateria: 100,
        almacenamiento: 'N/A',
        estado: 'Nuevo'
    },
    
    // Flejes y Sujetadores
    {
        name: 'Fleje Acero Inoxidable 19mm x 30m',
        description: 'Fleje de acero inoxidable AISI 304 de 19mm de ancho. Rollo de 30 metros. Espesor 0.76mm. Resistente a la intemperie y corrosión. Ideal para sujeción de cables y tuberías.',
        img: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=800',
        price: 8900,
        stock: 35,
        bateria: 100,
        almacenamiento: '30m',
        estado: 'Nuevo'
    },
    {
        name: 'Hebilla para Fleje Acero Inox 19mm - Pack x100',
        description: 'Hebillas de acero inoxidable para fleje de 19mm. Pack conteniendo 100 unidades. Sistema de cierre seguro. Compatible con sunchadora manual o neumática.',
        img: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800',
        price: 3200,
        stock: 150,
        bateria: 100,
        almacenamiento: 'Pack x100',
        estado: 'Nuevo'
    },
    {
        name: 'Sunchadora Manual para Fleje 19mm',
        description: 'Herramienta sunchadora manual para flejes de hasta 19mm. Construcción robusta en acero. Sistema tensor y cortador integrado. Ergonómica y liviana.',
        img: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800',
        price: 15800,
        stock: 12,
        bateria: 100,
        almacenamiento: 'N/A',
        estado: 'Nuevo'
    },
    {
        name: 'Precinto Plástico Nylon 200mm - Pack x100',
        description: 'Precintos de nylon de alta resistencia. Longitud 200mm, ancho 4.8mm. Color negro resistente a UV. Temperatura de trabajo -40°C a +85°C. Pack x 100 unidades.',
        img: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=800',
        price: 950,
        stock: 300,
        bateria: 100,
        almacenamiento: 'Pack x100',
        estado: 'Nuevo'
    },
    {
        name: 'Precinto Plástico Nylon 300mm - Pack x100',
        description: 'Precintos de nylon reforzado. Longitud 300mm, ancho 7.2mm. Color negro resistente a UV. Alta resistencia a la tracción. Pack x 100 unidades.',
        img: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=800',
        price: 1450,
        stock: 250,
        bateria: 100,
        almacenamiento: 'Pack x100',
        estado: 'Nuevo'
    },
    
    // Ménsulas y Accesorios
    {
        name: 'Ménsula de Retención Angular Galvanizada',
        description: 'Ménsula de retención angular fabricada en hierro galvanizado. Ángulo 90°. Dimensiones 150x150mm. Incluye tornillería de montaje. Tratamiento anticorrosivo.',
        img: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=800',
        price: 2350,
        stock: 140,
        bateria: 100,
        almacenamiento: 'N/A',
        estado: 'Nuevo'
    },
    {
        name: 'Ménsula de Suspensión Ajustable 200mm',
        description: 'Ménsula de suspensión con sistema de ajuste variable. Longitud 200mm. Acero galvanizado de alta resistencia. Carga máxima 150kg. Pivote regulable 360°.',
        img: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800',
        price: 3850,
        stock: 75,
        bateria: 100,
        almacenamiento: 'N/A',
        estado: 'Nuevo'
    },
    {
        name: 'Protector Terminal Termocontraíble - Kit x50',
        description: 'Kit de protectores terminales termocontraíbles. Medidas surtidas 3-12mm. Material poliolefina. Reducción 3:1. Colores surtidos. Pack x 50 piezas.',
        img: 'https://images.unsplash.com/photo-1513828583688-c52646db42da?w=800',
        price: 2100,
        stock: 160,
        bateria: 100,
        almacenamiento: 'Kit x50',
        estado: 'Nuevo'
    },
    
    // Productos especiales
    {
        name: 'Pieza Intermedia Q110 - Aluminio',
        description: 'Pieza intermedia Q110 de aluminio fundido. Sistema de conexión normalizado. Alta conductividad eléctrica. Resistente a la corrosión. Certificación IRAM.',
        img: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800',
        price: 4650,
        stock: 65,
        bateria: 100,
        almacenamiento: 'N/A',
        estado: 'Nuevo'
    },
    {
        name: 'Grasa Inhibidora Conductora 500gr',
        description: 'Grasa inhibidora y conductora para conexiones eléctricas. Previene oxidación y corrosión. Mejora la conductividad. Temperatura de trabajo -30°C a +120°C. Envase 500gr.',
        img: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=800',
        price: 3200,
        stock: 90,
        bateria: 100,
        almacenamiento: '500gr',
        estado: 'Nuevo'
    },
    {
        name: 'Conector de Protección IP68 - Set x10',
        description: 'Conectores de conexión y protección grado IP68. Sumergibles hasta 1 metro. Rango 4-10mm². Incluye gel sellante. Set x 10 unidades. Color gris.',
        img: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=800',
        price: 5650,
        stock: 55,
        bateria: 100,
        almacenamiento: 'Set x10',
        estado: 'Nuevo'
    }
];

async function insertProducts() {
    const client = await pool.connect();
    
    try {
        console.log('🔧 Metal-Ce S.R.L - Carga de Productos');
        console.log('=====================================\n');
        
        await client.query('BEGIN');
        
        let insertedCount = 0;
        
        for (const product of products) {
            const result = await client.query(
                `INSERT INTO products (name, description, img, price, stock, bateria, almacenamiento) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7) 
                 RETURNING id, name, price`,
                [product.name, product.description, product.img, product.price, product.stock, 
                 product.bateria, product.almacenamiento]
            );
            
            insertedCount++;
            console.log(`✅ [${insertedCount}/${products.length}] ${result.rows[0].name} - $${result.rows[0].price}`);
        }
        
        await client.query('COMMIT');
        
        console.log('\n=====================================');
        console.log(`🎉 ${insertedCount} productos insertados exitosamente!`);
        
        // Mostrar resumen
        const summary = await client.query('SELECT COUNT(*) as total, SUM(stock) as total_stock FROM products');
        console.log(`\n📊 Resumen de la base de datos:`);
        console.log(`   Total de productos: ${summary.rows[0].total}`);
        console.log(`   Stock total: ${summary.rows[0].total_stock} unidades\n`);
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\n❌ Error al insertar productos:', err.message);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

insertProducts()
    .then(() => {
        console.log('✅ Proceso completado correctamente');
        process.exit(0);
    })
    .catch(err => {
        console.error('💥 Error fatal:', err);
        process.exit(1);
    });
