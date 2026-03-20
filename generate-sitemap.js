// Script para generar sitemap.xml dinámico desde la base de datos
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false
});

// Configuración del sitio
const BASE_URL = process.env.BASE_URL || 'https://metalce.com.ar';
const TODAY = new Date().toISOString().split('T')[0];

async function generateSitemap() {
    try {
        console.log('🗺️  Generando sitemap.xml...');
        
        // Obtener todos los productos
        const productsResult = await pool.query('SELECT id, name FROM products WHERE stock > 0 ORDER BY id');
        
        // Obtener todas las categorías
        const categoriesResult = await pool.query('SELECT id, nombre FROM categorias ORDER BY id');
        
        let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">

  <!-- Página principal -->
  <url>
    <loc>${BASE_URL}/</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>

  <!-- Carrito de compras -->
  <url>
    <loc>${BASE_URL}/cart</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>

  <!-- Checkout -->
  <url>
    <loc>${BASE_URL}/checkout</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>

  <!-- Nosotros -->
  <url>
    <loc>${BASE_URL}/about</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
`;

        // Agregar productos
        if (productsResult.rows.length > 0) {
            sitemap += '\n  <!-- Productos -->\n';
            productsResult.rows.forEach(product => {
                const lastmod = product.updated_at 
                    ? new Date(product.updated_at).toISOString().split('T')[0] 
                    : TODAY;
                sitemap += `  <url>
    <loc>${BASE_URL}/product/${product.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;
            });
        }

        sitemap += '\n</urlset>';

        // Guardar el archivo
        const sitemapPath = path.join(__dirname, 'public', 'sitemap.xml');
        fs.writeFileSync(sitemapPath, sitemap, 'utf8');
        
        console.log(`✅ Sitemap generado exitosamente!`);
        console.log(`📁 Ubicación: ${sitemapPath}`);
        console.log(`📊 Total URLs: ${productsResult.rows.length + 4}`);
        console.log(`   - Páginas principales: 4`);
        console.log(`   - Productos: ${productsResult.rows.length}`);
        console.log(`\n🌐 Accesible en: ${BASE_URL}/sitemap.xml`);
        
        await pool.end();
        process.exit(0);
    } catch (err) {
        console.error('❌ Error al generar sitemap:', err.message || err);
        console.error('Detalles:', err);
        await pool.end();
        process.exit(1);
    }
}

generateSitemap();
