require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

console.log('═══════════════════════════════════════');
console.log('  📂 Agregando Sistema de Categorías');
console.log('═══════════════════════════════════════\n');

const sql = fs.readFileSync('./sql/03_add_categories.sql', 'utf8');

pool.query(sql)
    .then(() => {
        console.log('✅ Tabla de categorías creada');
        console.log('✅ Columna categoria_id agregada a products');
        console.log('✅ Columna estado eliminada de products');
        console.log('✅ Categorías por defecto insertadas');
        console.log('\n═══════════════════════════════════════');
        console.log('  🎉 ¡Sistema de categorías listo!');
        console.log('═══════════════════════════════════════');
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Error al ejecutar SQL:', err.message);
        console.error('Detalle:', err.detail || '');
        process.exit(1);
    });
