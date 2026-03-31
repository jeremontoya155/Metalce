const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

client.connect()
    .then(() => client.query('SELECT id, name, codigo, img FROM products WHERE stock > 0 ORDER BY name LIMIT 25'))
    .then(res => {
        console.log('\n=== PRODUCTOS ACTUALES ===\n');
        res.rows.forEach(r => {
            const imgStatus = r.img ? (r.img.includes('cloudinary') ? '✓ Cloudinary' : '✓ Local') : '✗ SIN IMG';
            console.log(`[${r.id}] ${r.name}`);
            console.log(`    Código: ${r.codigo || '(sin código)'}`);
            console.log(`    Imagen: ${imgStatus}`);
            if (r.img) console.log(`    URL: ${r.img.substring(0, 80)}...`);
            console.log('');
        });
        client.end();
    })
    .catch(e => {
        console.error('Error:', e.message);
        process.exit(1);
    });
