// Script para configurar las tablas del carrito y Mercado Pago
// Ejecutar: node setup-carrito.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

console.log('\n============================================');
console.log('  SETUP: Carrito y Mercado Pago - Metal-Ce');
console.log('============================================\n');

// Verificar que existe .env
if (!fs.existsSync('.env')) {
    console.error('❌ Archivo .env no encontrado');
    console.error('Por favor, copia .env.example a .env y configura las variables\n');
    console.log('Ejemplo:');
    console.log('  copy .env.example .env\n');
    process.exit(1);
}

// Verificar DATABASE_URL
if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL no configurado en .env');
    process.exit(1);
}

console.log('✅ Configuración cargada\n');

// Verificar que existe el archivo SQL
const sqlFile = path.join(__dirname, 'sql', '08_create_cart_and_orders.sql');
if (!fs.existsSync(sqlFile)) {
    console.error(`❌ Archivo ${sqlFile} no encontrado`);
    process.exit(1);
}

console.log('🗄️  Ejecutando script SQL...');
console.log(`Archivo: ${sqlFile}\n`);

// Leer el contenido del archivo SQL
const sqlContent = fs.readFileSync(sqlFile, 'utf8');

// Crear conexión a la base de datos
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Ejecutar el script SQL
async function setupDatabase() {
    const client = await pool.connect();
    try {
        console.log('Conectando a la base de datos...');
        
        // Ejecutar el script SQL completo
        await client.query(sqlContent);
        
        console.log('\n✅ Tablas creadas exitosamente\n');
        
        // Verificar las tablas creadas
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('carritos', 'carrito_items', 'pedidos', 'stock_historial')
            ORDER BY table_name
        `);
        
        if (tablesResult.rows.length > 0) {
            console.log('📋 Tablas creadas:');
            tablesResult.rows.forEach(row => {
                console.log(`   ✓ ${row.table_name}`);
            });
            console.log('');
        }
        
    } catch (error) {
        console.error('\n❌ Error al ejecutar el script SQL:');
        console.error(error.message);
        if (error.detail) {
            console.error('Detalle:', error.detail);
        }
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

// Ejecutar setup
setupDatabase().then(() => {
    console.log('============================================');
    console.log('  Próximos pasos:');
    console.log('============================================\n');
    console.log('1. Configurar MP_ACCESS_TOKEN en .env');
    console.log('   Obtenerlo en: https://www.mercadopago.com.ar/developers\n');
    console.log('2. Configurar BASE_URL en .env');
    console.log('   Desarrollo: http://localhost:3000');
    console.log('   Producción: https://tudominio.com\n');
    console.log('3. Configurar webhook en Mercado Pago');
    console.log('   URL: [BASE_URL]/api/mercadopago/webhook\n');
    console.log('4. Iniciar el servidor');
    console.log('   npm start\n');
    console.log('📚 Leer CARRITO_MERCADOPAGO_README.md para más información\n');
    
    process.exit(0);
}).catch(error => {
    console.error('Error fatal:', error);
    process.exit(1);
});
