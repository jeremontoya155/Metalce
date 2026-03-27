require('dotenv').config();  // Cargar variables de entorno desde .env
const express = require('express');
const session = require('express-session');
const { Pool } = require('pg');
const multer = require('multer'); // Middleware para manejo de carga de archivos
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const compression = require('compression');
const nodemailer = require('nodemailer');
const ExcelJS = require('exceljs');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(compression())

// Importar rutas del carrito
const cartRoutes = require('./middleware/cartRoutes');
// Mercado Pago deshabilitado temporalmente — carrito envía pedido por WhatsApp
// const { router: mercadopagoRoutes, initMercadoPago, liberarStockExpirado } = require('./middleware/mercadopagoRoutes');
let mercadopagoRoutes, initMercadoPago, liberarStockExpirado;
try {
    const mp = require('./middleware/mercadopagoRoutes');
    mercadopagoRoutes = mp.router;
    initMercadoPago = mp.initMercadoPago;
    liberarStockExpirado = mp.liberarStockExpirado;
} catch(e) {
    console.log('ℹ️ Módulo Mercado Pago no cargado (checkout por WhatsApp activo)');
    liberarStockExpirado = async () => {};
}

// Middleware para bloquear rutas específicas
app.use((req, res, next) => {
    const blockedPaths = [
        '/wp-includes/pomo/wp-login.php',
        '/wp-includes/fonts/wp-login.php',
        '/wp-includes/customize/wp-login.php',
        '/.tmb/wp-login.php',
        '/.well-known/pki-validation/wp-login.php',
        '/cgi-bin/wp-login.php',
        '/images/wp-login.php',
        '/wp-admin/css/wp-login.php',
        '/wp-admin/images/wp-login.php',
        '/wp-admin/',
        '/wp-login.php'
    ];

    // Bloquea las rutas mencionadas
    if (blockedPaths.includes(req.path) || req.path === '/wp-login.php') {
        res.status(403).send('Access forbidden');
    } else {
        next();
    }
});

// Configurar Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET,
});

// Configurar Mercado Pago
if (process.env.MP_ACCESS_TOKEN) {
    initMercadoPago(process.env.MP_ACCESS_TOKEN);
    console.log('✅ Mercado Pago configurado');
} else {
    console.warn('⚠️ MP_ACCESS_TOKEN no configurado en .env');
}

// Configuración de Multer para almacenamiento en Cloudinary
// ✅ WebP + calidad 80 + máx 1200px — reduce hasta 85% el tamaño vs PNG original
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'uploads',
        format: async (req, file) => 'webp',
        transformation: [{ width: 1200, crop: 'limit', quality: 80, fetch_format: 'auto' }],
        public_id: (req, file) => file.fieldname + '-' + Date.now(),
        allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'webp'],
    },
});

// Transforma URLs Cloudinary existentes al vuelo sin re-subirlas
function optimizeCloudinaryUrl(url, width = 800) {
    if (!url || !url.includes('res.cloudinary.com')) return url;
    if (url.includes('f_auto') || url.includes('q_auto')) return url;
    return url.replace('/image/upload/', `/image/upload/f_auto,q_auto:eco,w_${width},c_limit,dpr_auto/`);
}

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // Límite de 10MB
    },
    fileFilter: (req, file, cb) => {
        console.log('📂 Archivo recibido en Multer:', file.originalname);
        console.log('   Mimetype:', file.mimetype);
        
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            console.log('❌ Archivo rechazado: no es una imagen');
            cb(new Error('Solo se permiten archivos de imagen'), false);
        }
    }
});

// Storage de Cloudinary para CVs (PDF/DOC — raw)
const cvStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'cvs',
        resource_type: 'raw',
        public_id: (req, file) => 'cv-' + Date.now() + '-' + file.originalname.replace(/\s/g, '_'),
        allowed_formats: ['pdf', 'doc', 'docx'],
    },
});
const uploadCV = multer({
    storage: cvStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['application/pdf', 'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Solo PDF o Word'), false);
    }
});

// Configuración SMTP (nodemailer)
const mailTransporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: 'visioncompanyone@gmail.com',
        pass: 'ukhp hrzc qdhs kvfc'
    },
    tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2'
    }
});

// Middleware para manejar la carga de archivos en una ruta específica y almacenar el enlace en la base de datos
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const imageUrl = req.file.path; // URL de la imagen en Cloudinary
        await pool.query('INSERT INTO imagenes (imagen1) VALUES ($1)', [imageUrl]); // Inserta la URL en la base de datos
        res.send('Archivo subido exitosamente y URL almacenada en la base de datos');
    } catch (error) {
        console.error('Error al subir la imagen o guardar la URL:', error);
        res.status(500).send('Error interno del servidor');
    }
});

// Configuración de SweetAlert2
const Swal = require('sweetalert2');
const SwalMixin = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
    }
});

// Configurar middleware
app.set('view engine', 'ejs');
app.use(express.static('public', {
    maxAge: '7d',
    setHeaders: (res, filePath) => {
        if (/\.(jpg|jpeg|png|webp|gif|svg|ico)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        } else if (/\.(css|js)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=86400');
        }
    }
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
const sessionSecret = process.env.SESSION_SECRET;

app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: true,
}));

// Conectar a la base de datos PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Hacer pool disponible para las rutas
app.set('pool', pool);

// ==================== MIGRACIONES DE BASE DE DATOS (STARTUP) ====================
(async () => {
    try {
        // Columna codigo en products
        await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS codigo VARCHAR(100)`);
        // Columna aclaracion y folleto_url en products
        await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS aclaracion TEXT`);
        await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS folleto_url VARCHAR(500)`);
        // Columnas jerarquía en categorias
        await pool.query(`ALTER TABLE categorias ADD COLUMN IF NOT EXISTS familia VARCHAR(100)`);
        await pool.query(`ALTER TABLE categorias ADD COLUMN IF NOT EXISTS linea VARCHAR(100)`);
        // Crear tabla configuracion si no existe y asegurar fila modo_mantenimiento
        await pool.query(`CREATE TABLE IF NOT EXISTS configuracion (clave VARCHAR(100) PRIMARY KEY, valor TEXT)`);
        await pool.query(`INSERT INTO configuracion (clave, valor) VALUES ('modo_mantenimiento', 'false') ON CONFLICT (clave) DO NOTHING`);
        console.log('✅ Migraciones de startup aplicadas');
    } catch (e) {
        console.warn('⚠️ Advertencia en migraciones startup:', e.message);
    }
})();

// Job para liberar stock expirado cada 5 minutos
setInterval(() => {
    liberarStockExpirado(pool).catch(err => {
        console.error('Error en job de liberación de stock:', err);
    });
}, 5 * 60 * 1000);

// Montar rutas del carrito
app.use(cartRoutes);
// Mercado Pago deshabilitado temporalmente — checkout por WhatsApp
// app.use(mercadopagoRoutes);
if (mercadopagoRoutes) {
    // app.use(mercadopagoRoutes); // Descomentar para reactivar Mercado Pago
}

// ==================== MIDDLEWARE MODO MANTENIMIENTO ====================
app.use(async (req, res, next) => {
    // Excluir rutas admin, login y assets
    const excluidas = ['/login', '/logout', '/admin', '/css', '/js', '/imgs', '/favicon'];
    const esExcluida = excluidas.some(p => req.path.startsWith(p));
    const esAdmin = req.session && req.session.isAdmin;
    if (esExcluida || esAdmin) return next();
    try {
        const r = await pool.query("SELECT valor FROM configuracion WHERE clave = 'modo_mantenimiento'");
        if (r.rows.length > 0 && r.rows[0].valor === 'true') {
            return res.status(503).render('mantenimiento', { isAdmin: false });
        }
    } catch(e) { /* Si falla la consulta, no bloquear */ }
    next();
});

// Ruta admin: toggle mantenimiento
app.post('/admin/toggle-mantenimiento', requireAdmin, async (req, res) => {
    try {
        const r = await pool.query("SELECT valor FROM configuracion WHERE clave = 'modo_mantenimiento'");
        const actual = r.rows.length > 0 ? r.rows[0].valor : 'false';
        const nuevo = actual === 'true' ? 'false' : 'true';
        await pool.query(
            `INSERT INTO configuracion (clave, valor) VALUES ('modo_mantenimiento', $1)
             ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor`,
            [nuevo]
        );
        res.json({ ok: true, modo_mantenimiento: nuevo === 'true' });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// Middleware para verificar si el usuario es administrador
function requireAdmin(req, res, next) {
    // Simplificado para desarrollo - solo verifica que esté logueado
    if (req.session.userId) {
        console.log('Usuario logueado, acceso permitido. UserID:', req.session.userId);
        next();
    } else {
        console.log('Usuario no logueado, redirigiendo al login');
        res.redirect('/login');
    }
}

//TODOS LOS GET
// Ruta de checkout (pedido por WhatsApp)
app.get('/checkout', async (req, res) => {
    res.render('checkout', { isAdmin: req.session.isAdmin, phoneNumber: process.env.MY_PHONE_NUMBER || '' });
});

/* Rutas de Mercado Pago (deshabilitadas temporalmente)
app.get('/checkout/success', async (req, res) => {
    res.render('checkout-success', { isAdmin: req.session.isAdmin });
});

app.get('/checkout/pending', async (req, res) => {
    res.render('checkout-pending', { isAdmin: req.session.isAdmin });
});

app.get('/checkout/failure', async (req, res) => {
    res.render('checkout-failure', { isAdmin: req.session.isAdmin });
});
*/

// Ruta para el inicio de sesión
app.get('/login', (req, res) => {
    pool.query('SELECT imagen1, imagen2 FROM imagenes LIMIT 1', (err, result) => {
        if (err) {
            console.error('Error al obtener la URL de la imagen:', err);
            res.status(500).send('Error interno del servidor');
            return;
        }
        
        // Si no hay resultado, usar fallback
        const images = result.rows[0] || {};
        const logoUrl = images.imagen2 || images.imagen1 || '/imgs/LogoChip.png';
        
        res.render('login', { session: req.session, isAdmin: req.session.isAdmin, logoUrl });
    });
});

// Ruta para obtener la URL de la primera imagen (logo)
app.get('/logoImageUrl', (req, res) => {
    pool.query('SELECT imagen1 FROM imagenes LIMIT 1', (err, result) => {
        if (err) {
            console.error('Error al obtener la URL de la imagen:', err);
            res.status(500).send('Error interno del servidor');
            return;
        }
        
        // Si no hay resultado, usar fallback
        const images = result.rows[0] || {};
        const logoUrl = images.imagen1 || '/imgs/LogoChip.png';
        
        res.send(logoUrl); // Devolver la URL o fallback
    });
});

// Ruta para editar la imagen del hero (reutilizando sistema del carrusel)
app.get('/edit-hero', requireAdmin, (req, res) => {
    pool.query('SELECT * FROM imagenes WHERE id = 1', (err, result) => {
        if (err) {
            console.error('Error al obtener imagen del hero:', err);
            res.status(500).send('Error interno del servidor');
            return;
        }
        const heroData = result.rows[0] || {};
        res.render('edit-hero', { 
            currentImage: heroData.imagen2 || null,
            isAdmin: req.session.isAdmin 
        });
    });
});

// Ruta GET para editar hero banner
app.get('/edit-hero', requireAdmin, async (req, res) => {
    try {
        // Obtener los datos actuales del hero banner desde la tabla imagenes
        const result = await pool.query('SELECT titulo, descripcion, imagen2 FROM imagenes LIMIT 1');
        const heroData = result.rows[0] || {};
        
        res.render('edit-hero', { 
            heroTitle: heroData.titulo || 'Tecnología sin límite',
            heroDescription: heroData.descripcion || 'Los mejores dispositivos a tu alcance. Calidad garantizada.',
            heroImage: heroData.imagen2 || '',
            isAdmin: req.session.isAdmin 
        });
    } catch (err) {
        console.error('Error al obtener datos del hero:', err);
        res.status(500).send('Error interno del servidor');
    }
});

// Ruta POST para actualizar hero banner (solo imagen)
app.post('/edit-hero', requireAdmin, upload.single('image'), async (req, res) => {
    try {
        let imageUrl = null;
        
        // Si se subió una nueva imagen
        if (req.file) {
            imageUrl = req.file.path; // URL de Cloudinary
            console.log('📸 Nueva imagen para hero:', imageUrl);
        } else {
            return res.status(400).send('No se subió ninguna imagen');
        }
        
        // Verificar si ya existe un registro
        const checkResult = await pool.query('SELECT id FROM imagenes LIMIT 1');
        
        if (checkResult.rows.length > 0) {
            // Actualizar solo la imagen2 en el registro existente
            await pool.query(
                'UPDATE imagenes SET imagen2 = $1 WHERE id = $2',
                [imageUrl, checkResult.rows[0].id]
            );
            console.log('✅ Imagen del hero actualizada correctamente');
        } else {
            // Crear nuevo registro con solo imagen2
            await pool.query(
                'INSERT INTO imagenes (imagen2) VALUES ($1)',
                [imageUrl]
            );
            console.log('✅ Nuevo registro de hero creado');
        }
        
        res.redirect('/');
    } catch (err) {
        console.error('Error al actualizar hero banner:', err);
        res.status(500).send('Error al guardar los cambios');
    }
});



// Ruta para la página "about"
app.get('/about', (req, res) => {
    pool.query('SELECT * FROM about LIMIT 1', (err, result) => {
        if (err) {
            console.error('Error al obtener datos de la tabla about:', err);
            res.status(500).send('Error interno del servidor');
            return;
        }

        const about = result.rows[0] || { titulo: '', texto: '', imagen: '' }; // Valores por defecto en caso de que no haya datos
        res.render('about', { about, isAdmin: req.session.isAdmin });
    });
});

// Ruta principal para renderizar la página principal
app.get('/', async (req, res) => {
    try {
        // Consulta con JOIN a categorías para cuotas
        const productsResult = await pool.query('SELECT p.*, c.nombre as categoria_nombre, c.icono as categoria_icono, c.color as categoria_color, c.cuotas_max, c.interes_cuotas, c.cuotas_planes FROM products p LEFT JOIN categorias c ON p.categoria_id = c.id');
        const aboutResult = await pool.query('SELECT * FROM about LIMIT 1');
        const imagesResult = await pool.query('SELECT imagen1, imagen2 FROM imagenes LIMIT 1');
        
        // Obtener cotización del dólar y config de visibilidad
        let cotizacionDolar = 1200;
        let mostrarPrecioPesos = true;
        let pixelId = '';
        try {
            const cotizResult = await pool.query("SELECT valor FROM configuracion WHERE clave = 'cotizacion_dolar'");
            if (cotizResult.rows.length > 0) cotizacionDolar = parseFloat(cotizResult.rows[0].valor);
            const mostrarResult = await pool.query("SELECT valor FROM configuracion WHERE clave = 'mostrar_precio_pesos'");
            if (mostrarResult.rows.length > 0) mostrarPrecioPesos = mostrarResult.rows[0].valor === 'true';
            const pixelResult = await pool.query("SELECT valor FROM configuracion WHERE clave = 'pixel_id'");
            if (pixelResult.rows.length > 0) pixelId = pixelResult.rows[0].valor || '';
        } catch(e) { console.log('Tabla configuracion no existe aún, usando defaults'); }
        
        // Obtener oferta general activa
        const ofertaGeneralResult = await pool.query(`
            SELECT * FROM ofertas_generales
            WHERE activo = TRUE
            ORDER BY created_at DESC
            LIMIT 1
        `);
        const ofertaGeneral = ofertaGeneralResult.rows[0];
        const categoriasExcluidas = ofertaGeneral && ofertaGeneral.categorias_excluidas
            ? ofertaGeneral.categorias_excluidas.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
            : [];
        
        // Obtener ofertas específicas activas
        const ofertasResult = await pool.query(`
            SELECT 
                o.*,
                p.price as precio_original,
                CASE 
                    WHEN o.tipo_descuento = 'porcentaje' THEN ROUND(p.price * (1 - o.valor_descuento / 100), 2)
                    ELSE GREATEST(ROUND(p.price - o.valor_descuento, 2), 0)
                END as precio_con_descuento
            FROM ofertas o
            JOIN products p ON o.product_id = p.id
            WHERE o.activo = TRUE
        `);

        console.log('=== DEBUG OFERTAS ===');
        console.log('Total ofertas específicas activas:', ofertasResult.rows.length);
        console.log('Oferta general activa:', ofertaGeneral ? ofertaGeneral.nombre : 'Ninguna');

        // Crear un mapa de ofertas específicas por product_id
        const ofertasMap = {};
        
        ofertasResult.rows.forEach(oferta => {
            console.log(`Oferta ${oferta.id} - Producto ${oferta.product_id} - ACTIVA`);
            
            ofertasMap[oferta.product_id] = {
                oferta_id: oferta.id,
                tipo_descuento: oferta.tipo_descuento,
                valor_descuento: oferta.valor_descuento,
                precio_final: oferta.precio_con_descuento,
                tiene_oferta_vigente: true,
                es_oferta_general: false
            };
        });

        // Combinar productos con ofertas (específicas tienen prioridad)
        const products = productsResult.rows.map(product => {
            // Si tiene oferta específica, usarla
            if (ofertasMap[product.id]) {
                return {
                    ...product,
                    ...ofertasMap[product.id]
                };
            }
            
            // Si no tiene oferta específica pero hay oferta general activa, aplicarla
            // Verificar que la categoría del producto no esté excluida
            if (ofertaGeneral && !categoriasExcluidas.includes(product.categoria_id)) {
                const precioConDescuento = ofertaGeneral.tipo_descuento === 'porcentaje'
                    ? Math.round(product.price * (1 - ofertaGeneral.valor_descuento / 100) * 100) / 100
                    : Math.max(Math.round((product.price - ofertaGeneral.valor_descuento) * 100) / 100, 0);
                
                return {
                    ...product,
                    oferta_id: `general_${ofertaGeneral.id}`,
                    tipo_descuento: ofertaGeneral.tipo_descuento,
                    valor_descuento: ofertaGeneral.valor_descuento,
                    precio_final: precioConDescuento,
                    tiene_oferta_vigente: true,
                    es_oferta_general: true,
                    nombre_oferta_general: ofertaGeneral.nombre
                };
            }
            
            // Sin oferta
            return {
                ...product,
                tiene_oferta_vigente: false,
                precio_final: product.price
            };
        });

        console.log('Productos con ofertas aplicadas:', products.filter(p => p.tiene_oferta_vigente).length);

        const about = aboutResult.rows.length > 0 ? aboutResult.rows[0] : { titulo: '', texto: '', imagen: '' };
        const images = imagesResult.rows[0] || {};
        const logoUrl = images.imagen1 || '/imgs/LogoChip.png';
        const imagen2Url = images.imagen2 || '/imgs/LogoChip.png';

        res.render('index', { products: products.map(p => ({...p, img: optimizeCloudinaryUrl(p.img, 500)})), about, logoUrl, imagen2Url, isAdmin: req.session.isAdmin, cotizacionDolar, mostrarPrecioPesos, pixelId });
    } catch (err) {
        console.error('Error al obtener datos:', err);
        res.status(500).send('Error interno del servidor');
    }
});

// Ruta para mostrar el formulario de edición de imágenes
app.get('/edit-images', requireAdmin, async (req, res) => {
    const result = await pool.query('SELECT * FROM imagenes WHERE id = $1', [1]); // Asumiendo que solo tienes un registro con ID 1
    const imagenes = result.rows[0];
    res.render('editImages', { isAdmin: true, imagenes });
});

// Ruta para carrito de compras
app.get('/cart', async (req, res) => {
    try {
        const productsResult = await pool.query('SELECT p.*, c.nombre as categoria_nombre, c.icono as categoria_icono, c.color as categoria_color, c.cuotas_max, c.interes_cuotas, c.cuotas_planes, c.familia as categoria_familia, c.linea as categoria_linea FROM products p LEFT JOIN categorias c ON p.categoria_id = c.id');
        const aboutResult = await pool.query('SELECT * FROM about LIMIT 1');
        const imagesResult = await pool.query('SELECT imagen1, imagen2 FROM imagenes LIMIT 1');
        
        // Obtener cotización del dólar y config de visibilidad
        let cotizacionDolar = 1200;
        let mostrarPrecioPesos = true;
        try {
            const cotizResult = await pool.query("SELECT valor FROM configuracion WHERE clave = 'cotizacion_dolar'");
            if (cotizResult.rows.length > 0) cotizacionDolar = parseFloat(cotizResult.rows[0].valor);
            const mostrarResult = await pool.query("SELECT valor FROM configuracion WHERE clave = 'mostrar_precio_pesos'");
            if (mostrarResult.rows.length > 0) mostrarPrecioPesos = mostrarResult.rows[0].valor === 'true';
        } catch(e) { console.log('Tabla configuracion no existe aún, usando defaults'); }
        
        // Obtener oferta general activa
        const ofertaGeneralResult = await pool.query(`
            SELECT * FROM ofertas_generales
            WHERE activo = TRUE
            ORDER BY created_at DESC
            LIMIT 1
        `);
        const ofertaGeneral = ofertaGeneralResult.rows[0];
        const categoriasExcluidas = ofertaGeneral && ofertaGeneral.categorias_excluidas
            ? ofertaGeneral.categorias_excluidas.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
            : [];

        // Obtener ofertas específicas activas
        const ofertasResult = await pool.query(`
            SELECT 
                o.*,
                p.price as precio_original,
                CASE 
                    WHEN o.tipo_descuento = 'porcentaje' THEN ROUND(p.price * (1 - o.valor_descuento / 100), 2)
                    ELSE GREATEST(ROUND(p.price - o.valor_descuento, 2), 0)
                END as precio_con_descuento
            FROM ofertas o
            JOIN products p ON o.product_id = p.id
            WHERE o.activo = TRUE
        `);

        // Crear mapa de ofertas específicas
        const ofertasMap = {};
        
        ofertasResult.rows.forEach(oferta => {
            ofertasMap[oferta.product_id] = {
                oferta_id: oferta.id,
                tipo_descuento: oferta.tipo_descuento,
                valor_descuento: oferta.valor_descuento,
                precio_final: oferta.precio_con_descuento,
                tiene_oferta_vigente: true,
                es_oferta_general: false
            };
        });

        // Combinar productos con ofertas (específicas tienen prioridad)
        const products = productsResult.rows.map(product => {
            if (ofertasMap[product.id]) {
                return {
                    ...product,
                    ...ofertasMap[product.id]
                };
            }
            
            // Si no tiene oferta específica pero hay oferta general activa
            // Verificar que la categoría del producto no esté excluida
            if (ofertaGeneral && !categoriasExcluidas.includes(product.categoria_id)) {
                const precioConDescuento = ofertaGeneral.tipo_descuento === 'porcentaje'
                    ? Math.round(product.price * (1 - ofertaGeneral.valor_descuento / 100) * 100) / 100
                    : Math.max(Math.round((product.price - ofertaGeneral.valor_descuento) * 100) / 100, 0);
                return {
                    ...product,
                    oferta_id: `general_${ofertaGeneral.id}`,
                    tipo_descuento: ofertaGeneral.tipo_descuento,
                    valor_descuento: ofertaGeneral.valor_descuento,
                    precio_final: precioConDescuento,
                    tiene_oferta_vigente: true,
                    es_oferta_general: true,
                    nombre_oferta_general: ofertaGeneral.nombre
                };
            }

            return {
                ...product,
                tiene_oferta_vigente: false,
                precio_final: product.price
            };
        });

        const about = aboutResult.rows.length > 0 ? aboutResult.rows[0] : { titulo: '', texto: '', imagen: '' };
        const images = imagesResult.rows[0] || {};
        const logoUrl = images.imagen1 || '/imgs/LogoChip.png';
        const imagenUrl2 = images.imagen2 || '/imgs/LogoChip.png';

        res.render('cart', { products: products.map(p => ({...p, img: optimizeCloudinaryUrl(p.img, 500)})), about, logoUrl, imagenUrl2, isAdmin: req.session.isAdmin, cotizacionDolar, mostrarPrecioPesos });
    } catch (err) {
        console.error('Error al obtener productos para el carrito:', err);
        res.status(500).send('Error interno del servidor');
    }
});

// Ruta para editar un producto (requiere autenticación de administrador)
app.get('/edit/:id', requireAdmin, async (req, res) => {
    const id = req.params.id;
    try {
        const productResult = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
        const categoriasResult = await pool.query('SELECT * FROM categorias WHERE activo = 1 ORDER BY orden, nombre');
        
        if (productResult.rows.length === 0) {
            return res.status(404).send('Producto no encontrado');
        }
        
        res.render('edit', { 
            product: productResult.rows[0], 
            categorias: categoriasResult.rows,
            isAdmin: req.session.isAdmin 
        });
    } catch (err) {
        console.error('Error al obtener producto para edición:', err);
        res.status(500).send('Error interno del servidor');
    }
});

// Ruta para cerrar sesión
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error al cerrar sesión:', err);
            res.status(500).send('Error interno del servidor');
            return;
        }
        res.redirect('/');
    });
});

// Editar el about
app.get('/edit-about', requireAdmin, (req, res) => {
    pool.query('SELECT * FROM about LIMIT 1', (err, result) => {
        if (err) {
            console.error('Error al obtener datos de la tabla about:', err);
            res.status(500).send('Error interno del servidor');
            return;
        }
        const about = result.rows.length > 0 ? result.rows[0] : { titulo: '', texto: '', imagen: '' };
        res.render('editAbout', { about, isAdmin: req.session.isAdmin });
    });
});

// Ruta para agregar un nuevo producto (requiere autenticación de administrador)
app.get('/new', requireAdmin, async (req, res) => {
    try {
        const categoriasResult = await pool.query('SELECT * FROM categorias WHERE activo = 1 ORDER BY orden, nombre');
        res.render('new', { isAdmin: req.session.isAdmin, categorias: categoriasResult.rows });
    } catch (err) {
        console.error('Error al cargar categorías:', err);
        res.status(500).send('Error interno del servidor');
    }
});

// ==================== RUTAS PARA GESTIÓN DE CATEGORÍAS ====================

// Ver categorías
app.get('/categorias', requireAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM categorias ORDER BY orden, nombre');
        res.render('categorias', { categorias: result.rows, isAdmin: req.session.isAdmin });
    } catch (err) {
        console.error('Error al obtener categorías:', err);
        res.status(500).send('Error interno del servidor');
    }
});

// Agregar categoría
app.post('/add-category', requireAdmin, async (req, res) => {
    const { nombre, descripcion, icono, color, orden, cuotas_max, interes_cuotas, familia, linea } = req.body;
    let cuotasMaxFinal = parseInt(cuotas_max) || 0;
    let interesCuotasFinal = parseFloat(interes_cuotas) || 0;
    // Construir planes de cuotas desde los arrays del formulario
    let cuotasPlanes = '[]';
    const planCuotas = req.body['plan_cuotas[]'] || req.body.plan_cuotas;
    const planInteres = req.body['plan_interes[]'] || req.body.plan_interes;
    if (planCuotas) {
        const cuotasArr = Array.isArray(planCuotas) ? planCuotas : [planCuotas];
        const interesArr = Array.isArray(planInteres) ? planInteres : [planInteres || '0'];
        const planes = cuotasArr.map((c, i) => ({
            cuotas: parseInt(c) || 0,
            interes: parseFloat(interesArr[i]) || 0
        })).filter(p => p.cuotas > 0).sort((a, b) => a.cuotas - b.cuotas);
        cuotasPlanes = JSON.stringify(planes);

        if (planes.length > 0) {
            const planMayor = planes[planes.length - 1];
            cuotasMaxFinal = planMayor.cuotas;
            interesCuotasFinal = planMayor.interes;
        } else {
            cuotasMaxFinal = 0;
            interesCuotasFinal = 0;
        }
    }
    try {
        await pool.query(
            'INSERT INTO categorias (nombre, descripcion, icono, color, orden, cuotas_max, interes_cuotas, cuotas_planes, familia, linea) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
            [nombre, descripcion || null, icono || '📦', color || '#0052A3', parseInt(orden) || 0, cuotasMaxFinal, interesCuotasFinal, cuotasPlanes, familia || null, linea || null]
        );
        res.redirect('/categorias');
    } catch (err) {
        console.error('Error al agregar categoría:', err);
        res.status(500).send('Error al agregar categoría: ' + err.message);
    }
});

// Editar categoría - Página completa
app.get('/edit-category/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const catResult = await pool.query('SELECT * FROM categorias WHERE id = $1', [id]);
        if (catResult.rows.length === 0) {
            return res.redirect('/categorias');
        }
        const categoria = catResult.rows[0];
        
        // Parsear planes de cuotas
        let planesCategoria = [];
        try { planesCategoria = JSON.parse(categoria.cuotas_planes || '[]'); } catch(e) { planesCategoria = []; }
        if (planesCategoria.length === 0 && categoria.cuotas_max > 0) {
            planesCategoria = [{cuotas: categoria.cuotas_max, interes: categoria.interes_cuotas || 0}];
        }

        // Obtener productos EN esta categoría
        const productosEnCat = await pool.query(
            'SELECT id, name, img, price, stock, moneda FROM products WHERE categoria_id = $1 ORDER BY name', [id]
        );
        // Obtener productos SIN categoría o de OTRA categoría (para poder asignar)
        const productosDisponibles = await pool.query(
            'SELECT p.id, p.name, p.img, p.price, p.stock, p.moneda, c.nombre as cat_nombre, c.icono as cat_icono FROM products p LEFT JOIN categorias c ON p.categoria_id = c.id WHERE p.categoria_id IS NULL OR p.categoria_id != $1 ORDER BY p.name', [id]
        );
        const productosCount = productosEnCat.rows.length;

        res.render('edit-category', { 
            categoria, planesCategoria, productosCount, 
            productosEnCat: productosEnCat.rows, 
            productosDisponibles: productosDisponibles.rows, 
            isAdmin: req.session.isAdmin 
        });
    } catch (err) {
        console.error('Error al cargar edición de categoría:', err);
        res.status(500).send('Error interno del servidor');
    }
});

// API: Asignar producto a categoría
app.post('/api/category/:id/assign', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { productId } = req.body;
    try {
        await pool.query('UPDATE products SET categoria_id = $1 WHERE id = $2', [id, productId]);
        res.json({ success: true });
    } catch (err) {
        console.error('Error al asignar producto:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Desasignar producto de categoría
app.post('/api/category/:id/unassign', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { productId } = req.body;
    try {
        await pool.query('UPDATE products SET categoria_id = NULL WHERE id = $1 AND categoria_id = $2', [productId, id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Error al desasignar producto:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Cambiar moneda de un producto
app.post('/api/product/:id/moneda', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { moneda } = req.body;
    if (!['ARS', 'USD'].includes(moneda)) return res.status(400).json({ error: 'Moneda inválida' });
    try {
        await pool.query('UPDATE products SET moneda = $1 WHERE id = $2', [moneda, id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Error al cambiar moneda:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Cambiar moneda de TODOS los productos de una categoría
app.post('/api/category/:id/moneda-bulk', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { moneda } = req.body;
    if (!['ARS', 'USD'].includes(moneda)) return res.status(400).json({ error: 'Moneda inválida' });
    try {
        const result = await pool.query('UPDATE products SET moneda = $1 WHERE categoria_id = $2', [moneda, id]);
        res.json({ success: true, updated: result.rowCount });
    } catch (err) {
        console.error('Error al cambiar moneda masiva:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Convertir precio de un producto (USD ↔ ARS)
app.post('/api/product/:id/convertir-precio', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { monedaActual } = req.body;
    try {
        // Obtener cotización
        const cotizResult = await pool.query("SELECT valor FROM configuracion WHERE clave = 'cotizacion_dolar'");
        const cotizacionDolar = cotizResult.rows.length > 0 ? parseFloat(cotizResult.rows[0].valor) : 1200;
        
        // Obtener precio actual del producto
        const productResult = await pool.query('SELECT price FROM products WHERE id = $1', [id]);
        if (productResult.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        
        const precioActual = parseFloat(productResult.rows[0].price);
        let nuevoPrecio, nuevaMoneda;
        
        if (monedaActual === 'ARS') {
            // Convertir de ARS a USD
            nuevoPrecio = Math.round(precioActual / cotizacionDolar);
            nuevaMoneda = 'USD';
        } else {
            // Convertir de USD a ARS
            nuevoPrecio = Math.round(precioActual * cotizacionDolar);
            nuevaMoneda = 'ARS';
        }
        
        // Actualizar precio y moneda
        await pool.query('UPDATE products SET price = $1, moneda = $2 WHERE id = $3', [nuevoPrecio, nuevaMoneda, id]);
        
        res.json({ 
            success: true, 
            viejoPrecio: precioActual.toLocaleString('es-AR'),
            nuevoPrecio: nuevoPrecio.toLocaleString('es-AR'),
            nuevaMoneda,
            cotizacion: cotizacionDolar
        });
    } catch (err) {
        console.error('Error al convertir precio:', err);
        res.status(500).json({ error: err.message });
    }
});


// Editar categoría - POST
app.post('/edit-category/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, icono, color, orden, cuotas_max, interes_cuotas, familia, linea } = req.body;
    let cuotasMaxFinal = parseInt(cuotas_max) || 0;
    let interesCuotasFinal = parseFloat(interes_cuotas) || 0;
    // Construir planes de cuotas desde los arrays del formulario
    let cuotasPlanes = '[]';
    const planCuotas = req.body['plan_cuotas[]'] || req.body.plan_cuotas;
    const planInteres = req.body['plan_interes[]'] || req.body.plan_interes;
    if (planCuotas) {
        const cuotasArr = Array.isArray(planCuotas) ? planCuotas : [planCuotas];
        const interesArr = Array.isArray(planInteres) ? planInteres : [planInteres || '0'];
        const planes = cuotasArr.map((c, i) => ({
            cuotas: parseInt(c) || 0,
            interes: parseFloat(interesArr[i]) || 0
        })).filter(p => p.cuotas > 0).sort((a, b) => a.cuotas - b.cuotas);
        cuotasPlanes = JSON.stringify(planes);

        if (planes.length > 0) {
            const planMayor = planes[planes.length - 1];
            cuotasMaxFinal = planMayor.cuotas;
            interesCuotasFinal = planMayor.interes;
        } else {
            cuotasMaxFinal = 0;
            interesCuotasFinal = 0;
        }
    }
    try {
        await pool.query(
            'UPDATE categorias SET nombre = $1, descripcion = $2, icono = $3, color = $4, orden = $5, cuotas_max = $6, interes_cuotas = $7, cuotas_planes = $8, familia = $9, linea = $10 WHERE id = $11',
            [nombre, descripcion || null, icono || '📦', color || '#0052A3', parseInt(orden) || 0, cuotasMaxFinal, interesCuotasFinal, cuotasPlanes, familia || null, linea || null, id]
        );
        res.redirect('/categorias');
    } catch (err) {
        console.error('Error al editar categoría:', err);
        res.status(500).send('Error al editar categoría: ' + err.message);
    }
});

// Eliminar categoría
app.post('/delete-category/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        // Actualizar productos de esta categoría a NULL
        await pool.query('UPDATE products SET categoria_id = NULL WHERE categoria_id = $1', [id]);
        // Eliminar categoría
        await pool.query('DELETE FROM categorias WHERE id = $1', [id]);
        res.redirect('/categorias');
    } catch (err) {
        console.error('Error al eliminar categoría:', err);
        res.status(500).send('Error al eliminar categoría: ' + err.message);
    }
});

// ==================== RUTAS PARA GESTIÓN DE OFERTAS ====================

// Ver página de gestión de ofertas
app.get('/admin/ofertas', requireAdmin, async (req, res) => {
    try {
        // Obtener todos los productos
        const productsResult = await pool.query('SELECT * FROM products ORDER BY name');
        
        // Obtener ofertas activas con información del producto
        const ofertasActivasResult = await pool.query(`
            SELECT 
                o.*,
                p.name as product_name,
                p.price as precio_original,
                CASE 
                    WHEN o.tipo_descuento = 'porcentaje' THEN ROUND(p.price * (1 - o.valor_descuento / 100), 2)
                    ELSE GREATEST(ROUND(p.price - o.valor_descuento, 2), 0)
                END as precio_final
            FROM ofertas o
            JOIN products p ON o.product_id = p.id
            WHERE o.activo = TRUE
            ORDER BY o.fecha_inicio DESC
        `);

        // Obtener todas las ofertas (historial)
        const todasOfertasResult = await pool.query(`
            SELECT 
                o.*,
                p.name as product_name
            FROM ofertas o
            JOIN products p ON o.product_id = p.id
            ORDER BY o.created_at DESC
        `);

        // Obtener ofertas generales
        const ofertasGeneralesResult = await pool.query(`
            SELECT * FROM ofertas_generales
            ORDER BY created_at DESC
        `);

        // Obtener categorías para exclusión
        const categoriasResult = await pool.query('SELECT * FROM categorias ORDER BY orden, nombre');

        res.render('ofertas', {
            products: productsResult.rows,
            ofertasActivas: ofertasActivasResult.rows,
            todasOfertas: todasOfertasResult.rows,
            ofertasGenerales: ofertasGeneralesResult.rows,
            categorias: categoriasResult.rows,
            isAdmin: req.session.isAdmin
        });
    } catch (err) {
        console.error('Error al cargar página de ofertas:', err);
        res.status(500).send('Error interno del servidor');
    }
});

// Crear ofertas para múltiples productos
app.post('/admin/ofertas/crear', requireAdmin, async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const { productos, tipo_descuento, valor_descuento, fecha_inicio, fecha_fin } = req.body;
        
        console.log('=== CREAR OFERTAS ===');
        console.log('Productos:', productos);
        console.log('Tipo:', tipo_descuento);
        console.log('Valor:', valor_descuento);
        console.log('Inicio:', fecha_inicio);
        console.log('Fin:', fecha_fin);

        // Validaciones
        if (!productos || (Array.isArray(productos) && productos.length === 0)) {
            await client.query('ROLLBACK');
            return res.status(400).send('Debes seleccionar al menos un producto');
        }

        if (!tipo_descuento || !valor_descuento || !fecha_inicio || !fecha_fin) {
            await client.query('ROLLBACK');
            return res.status(400).send('Todos los campos son obligatorios');
        }

        const valorDesc = parseFloat(valor_descuento);
        if (valorDesc <= 0) {
            await client.query('ROLLBACK');
            return res.status(400).send('El valor del descuento debe ser mayor a 0');
        }

        if (tipo_descuento === 'porcentaje' && (valorDesc < 0 || valorDesc > 100)) {
            await client.query('ROLLBACK');
            return res.status(400).send('El porcentaje debe estar entre 0 y 100');
        }

        const fechaInicioDate = new Date(fecha_inicio);
        const fechaFinDate = new Date(fecha_fin);

        if (fechaFinDate <= fechaInicioDate) {
            await client.query('ROLLBACK');
            return res.status(400).send('La fecha de fin debe ser posterior a la fecha de inicio');
        }

        // Asegurar que productos sea un array
        const productosArray = Array.isArray(productos) ? productos : [productos];

        // Insertar ofertas para cada producto
        for (const productId of productosArray) {
            // Primero, desactivar ofertas anteriores del mismo producto
            await client.query(
                'UPDATE ofertas SET activo = FALSE WHERE product_id = $1 AND activo = TRUE',
                [productId]
            );

            // Insertar nueva oferta
            await client.query(`
                INSERT INTO ofertas (product_id, tipo_descuento, valor_descuento, fecha_inicio, fecha_fin, activo)
                VALUES ($1, $2, $3, $4, $5, TRUE)
            `, [productId, tipo_descuento, valorDesc, fechaInicioDate, fechaFinDate]);
        }

        await client.query('COMMIT');
        console.log('✅ Ofertas creadas exitosamente');
        res.redirect('/admin/ofertas');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error al crear ofertas:', err);
        res.status(500).send('Error al crear ofertas: ' + err.message);
    } finally {
        client.release();
    }
});

// Eliminar oferta
app.post('/admin/ofertas/eliminar/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM ofertas WHERE id = $1', [id]);
        console.log('✅ Oferta eliminada:', id);
        res.redirect('/admin/ofertas');
    } catch (err) {
        console.error('Error al eliminar oferta:', err);
        res.status(500).send('Error al eliminar oferta: ' + err.message);
    }
});

// Activar/Desactivar oferta (toggle)
app.post('/admin/ofertas/toggle/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        // Obtener estado actual
        const result = await pool.query('SELECT activo FROM ofertas WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).send('Oferta no encontrada');
        }
        
        const nuevoEstado = !result.rows[0].activo;
        
        // Actualizar estado
        await pool.query('UPDATE ofertas SET activo = $1 WHERE id = $2', [nuevoEstado, id]);
        console.log(`✅ Oferta ${id} ${nuevoEstado ? 'ACTIVADA' : 'DESACTIVADA'}`);
        res.redirect('/admin/ofertas');
    } catch (err) {
        console.error('Error al cambiar estado de oferta:', err);
        res.status(500).send('Error al cambiar estado: ' + err.message);
    }
});

// Editar oferta específica
app.post('/admin/ofertas/editar/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { tipo_descuento, valor_descuento, fecha_inicio, fecha_fin } = req.body;
    try {
        const valorDesc = parseFloat(valor_descuento);
        if (!tipo_descuento || !valor_descuento || !fecha_inicio || !fecha_fin) {
            return res.status(400).send('Todos los campos son obligatorios');
        }
        if (valorDesc <= 0) {
            return res.status(400).send('El valor del descuento debe ser mayor a 0');
        }
        if (tipo_descuento === 'porcentaje' && (valorDesc < 0 || valorDesc > 100)) {
            return res.status(400).send('El porcentaje debe estar entre 0 y 100');
        }

        await pool.query(`
            UPDATE ofertas SET tipo_descuento = $1, valor_descuento = $2, fecha_inicio = $3, fecha_fin = $4, updated_at = NOW()
            WHERE id = $5
        `, [tipo_descuento, valorDesc, fecha_inicio, fecha_fin, id]);

        console.log(`✅ Oferta específica ${id} editada`);
        res.redirect('/admin/ofertas');
    } catch (err) {
        console.error('Error al editar oferta:', err);
        res.status(500).send('Error al editar oferta: ' + err.message);
    }
});

// API para obtener productos con ofertas (para el frontend)
app.get('/api/productos-ofertas', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM productos_con_ofertas
            ORDER BY tiene_oferta_vigente DESC, name
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error al obtener productos con ofertas:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ==================== RUTAS PARA OFERTAS GENERALES ====================

// Crear oferta general
app.post('/admin/ofertas/general/crear', requireAdmin, async (req, res) => {
    try {
        const { nombre, descripcion, tipo_descuento, valor_descuento, fecha_inicio, fecha_fin } = req.body;
        let categoriasExcluidas = req.body.categorias_excluidas || [];
        if (!Array.isArray(categoriasExcluidas)) categoriasExcluidas = [categoriasExcluidas];
        const categoriasExcluidasStr = categoriasExcluidas.join(',');
        
        console.log('=== CREAR OFERTA GENERAL ===');
        console.log('Nombre:', nombre);
        console.log('Tipo:', tipo_descuento);
        console.log('Valor:', valor_descuento);
        console.log('Categorías excluidas:', categoriasExcluidasStr);

        // Validaciones
        if (!nombre || !tipo_descuento || !valor_descuento || !fecha_inicio || !fecha_fin) {
            return res.status(400).send('Todos los campos son obligatorios');
        }

        const valorDesc = parseFloat(valor_descuento);
        if (valorDesc <= 0) {
            return res.status(400).send('El valor del descuento debe ser mayor a 0');
        }

        if (tipo_descuento === 'porcentaje' && (valorDesc < 0 || valorDesc > 100)) {
            return res.status(400).send('El porcentaje debe estar entre 0 y 100');
        }

        // Desactivar ofertas generales anteriores
        await pool.query('UPDATE ofertas_generales SET activo = FALSE WHERE activo = TRUE');

        // Crear nueva oferta general
        await pool.query(`
            INSERT INTO ofertas_generales (nombre, descripcion, tipo_descuento, valor_descuento, fecha_inicio, fecha_fin, activo, categorias_excluidas)
            VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)
        `, [nombre, descripcion || null, tipo_descuento, valorDesc, fecha_inicio, fecha_fin, categoriasExcluidasStr]);

        console.log('✅ Oferta general creada exitosamente');
        res.redirect('/admin/ofertas');
    } catch (err) {
        console.error('❌ Error al crear oferta general:', err);
        res.status(500).send('Error al crear oferta general: ' + err.message);
    }
});

// Toggle oferta general
app.post('/admin/ofertas/general/toggle/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT activo FROM ofertas_generales WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).send('Oferta general no encontrada');
        }
        
        const nuevoEstado = !result.rows[0].activo;
        
        // Si se va a activar, desactivar otras ofertas generales
        if (nuevoEstado) {
            await pool.query('UPDATE ofertas_generales SET activo = FALSE WHERE activo = TRUE');
        }
        
        await pool.query('UPDATE ofertas_generales SET activo = $1 WHERE id = $2', [nuevoEstado, id]);
        console.log(`✅ Oferta general ${id} ${nuevoEstado ? 'ACTIVADA' : 'DESACTIVADA'}`);
        res.redirect('/admin/ofertas');
    } catch (err) {
        console.error('Error al cambiar estado de oferta general:', err);
        res.status(500).send('Error al cambiar estado: ' + err.message);
    }
});

// Editar oferta general
app.post('/admin/ofertas/general/editar/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, tipo_descuento, valor_descuento, fecha_inicio, fecha_fin } = req.body;
    let categoriasExcluidas = req.body.categorias_excluidas || [];
    if (!Array.isArray(categoriasExcluidas)) categoriasExcluidas = [categoriasExcluidas];
    const categoriasExcluidasStr = categoriasExcluidas.join(',');
    try {
        const valorDesc = parseFloat(valor_descuento);
        if (!nombre || !tipo_descuento || !valor_descuento || !fecha_inicio || !fecha_fin) {
            return res.status(400).send('Todos los campos son obligatorios');
        }
        if (valorDesc <= 0) {
            return res.status(400).send('El valor del descuento debe ser mayor a 0');
        }
        if (tipo_descuento === 'porcentaje' && (valorDesc < 0 || valorDesc > 100)) {
            return res.status(400).send('El porcentaje debe estar entre 0 y 100');
        }

        await pool.query(`
            UPDATE ofertas_generales 
            SET nombre = $1, descripcion = $2, tipo_descuento = $3, valor_descuento = $4, 
                fecha_inicio = $5, fecha_fin = $6, categorias_excluidas = $7, updated_at = NOW()
            WHERE id = $8
        `, [nombre, descripcion || null, tipo_descuento, valorDesc, fecha_inicio, fecha_fin, categoriasExcluidasStr, id]);

        console.log(`✅ Oferta general ${id} editada`);
        res.redirect('/admin/ofertas');
    } catch (err) {
        console.error('Error al editar oferta general:', err);
        res.status(500).send('Error al editar oferta general: ' + err.message);
    }
});

// Eliminar oferta general
app.post('/admin/ofertas/general/eliminar/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM ofertas_generales WHERE id = $1', [id]);
        console.log('✅ Oferta general eliminada:', id);
        res.redirect('/admin/ofertas');
    } catch (err) {
        console.error('Error al eliminar oferta general:', err);
        res.status(500).send('Error al eliminar oferta general: ' + err.message);
    }
});

// ==================== RUTAS PARA SISTEMA DE CAJAS ====================

// Ruta principal de CAJAS (solo admin)
app.get('/cajas', requireAdmin, async (req, res) => {
    try {
        const productsResult = await pool.query('SELECT * FROM products ORDER BY name');
        const logoResult = await pool.query('SELECT imagen1, imagen2 FROM imagenes LIMIT 1');
        
        const products = productsResult.rows;
        const images = logoResult.rows[0] || {};
        const logoUrl = images.imagen1 || '/imgs/LogoChip.png';
        const imagen2Url = images.imagen2 || '/imgs/LogoChip.png';

        res.render('cajas', { 
            products, 
            logoUrl, 
            imagen2Url, 
            isAdmin: req.session.isAdmin 
        });
    } catch (err) {
        console.error('Error al cargar sistema de cajas:', err);
        res.status(500).send('Error interno del servidor');
    }
});

// Ruta para el histórico de ventas (solo admin)
app.get('/historico', requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const offset = (page - 1) * limit;

        // Obtener total de registros para paginación
        const countResult = await pool.query('SELECT COUNT(*) FROM facturas');
        const totalRecords = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalRecords / limit);

        // Obtener facturas con información del vendedor
        const facturasResult = await pool.query(`
            SELECT f.*, u.username as vendedor_nombre 
            FROM facturas f 
            LEFT JOIN users u ON f.vendedor_id = u.id 
            ORDER BY f.fecha DESC 
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        const logoResult = await pool.query('SELECT imagen1, imagen2 FROM imagenes LIMIT 1');
        const images = logoResult.rows[0] || {};

        res.render('historico', {
            facturas: facturasResult.rows,
            currentPage: page,
            totalPages,
            totalRecords,
            logoUrl: images.imagen1 || '/imgs/LogoChip.png',
            imagen2Url: images.imagen2 || '/imgs/LogoChip.png',
            isAdmin: req.session.isAdmin
        });
    } catch (err) {
        console.error('Error al cargar histórico:', err);
        res.status(500).send('Error interno del servidor');
    }
});

// Ruta para ver un comprobante específico
app.get('/factura/:id', requireAdmin, async (req, res) => {
    try {
        const facturaId = req.params.id;
        const facturaResult = await pool.query(`
            SELECT f.*, u.username as vendedor_nombre 
            FROM facturas f 
            LEFT JOIN users u ON f.vendedor_id = u.id 
            WHERE f.id = $1
        `, [facturaId]);

        if (facturaResult.rows.length === 0) {
            return res.status(404).send('Comprobante no encontrado');
        }

        const logoResult = await pool.query('SELECT imagen1, imagen2 FROM imagenes LIMIT 1');
        const images = logoResult.rows[0] || {};

        res.render('factura-detalle', {
            factura: facturaResult.rows[0],
            logoUrl: images.imagen1 || '/imgs/LogoChip.png',
            imagen2Url: images.imagen2 || '/imgs/LogoChip.png',
            isAdmin: req.session.isAdmin
        });
    } catch (err) {
        console.error('Error al cargar comprobante:', err);
        res.status(500).send('Error interno del servidor');
    }
});

// Ruta para obtener todos los datos de un producto específico
app.get('/product/:id', async (req, res) => {
    const id = req.params.id;

    try {
        // Obtener cotización del dólar y config de visibilidad
        let cotizacionDolar = 1200;
        let mostrarPrecioPesos = true;
        try {
            const cotizResult = await pool.query("SELECT valor FROM configuracion WHERE clave = 'cotizacion_dolar'");
            if (cotizResult.rows.length > 0) cotizacionDolar = parseFloat(cotizResult.rows[0].valor);
            const mostrarResult = await pool.query("SELECT valor FROM configuracion WHERE clave = 'mostrar_precio_pesos'");
            if (mostrarResult.rows.length > 0) mostrarPrecioPesos = mostrarResult.rows[0].valor === 'true';
        } catch(e) { console.log('Tabla configuracion no existe aún, usando defaults'); }

        const productResult = await pool.query(`
            SELECT p.*, c.nombre as categoria_nombre, c.icono as categoria_icono, c.color as categoria_color, c.cuotas_max, c.interes_cuotas, c.cuotas_planes
            FROM products p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE p.id = $1
        `, [id]);

        if (productResult.rows.length === 0) {
            return res.status(404).send('Producto no encontrado');
        }

        let product = productResult.rows[0];

        // Buscar oferta específica activa para este producto
        const ofertaResult = await pool.query(`
            SELECT 
                o.*,
                p.price as precio_original,
                CASE 
                    WHEN o.tipo_descuento = 'porcentaje' THEN ROUND(p.price * (1 - o.valor_descuento / 100), 2)
                    ELSE GREATEST(ROUND(p.price - o.valor_descuento, 2), 0)
                END as precio_con_descuento
            FROM ofertas o
            JOIN products p ON o.product_id = p.id
            WHERE o.activo = TRUE AND o.product_id = $1
            LIMIT 1
        `, [id]);

        if (ofertaResult.rows.length > 0) {
            const oferta = ofertaResult.rows[0];
            product = {
                ...product,
                oferta_id: oferta.id,
                tipo_descuento: oferta.tipo_descuento,
                valor_descuento: oferta.valor_descuento,
                precio_final: oferta.precio_con_descuento,
                tiene_oferta_vigente: true,
                es_oferta_general: false
            };
        } else {
            // Verificar si hay oferta general activa
            const ofertaGeneralResult = await pool.query(`
                SELECT * FROM ofertas_generales
                WHERE activo = TRUE
                ORDER BY created_at DESC
                LIMIT 1
            `);
            const ofertaGeneral = ofertaGeneralResult.rows[0];
            const categoriasExcluidas = ofertaGeneral && ofertaGeneral.categorias_excluidas
                ? ofertaGeneral.categorias_excluidas.split(',').map(cid => parseInt(cid.trim())).filter(cid => !isNaN(cid))
                : [];

            if (ofertaGeneral && !categoriasExcluidas.includes(product.categoria_id)) {
                const precioConDescuento = ofertaGeneral.tipo_descuento === 'porcentaje'
                    ? Math.round(product.price * (1 - ofertaGeneral.valor_descuento / 100) * 100) / 100
                    : Math.max(Math.round((product.price - ofertaGeneral.valor_descuento) * 100) / 100, 0);
                product = {
                    ...product,
                    oferta_id: `general_${ofertaGeneral.id}`,
                    tipo_descuento: ofertaGeneral.tipo_descuento,
                    valor_descuento: ofertaGeneral.valor_descuento,
                    precio_final: precioConDescuento,
                    tiene_oferta_vigente: true,
                    es_oferta_general: true,
                    nombre_oferta_general: ofertaGeneral.nombre
                };
            } else {
                product = {
                    ...product,
                    tiene_oferta_vigente: false,
                    precio_final: product.price
                };
            }
        }

        res.render('product', { product: {...product, img: optimizeCloudinaryUrl(product.img, 1000)}, isAdmin: req.session.isAdmin, cotizacionDolar, mostrarPrecioPesos });
    } catch (err) {
        console.error('Error al obtener el producto:', err);
        res.status(500).send('Error interno del servidor');
    }
});

// ==================== RUTAS POST ====================

// Ruta POST para redirigir a la hoja de producto
app.post('/product', (req, res) => {
    const { productId } = req.body;

    if (!productId) {
        return res.status(400).send('ID del producto no proporcionado');
    }

    res.redirect(`/product/${productId}`);
});

// Ruta para procesar el formulario de nuevo producto (requiere autenticación de administrador)
app.post('/new', requireAdmin, upload.single('image'), async (req, res) => {
    console.log('=== 🆕 NUEVO PRODUCTO ===');
    console.log('📦 Body recibido:', req.body);
    console.log('🖼️ Archivo recibido:', req.file ? 'SÍ' : 'NO');
    
    const { name, description, price, stock, bateria, almacenamiento, categoria_id, moneda, codigo, aclaracion, folleto_url } = req.body;
    let imageUrl;

    if (req.file) {
        imageUrl = req.file.path;
        console.log('✅ Imagen subida a Cloudinary:', imageUrl);
    } else {
        console.log('⚠️ No se recibió archivo de imagen');
    }

    try {
        console.log('💾 Insertando producto en base de datos...');
        await pool.query(
            'INSERT INTO products (name, description, img, price, stock, bateria, almacenamiento, categoria_id, moneda, codigo, aclaracion, folleto_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)', 
            [name, description, imageUrl, price, stock, bateria || null, almacenamiento || null, categoria_id || null, moneda || 'ARS', codigo || null, aclaracion || null, folleto_url || null]
        );
        console.log('✅ Producto agregado exitosamente');
        res.redirect('/');
    } catch (err) {
        console.error('❌ Error al agregar nuevo producto:', err);
        console.error('   Mensaje:', err.message);
        console.error('   Stack:', err.stack);
        res.status(500).send(`Error al crear producto: ${err.message}`);
    }
});

// ==================== RUTAS POST PARA SISTEMA DE CAJAS ====================

// Procesar nuevo comprobante
app.post('/cajas/procesar-venta', requireAdmin, async (req, res) => {
    console.log('=== DEBUG COMPLETO ===');
    console.log('Content-Type:', req.get('Content-Type'));
    console.log('Body RAW:', req.body);
    console.log('Body stringify:', JSON.stringify(req.body, null, 2));
    console.log('Body keys:', Object.keys(req.body || {}));
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const {
            cliente_nombre,
            cliente_telefono,
            cliente_email,
            items,
            subtotal,
            impuestos,
            total,
            metodo_pago,
            notas,
            afectar_stock = false  // Nuevo parámetro: por defecto NO afecta stock
        } = req.body;

        console.log('=== DATOS EXTRAÍDOS ===');
        console.log('cliente_nombre:', cliente_nombre, typeof cliente_nombre);
        console.log('items:', items, typeof items, Array.isArray(items));
        console.log('subtotal:', subtotal, typeof subtotal);
        console.log('total:', total, typeof total);

        // Validación más específica
        if (!cliente_nombre) {
            console.log('ERROR: cliente_nombre es', cliente_nombre);
            await client.query('ROLLBACK');
            return res.json({
                success: false,
                message: 'El nombre del cliente es requerido - está vacío o undefined'
            });
        }

        if (typeof cliente_nombre === 'string' && cliente_nombre.trim() === '') {
            console.log('ERROR: cliente_nombre es string vacío');
            await client.query('ROLLBACK');
            return res.json({
                success: false,
                message: 'El nombre del cliente es requerido - es string vacío'
            });
        }

        if (!items) {
            console.log('ERROR: items es', items);
            await client.query('ROLLBACK');
            return res.json({
                success: false,
                message: 'Items es undefined o null'
            });
        }

        if (!Array.isArray(items)) {
            console.log('ERROR: items no es array', typeof items);
            await client.query('ROLLBACK');
            return res.json({
                success: false,
                message: 'Items no es un array'
            });
        }

        if (items.length === 0) {
            console.log('ERROR: items array está vacío');
            await client.query('ROLLBACK');
            return res.json({
                success: false,
                message: 'Debe agregar al menos un producto al carrito - array vacío'
            });
        }

        // Generar número de comprobante único más corto
        const fecha = new Date();
        const year = fecha.getFullYear().toString().slice(-2); // Últimos 2 dígitos del año
        const month = (fecha.getMonth() + 1).toString().padStart(2, '0');
        const day = fecha.getDate().toString().padStart(2, '0');
        const random = Math.floor(Math.random() * 999).toString().padStart(3, '0');
        const numeroFactura = `C${year}${month}${day}${random}`; // Formato: C24082200X (10 chars)
        
        console.log('=== PROCESANDO COMPROBANTE ===');
        console.log('Número de comprobante:', numeroFactura);
        console.log('Cliente:', cliente_nombre);
        console.log('Items count:', items.length);
        
        // Insertar factura en la base de datos
        const facturaResult = await client.query(`
            INSERT INTO facturas (
                numero_factura, cliente_nombre, cliente_telefono, cliente_email,
                items, subtotal, impuestos, total, metodo_pago, vendedor_id, notas, estado
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id, numero_factura
        `, [
            numeroFactura,
            cliente_nombre.trim(),
            cliente_telefono || null,
            cliente_email || null,
            JSON.stringify(items),
            parseFloat(subtotal || 0),
            parseFloat(impuestos || 0),
            parseFloat(total || 0),
            metodo_pago || 'efectivo',
            req.session.userId || 1,
            notas || null,
            'completada'
        ]);

        const factura = facturaResult.rows[0];
        console.log('Factura creada exitosamente:', factura);

        // Actualizar stock de productos solo si afectar_stock es true
        if (afectar_stock) {
            console.log('=== ACTUALIZANDO STOCK (afectar_stock = true) ===');
            for (let item of items) {
                console.log('Actualizando stock - Producto ID:', item.product_id, 'Cantidad:', item.cantidad);
                await client.query(
                    'UPDATE products SET stock = stock - $1 WHERE id = $2',
                    [item.cantidad, item.product_id]
                );
            }
        } else {
            console.log('=== STOCK NO AFECTADO (afectar_stock = false) ===');
        }

        await client.query('COMMIT');
        console.log('=== TRANSACCIÓN COMPLETADA ===');
        
        res.json({
            success: true,
            facturaId: factura.id,
            numeroFactura: factura.numero_factura,
            message: 'Venta procesada exitosamente'
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('=== ERROR EN PROCESAR VENTA ===');
        console.error('Tipo de error:', err.name);
        console.error('Mensaje:', err.message);
        console.error('Stack completo:', err.stack);
        res.status(500).json({ 
            success: false, 
            message: 'Error al procesar la venta: ' + err.message 
        });
    } finally {
        client.release();
    }
});

// Generar página para imprimir (sin PDF)
app.get('/factura/:id/pdf', requireAdmin, async (req, res) => {
    try {
        const facturaId = req.params.id;
        
        const facturaResult = await pool.query(`
            SELECT f.*, u.username as vendedor_nombre 
            FROM facturas f 
            LEFT JOIN users u ON f.vendedor_id = u.id 
            WHERE f.id = $1
        `, [facturaId]);

        if (facturaResult.rows.length === 0) {
            return res.status(404).send('Comprobante no encontrado');
        }

        const factura = facturaResult.rows[0];
        const logoResult = await pool.query('SELECT imagen1 FROM imagenes LIMIT 1');
        const logoUrl = logoResult.rows[0]?.imagen1 || '';

        // Parse items
        let items = [];
        try {
            if (typeof factura.items === 'string') {
                items = JSON.parse(factura.items);
            } else if (Array.isArray(factura.items)) {
                items = factura.items;
            } else if (factura.items && typeof factura.items === 'object') {
                items = [factura.items];
            }
        } catch (error) {
            console.error('Error parsing items:', error);
        }

        // Generar HTML simple para imprimir
        const fecha = new Date(factura.fecha).toLocaleDateString('es-ES');
        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Comprobante ${factura.numero_factura}</title>
    <style>
        @media print {
            body { margin: 0; }
            .no-print { display: none; }
        }
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; }
        .info { margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #000; padding: 8px; text-align: left; }
        th { background: #f0f0f0; }
        .totals { text-align: right; margin-top: 20px; }
        .total { font-size: 18px; font-weight: bold; }
        .print-btn { background: #007bff; color: white; padding: 10px 20px; border: none; cursor: pointer; margin: 10px; }
    </style>
</head>
<body>
    <div class="no-print">
        <button class="print-btn" onclick="window.print()">🖨️ IMPRIMIR (Ctrl+P)</button>
        <button class="print-btn" onclick="window.close()">❌ CERRAR</button>
    </div>
    
    <div class="header">
        <h1>COMPROBANTE</h1>
        <p><strong>N°:</strong> ${factura.numero_factura}</p>
        <p><strong>Fecha:</strong> ${fecha}</p>
    </div>
    
    <div class="info">
        <h3>CLIENTE:</h3>
        <p><strong>Nombre:</strong> ${factura.cliente_nombre}</p>
        ${factura.cliente_telefono ? `<p><strong>Teléfono:</strong> ${factura.cliente_telefono}</p>` : ''}
        ${factura.cliente_email ? `<p><strong>Email:</strong> ${factura.cliente_email}</p>` : ''}
        <p><strong>Pago:</strong> ${factura.metodo_pago || 'Efectivo'}</p>
    </div>
    
    <table>
        <tr>
            <th>Producto</th>
            <th>Cant.</th>
            <th>Precio</th>
            <th>Total</th>
        </tr>
        ${items.map(item => `
        <tr>
            <td>${item.name || 'Producto'}</td>
            <td>${item.cantidad || 1}</td>
            <td>$${(item.price || 0).toLocaleString()}</td>
            <td>$${((item.price || 0) * (item.cantidad || 1)).toLocaleString()}</td>
        </tr>
        `).join('')}
    </table>
    
    <div class="totals">
        <p><strong>Subtotal: $${parseFloat(factura.subtotal || 0).toLocaleString()}</strong></p>
        <p><strong>Impuestos: $${parseFloat(factura.impuestos || 0).toLocaleString()}</strong></p>
        <p class="total">TOTAL: $${parseFloat(factura.total || 0).toLocaleString()}</p>
    </div>
    
    ${factura.notas ? `<div class="info"><h3>NOTAS:</h3><p>${factura.notas}</p></div>` : ''}
    
    <div style="text-align: center; margin-top: 30px;">
        <p><strong>¡Gracias por su compra!</strong></p>
        <p>iPhone Stock - Vendedor: ${factura.vendedor_nombre || 'Sistema'}</p>
    </div>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);

    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// Búsqueda de comprobantes
app.get('/api/facturas/search', requireAdmin, async (req, res) => {
    try {
        const { q, fecha_desde, fecha_hasta } = req.query;
        let query = `
            SELECT f.*, u.username as vendedor_nombre 
            FROM facturas f 
            LEFT JOIN users u ON f.vendedor_id = u.id 
            WHERE 1=1
        `;
        let params = [];
        let paramCount = 0;

        if (q) {
            paramCount++;
            query += ` AND (f.numero_factura ILIKE $${paramCount} OR f.cliente_nombre ILIKE $${paramCount})`;
            params.push(`%${q}%`);
        }

        if (fecha_desde) {
            paramCount++;
            query += ` AND f.fecha >= $${paramCount}`;
            params.push(fecha_desde);
        }

        if (fecha_hasta) {
            paramCount++;
            query += ` AND f.fecha <= $${paramCount}`;
            params.push(fecha_hasta + ' 23:59:59');
        }

        query += ' ORDER BY f.fecha DESC LIMIT 50';

        const result = await pool.query(query, params);
        res.json(result.rows);

    } catch (err) {
        console.error('Error en búsqueda:', err);
        res.status(500).json({ error: 'Error en la búsqueda' });
    }
});

// Ruta para procesar el formulario de inicio de sesión
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    pool.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password], (err, result) => {
        if (err) {
            console.error('Error al buscar usuario:', err);
            res.status(500).send('Error interno del servidor');
            return;
        }
        if (result.rows.length > 0) {
            const user = result.rows[0];
            req.session.userId = user.id;
            req.session.isAdmin = user.isadmin;
            res.redirect('/');
        } else {
            req.session.error = 'Credenciales incorrectas'; // Guardar el mensaje de error en la sesión
            res.redirect('/login'); // Redirigir al usuario a la página de inicio de sesión
        }
    });
});

// Procesar el edit-about
app.post('/edit-about', requireAdmin, upload.single('imagen'), async (req, res) => {
    const { titulo, texto } = req.body;
    let imagen = req.body.imagen; // Mantener la URL de la imagen existente.

    // Si se carga una nueva imagen, actualizar con la nueva URL.
    if (req.file) {
        imagen = req.file.path;
    }

    try {
        // Actualiza los campos en la base de datos.
        await pool.query('UPDATE about SET titulo = $1, texto = $2, imagen = $3 WHERE id = $4', [titulo, texto, imagen, 1]);
        res.redirect('/');
    } catch (err) {
        console.error('Error al actualizar contenido de about:', err);
        res.status(500).send('Error interno del servidor');
    }
});

// Ruta para procesar la edición de un producto (requiere autenticación de administrador)
app.post('/edit/:id', requireAdmin, upload.single('image'), async (req, res) => {
    const id = req.params.id;
    const { name, description, price, stock, bateria, almacenamiento, categoria_id, moneda, codigo, aclaracion, folleto_url } = req.body;
    let imageUrl = req.body.image; // Mantener la URL actual de la imagen

    if (req.file) {
        imageUrl = req.file.path; // Si se carga una nueva imagen, usar la URL de Cloudinary
    }

    try {
        await pool.query(
            'UPDATE products SET name = $1, description = $2, img = $3, price = $4, stock = $5, bateria = $6, almacenamiento = $7, categoria_id = $8, moneda = $9, codigo = $10, aclaracion = $11, folleto_url = $12 WHERE id = $13',
            [name, description, imageUrl, price, stock, bateria || null, almacenamiento || null, categoria_id || null, moneda || 'ARS', codigo || null, aclaracion || null, folleto_url || null, id]
        );
        res.redirect('/');
    } catch (err) {
        console.error('Error al actualizar producto:', err);
        res.status(500).send('Error interno del servidor');
    }
});

// Ruta para manejar la compra de productos
app.post('/buy/:id', (req, res) => {
    const id = req.params.id;
    pool.query('SELECT * FROM products WHERE id = $1', [id], (err, result) => {
        if (err) {
            console.error('Error al obtener producto para compra:', err);
            res.status(500).send('Error interno del servidor');
            return;
        }
        const product = result.rows[0];
        if (product.stock > 0) {
            // Generar el mensaje con solo el nombre del modelo, precio y porcentaje de batería
            const message = `Solicitud de compra:\n\nModelo: ${product.name}\nPrecio: $${product.price}\nBatería: ${product.bateria}%`;

            // Crear la URL de WhatsApp con el mensaje generado
            const whatsappUrl = `https://wa.me/${process.env.MY_PHONE_NUMBER}?text=${encodeURIComponent(message)}`;
            
            // Redirigir al usuario a WhatsApp con el mensaje prellenado
            res.redirect(whatsappUrl);
        } else {
            // Mostrar mensaje de error si el producto no tiene stock
            res.redirect('/cart');
        }
    });
});

// Ruta para eliminar un producto (requiere autenticación de administrador)
app.post('/delete/:id', requireAdmin, async (req, res) => {
    const id = req.params.id;
    try {
        // Eliminar registros dependientes primero para evitar errores de foreign key
        // Usamos try/catch individual por si alguna tabla no existe
        try { await pool.query('DELETE FROM stock_historial WHERE product_id = $1', [id]); } catch(e) { /* tabla puede no existir */ }
        try { await pool.query('DELETE FROM carrito_items WHERE product_id = $1', [id]); } catch(e) { /* tabla puede no existir */ }
        try { await pool.query('DELETE FROM ofertas WHERE product_id = $1', [id]); } catch(e) { /* tabla puede no existir */ }
        
        await pool.query('DELETE FROM products WHERE id = $1', [id]);
        res.redirect('/');
    } catch (err) {
        console.error('Error al eliminar producto:', err);
        res.status(500).send('Error al eliminar producto: ' + err.message);
    }
});

// Ruta para editar la imagen del hero (reutilizando sistema del carrusel)
app.post('/edit-hero', requireAdmin, upload.single('image'), async (req, res) => {
    let imageUrl;

    try {
        // Consultar la imagen actual de imagen2
        const currentImageQuery = await pool.query('SELECT imagen2 FROM imagenes WHERE id = 1');

        // Verificar si se encontró un registro
        if (currentImageQuery.rows.length === 0) {
            return res.status(404).send('Registro de imágenes no encontrado');
        }

        const currentImage = currentImageQuery.rows[0].imagen2;

        // Si se subió una nueva imagen, eliminar la existente y guardar la nueva
        if (req.file) {
            if (currentImage) {
                const publicId = currentImage.split('/').pop().split('.')[0]; // Obtener el public_id de Cloudinary
                await cloudinary.uploader.destroy(publicId); // Eliminar la imagen de Cloudinary
            }
            imageUrl = req.file.path;  // Guardar la URL de la nueva imagen
        } else {
            imageUrl = currentImage; // Mantener la imagen existente si no se sube una nueva
        }

        // Actualizar el registro en la base de datos
        await pool.query(
            'UPDATE imagenes SET imagen2 = $1 WHERE id = 1',
            [imageUrl]
        );

        res.redirect('/edit-hero');
    } catch (err) {
        console.error('Error al actualizar imagen del hero:', err);
        res.status(500).send('Error interno del servidor');
    }
});

// Ruta para editar y agregar elementos al carrusel (requiere autenticación de administrador)
app.post('/edit-carousel', requireAdmin, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'mobileImage', maxCount: 1 }]), async (req, res) => {
    const { id, text, color1, color2 } = req.body;
    let imageUrl;
    let mobileImageUrl;

    try {
        // Verificar si el ID es válido
        if (!id) {
            return res.status(400).send('ID inválido');
        }

        // Consultar las imágenes actuales para manejar el caso donde se suben nuevas imágenes
        const currentImagesQuery = await pool.query('SELECT img, imagenMobile FROM carousel WHERE id = $1', [id]);

        // Verificar si se encontró un registro
        if (currentImagesQuery.rows.length === 0) {
            return res.status(404).send('Elemento no encontrado');
        }

        const currentImages = currentImagesQuery.rows[0];

        // Si se subió una nueva imagen normal, eliminar la existente y guardar la nueva
        if (req.files['image']) {
            if (currentImages.img) {
                const publicId = currentImages.img.split('/').pop().split('.')[0]; // Obtener el public_id de Cloudinary
                await cloudinary.uploader.destroy(publicId); // Eliminar la imagen de Cloudinary
            }
            imageUrl = req.files['image'][0].path;  // Guardar la URL de la nueva imagen
        } else {
            imageUrl = currentImages.img; // Mantener la imagen existente si no se sube una nueva
        }

        // Si se subió una nueva imagen móvil, eliminar la existente y guardar la nueva
        if (req.files['mobileImage']) {
            if (currentImages.imagenmobile) {
                const publicId = currentImages.imagenmobile.split('/').pop().split('.')[0]; // Obtener el public_id de Cloudinary
                await cloudinary.uploader.destroy(publicId); // Eliminar la imagen móvil de Cloudinary
            }
            mobileImageUrl = req.files['mobileImage'][0].path;  // Guardar la URL de la nueva imagen móvil
        } else {
            mobileImageUrl = currentImages.imagenmobile; // Mantener la imagen existente si no se sube una nueva
        }

        // Actualizar el registro en la base de datos
        await pool.query(
            'UPDATE carousel SET text = $1, img = $2, imagenMobile = $3, color1 = $4, color2 = $5 WHERE id = $6',
            [text, imageUrl, mobileImageUrl, color1, color2, id]
        );

        res.redirect('/edit-carousel');
    } catch (err) {
        console.error('Error al actualizar el carrusel:', err);
        res.status(500).send('Error interno del servidor');
    }
});

// Ruta para eliminar un elemento del carrusel
app.post('/delete-carousel', requireAdmin, async (req, res) => {
    const { id } = req.body;
    try {
        await pool.query('DELETE FROM carousel WHERE id = $1', [id]);
        res.redirect('/edit-carousel');
    } catch (err) {
        console.error('Error al eliminar elemento del carrusel:', err);
        res.status(500).send('Error interno del servidor');
    }
});

// Ruta para manejar la actualización de las URLs de las imágenes
app.post('/edit-images', requireAdmin, async (req, res) => {
    const { imagen1, imagen2 } = req.body;
    try {
        await pool.query('UPDATE imagenes SET imagen1 = $1, imagen2 = $2 WHERE id = $3', [imagen1, imagen2, 1]);
        res.redirect('/');
    } catch (err) {
        console.error('Error al actualizar URLs de las imágenes:', err);
        res.status(500).send('Error interno del servidor');
    }
});

// Ruta para agregar un nuevo elemento al carrusel
app.post('/add-carousel', requireAdmin, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'mobileImage', maxCount: 1 }]), async (req, res) => {
    const { text, color1, color2 } = req.body;
    let imageUrl;
    let mobileImageUrl;

    try {
        if (req.files['image']) {
            imageUrl = req.files['image'][0].path; // Guardar la URL de la nueva imagen
        }
        if (req.files['mobileImage']) {
            mobileImageUrl = req.files['mobileImage'][0].path; // Guardar la URL de la nueva imagen móvil
        }

        // Insertar el nuevo elemento en la base de datos
        await pool.query(
            'INSERT INTO carousel (text, img, imagenMobile, color1, color2) VALUES ($1, $2, $3, $4, $5)',
            [text, imageUrl, mobileImageUrl, color1, color2]
        );

        res.redirect('/edit-carousel');
    } catch (err) {
        console.error('Error al agregar el nuevo elemento al carrusel:', err);
        res.status(500).send('Error interno del servidor');
    }
});

// ==================== FUNCIONES AUXILIARES ====================

// Función simple para generar PDF rápido
function generateSimplePDF(factura, logoUrl) {
    let items = [];
    try {
        if (typeof factura.items === 'string') {
            items = JSON.parse(factura.items);
        } else if (Array.isArray(factura.items)) {
            items = factura.items;
        } else if (factura.items) {
            items = [factura.items];
        }
    } catch (error) {
        items = [];
    }
    
    const fecha = new Date(factura.fecha).toLocaleDateString('es-ES');
    
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Comprobante</title>
    <style>
        body { font-family: Arial; margin: 20px; }
        .header { border-bottom: 2px solid #007bff; padding-bottom: 10px; margin-bottom: 20px; }
        .title { color: #007bff; text-align: center; margin: 0; }
        .info { margin: 10px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 8px; border: 1px solid #ddd; text-align: left; }
        th { background: #007bff; color: white; }
        .total { background: #f8f9fa; padding: 15px; text-align: right; margin-top: 20px; }
        .footer { text-align: center; margin-top: 30px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <h1 class="title">COMPROBANTE ${factura.numero_factura}</h1>
        <div class="info">
            <strong>Fecha:</strong> ${fecha}<br>
            <strong>Cliente:</strong> ${factura.cliente_nombre}<br>
            ${factura.cliente_telefono ? `<strong>Teléfono:</strong> ${factura.cliente_telefono}<br>` : ''}
            <strong>Pago:</strong> ${factura.metodo_pago || 'Efectivo'}
        </div>
    </div>
    
    <table>
        <tr>
            <th>Producto</th>
            <th>Cant.</th>
            <th>Precio</th>
            <th>Total</th>
        </tr>
        ${items.map(item => `
        <tr>
            <td>${item.name || 'Producto'}</td>
            <td>${item.cantidad || 1}</td>
            <td>$${parseFloat(item.price || 0).toLocaleString('es-ES')}</td>
            <td>$${(parseFloat(item.price || 0) * (item.cantidad || 1)).toLocaleString('es-ES')}</td>
        </tr>
        `).join('')}
    </table>
    
    <div class="total">
        <strong>TOTAL: $${parseFloat(factura.total || 0).toLocaleString('es-ES')}</strong>
    </div>
    
    <div class="footer">
        <p>iPhone Stock - Gracias por su compra</p>
        <p>Vendedor: ${factura.vendedor_nombre || 'Sistema'}</p>
    </div>
</body>
</html>`;
}

// Función para generar HTML de factura para PDF
function generateInvoiceHTML(factura, logoUrl) {
    let items = [];
    
    // Manejar diferentes formatos de items
    try {
        if (typeof factura.items === 'string') {
            items = JSON.parse(factura.items);
        } else if (Array.isArray(factura.items)) {
            items = factura.items;
        } else if (factura.items && typeof factura.items === 'object') {
            items = [factura.items];
        }
        
        if (!Array.isArray(items)) {
            items = [];
        }
    } catch (error) {
        console.error('Error parsing items for PDF:', error);
        items = [];
    }
    
    const fecha = new Date(factura.fecha).toLocaleDateString('es-ES');
    const itemsRows = items.map(item => {
        const precio = parseFloat(item.price || 0);
        const cantidad = parseInt(item.cantidad || 1);
        const subtotal = precio * cantidad;
        return `
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${item.name || 'Producto'}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${cantidad}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">$${precio.toLocaleString('es-ES', {minimumFractionDigits: 2})}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">$${subtotal.toLocaleString('es-ES', {minimumFractionDigits: 2})}</td>
            </tr>`;
    }).join('');
    
    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Comprobante ${factura.numero_factura}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
        .header { display: flex; justify-content: space-between; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #007bff; }
        .logo { max-height: 50px; }
        .invoice-info { text-align: right; }
        .invoice-info h1 { color: #007bff; margin: 0; }
        .customer-section { background: #f8f9fa; padding: 15px; margin: 15px 0; }
        .customer-section h3 { color: #007bff; margin: 0 0 10px 0; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th { background: #007bff; color: white; padding: 8px; text-align: left; }
        td { padding: 8px; border: 1px solid #ddd; }
        tr:nth-child(even) { background: #f9f9f9; }
        .totals { background: #f8f9fa; padding: 15px; margin-top: 20px; }
        .totals table { margin: 0; }
        .total-row { font-weight: bold; color: #007bff; font-size: 16px; }
        .footer { text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; color: #666; }
        .notes { background: #fff3cd; padding: 15px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="header">
        <div>${logoUrl ? `<img src="${logoUrl}" alt="iPhone Stock" class="logo">` : '<div style="font-size: 18px; font-weight: bold; color: #007bff;">iPhone Stock</div>'}</div>
        <div class="invoice-info">
            <h1>COMPROBANTE</h1>
            <p><strong>N°:</strong> ${factura.numero_factura}</p>
            <p><strong>Fecha:</strong> ${fecha}</p>
        </div>
    </div>
    
    <div class="customer-section">
        <h3>Información del Cliente</h3>
        <p><strong>Nombre:</strong> ${factura.cliente_nombre}</p>
        ${factura.cliente_telefono ? `<p><strong>Teléfono:</strong> ${factura.cliente_telefono}</p>` : ''}
        ${factura.cliente_email ? `<p><strong>Email:</strong> ${factura.cliente_email}</p>` : ''}
        <p><strong>Método de Pago:</strong> ${factura.metodo_pago || 'Efectivo'}</p>
    </div>
    
    <h3 style="color: #007bff;">Productos</h3>
    <table>
        <thead>
            <tr>
                <th style="width: 50%;">Producto</th>
                <th style="width: 15%;">Cantidad</th>
                <th style="width: 20%;">Precio Unit.</th>
                <th style="width: 15%;">Subtotal</th>
            </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
    </table>
    
    <div class="totals">
        <table style="width: 300px; margin-left: auto;">
            <tr>
                <td>Subtotal:</td>
                <td style="text-align: right;">$${parseFloat(factura.subtotal || 0).toLocaleString('es-ES', {minimumFractionDigits: 2})}</td>
            </tr>
            <tr>
                <td>Impuestos:</td>
                <td style="text-align: right;">$${parseFloat(factura.impuestos || 0).toLocaleString('es-ES', {minimumFractionDigits: 2})}</td>
            </tr>
            <tr class="total-row">
                <td><strong>TOTAL:</strong></td>
                <td style="text-align: right;"><strong>$${parseFloat(factura.total || 0).toLocaleString('es-ES', {minimumFractionDigits: 2})}</strong></td>
            </tr>
        </table>
    </div>
    
    ${factura.notas ? `<div class="notes"><h4>Notas:</h4><p>${factura.notas}</p></div>` : ''}
    
    <div class="footer">
        <p><strong>¡Gracias por su compra!</strong></p>
        <p>Vendedor: ${factura.vendedor_nombre || 'Sistema'}</p>
        <p>iPhone Stock - Sistema de Comprobantes</p>
    </div>
</body>
</html>`;
}

// Endpoint para sitemap.xml dinámico
app.get('/sitemap.xml', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name, updated_at FROM productos WHERE stock > 0 ORDER BY id');
        const products = result.rows;
        const baseUrl = process.env.BASE_URL || 'https://metalce.com.ar';
        const currentDate = new Date().toISOString().split('T')[0];

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">

  <!-- Página principal -->
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>

  <!-- Catálogo de productos -->
  <url>
    <loc>${baseUrl}/cart</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>

  <!-- Productos disponibles -->
`;

        products.forEach(product => {
            const lastmod = product.updated_at ? new Date(product.updated_at).toISOString().split('T')[0] : currentDate;
            xml += `  <url>
    <loc>${baseUrl}/product/${product.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;
        });

        xml += `</urlset>`;

        res.header('Content-Type', 'application/xml');
        res.send(xml);
    } catch (error) {
        console.error('Error generando sitemap:', error);
        res.status(500).send('Error generando sitemap');
    }
});

// Endpoint para robots.txt dinámico
app.get('/robots.txt', (req, res) => {
    const baseUrl = process.env.BASE_URL || 'https://metalce.com.ar';
    const robotsTxt = `# robots.txt para Metal-Ce - Distribuidor de metales en Córdoba, Argentina

User-agent: *
Allow: /
Allow: /cart
Allow: /product/*

# Bloquear rutas administrativas
Disallow: /login
Disallow: /logout
Disallow: /cajas
Disallow: /historico
Disallow: /factura/*
Disallow: /edit/*
Disallow: /edit-carousel
Disallow: /edit-images
Disallow: /edit-about
Disallow: /new
Disallow: /delete/*
Disallow: /buy/*
Disallow: /api/*

# Bloquear archivos y carpetas innecesarias
Disallow: /wp-admin/
Disallow: /wp-includes/
Disallow: /wp-login.php
Disallow: /cgi-bin/

# Archivos de configuración
Disallow: /*.json$
Disallow: /*.sql$
Disallow: /*.env$

# Sitemap
Sitemap: ${baseUrl}/sitemap.xml
`;

    res.header('Content-Type', 'text/plain');
    res.send(robotsTxt);
});

// ==================== RUTAS DE COTIZACIÓN DEL DÓLAR ====================

// Página de administración de cotización
app.get('/admin/cotizacion', requireAdmin, async (req, res) => {
    try {
        let cotizacionDolar = 1200;
        let mostrarPrecioPesos = true;
        let pixelId = '';
        
        const cotizResult = await pool.query("SELECT valor FROM configuracion WHERE clave = 'cotizacion_dolar'");
        if (cotizResult.rows.length > 0) cotizacionDolar = parseFloat(cotizResult.rows[0].valor);
        
        const mostrarResult = await pool.query("SELECT valor FROM configuracion WHERE clave = 'mostrar_precio_pesos'");
        if (mostrarResult.rows.length > 0) mostrarPrecioPesos = mostrarResult.rows[0].valor === 'true';
        
        const pixelResult = await pool.query("SELECT valor FROM configuracion WHERE clave = 'pixel_id'");
        if (pixelResult.rows.length > 0) pixelId = pixelResult.rows[0].valor || '';
        
        res.render('cotizacion', { 
            isAdmin: req.session.isAdmin, 
            cotizacionDolar, 
            mostrarPrecioPesos,
            pixelId
        });
    } catch (err) {
        console.error('Error al obtener cotización:', err);
        res.status(500).send('Error al cargar la página de cotización');
    }
});

// Guardar cotización del dólar
app.post('/admin/cotizacion', requireAdmin, async (req, res) => {
    const { cotizacion, mostrar_pesos, pixel_id } = req.body;
    try {
        // Actualizar cotización
        await pool.query(`
            INSERT INTO configuracion (clave, valor, updated_at) VALUES ('cotizacion_dolar', $1, CURRENT_TIMESTAMP)
            ON CONFLICT (clave) DO UPDATE SET valor = $1, updated_at = CURRENT_TIMESTAMP
        `, [cotizacion]);
        
        // Actualizar toggle de mostrar conversión
        const mostrarValue = mostrar_pesos === 'on' ? 'true' : 'false';
        await pool.query(`
            INSERT INTO configuracion (clave, valor, updated_at) VALUES ('mostrar_precio_pesos', $1, CURRENT_TIMESTAMP)
            ON CONFLICT (clave) DO UPDATE SET valor = $1, updated_at = CURRENT_TIMESTAMP
        `, [mostrarValue]);
        
        // Actualizar Pixel ID
        const pixelValue = pixel_id ? pixel_id.trim() : '';
        await pool.query(`
            INSERT INTO configuracion (clave, valor, updated_at) VALUES ('pixel_id', $1, CURRENT_TIMESTAMP)
            ON CONFLICT (clave) DO UPDATE SET valor = $1, updated_at = CURRENT_TIMESTAMP
        `, [pixelValue]);
        
        console.log(`💲 Cotización actualizada: $${cotizacion} | Mostrar conversión: ${mostrarValue} | Pixel ID: ${pixelValue || 'no configurado'}`);
        res.redirect('/admin/cotizacion');
    } catch (err) {
        console.error('Error al actualizar cotización:', err);
        res.status(500).send('Error al actualizar la cotización');
    }
});

// API para obtener cotización actual
app.get('/api/cotizacion', async (req, res) => {
    try {
        const result = await pool.query("SELECT valor FROM configuracion WHERE clave = 'cotizacion_dolar'");
        const cotizacion = result.rows.length > 0 ? parseFloat(result.rows[0].valor) : 1200;
        res.json({ cotizacion });
    } catch (err) {
        console.error('Error al obtener cotización:', err);
        res.json({ cotizacion: 1200 });
    }
});

// ==================== RUTAS DE PEDIDOS ====================

// Ver todos los pedidos (solo admin)
app.get('/pedidos', requireAdmin, async (req, res) => {
    try {
        const filtroEstado = req.query.estado || '';
        
        let query = 'SELECT * FROM pedidos';
        let params = [];
        
        if (filtroEstado) {
            query += ' WHERE estado = $1';
            params.push(filtroEstado);
        }
        
        query += ' ORDER BY created_at DESC';
        
        const result = await pool.query(query, params);
        
        // Calcular estadísticas
        const statsResult = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE estado = 'pendiente') as pendientes,
                COUNT(*) FILTER (WHERE estado = 'procesando') as procesando,
                COUNT(*) FILTER (WHERE estado = 'completado') as completados
            FROM pedidos
        `);
        
        const stats = statsResult.rows[0];
        
        res.render('pedidos', {
            isAdmin: true,
            pedidos: result.rows,
            stats: stats,
            filtroEstado: filtroEstado
        });
    } catch (err) {
        console.error('Error al obtener pedidos:', err);
        res.status(500).send('Error al cargar pedidos');
    }
});

// Cambiar estado de pedido
app.post('/pedidos/:id/estado', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { estado } = req.body;
        
        await pool.query(
            'UPDATE pedidos SET estado = $1, fecha_actualizacion = NOW() WHERE id = $2',
            [estado, id]
        );
        
        res.redirect('/pedidos');
    } catch (err) {
        console.error('Error al actualizar estado:', err);
        res.status(500).send('Error al actualizar pedido');
    }
});

// Crear pedido desde checkout
app.post('/checkout/create-order', async (req, res) => {
    try {
        const { cliente_nombre, cliente_telefono, cliente_email, cliente_direccion, notas } = req.body;
        
        console.log('📦 Creando pedido para:', cliente_nombre);
        
        // Obtener sessionId del carrito
        const sessionId = req.session?.id;
        const userId = req.session?.userId || null;
        
        if (!sessionId) {
            console.error('❌ No hay sesión activa');
            return res.status(400).json({ exito: false, mensaje: 'No se encontró la sesión' });
        }
        
        console.log('🛒 Buscando carrito para sesión:', sessionId);
        
        // Obtener carrito del usuario usando session_id
        const carritoQuery = await pool.query(
            `SELECT c.id as carrito_id, c.user_id,
                    COALESCE(json_agg(
                        json_build_object(
                            'id', ci.id,
                            'producto_id', ci.product_id,
                            'name', p.name,
                            'precio_unitario', ci.precio_unitario,
                            'cantidad', ci.cantidad,
                            'img', p.img
                        ) ORDER BY ci.id
                    ) FILTER (WHERE ci.id IS NOT NULL), '[]') as items
             FROM carritos c
             LEFT JOIN carrito_items ci ON c.id = ci.carrito_id
             LEFT JOIN products p ON ci.product_id = p.id
             WHERE c.session_id = $1
             GROUP BY c.id`,
            [sessionId]
        );
        
        console.log('📋 Resultado query:', carritoQuery.rows.length, 'filas');
        
        if (carritoQuery.rows.length === 0) {
            console.error('❌ Carrito no encontrado en BD');
            return res.status(400).json({ exito: false, mensaje: 'Carrito no encontrado' });
        }
        
        const carrito = carritoQuery.rows[0];
        const items = carrito.items;
        
        console.log('📦 Items en carrito:', items);
        
        if (!items || items === '[]' || items.length === 0) {
            console.error('❌ Carrito vacío');
            return res.status(400).json({ exito: false, mensaje: 'El carrito está vacío' });
        }
        
        // Calcular total
        const total = items.reduce((sum, item) => 
            sum + (parseFloat(item.precio_unitario) * item.cantidad), 0
        );
        
        console.log('💰 Total calculado:', total);
        
        // Generar número de pedido único
        const numeroPedido = `MC${Date.now()}`;
        
        console.log('🔢 Número de pedido:', numeroPedido);
        
        // Insertar pedido
        const result = await pool.query(
            `INSERT INTO pedidos 
             (numero_pedido, cliente_nombre, cliente_telefono, cliente_email, cliente_direccion, 
              items, subtotal, total, metodo_pago, notas, estado) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [numeroPedido, cliente_nombre, cliente_telefono, cliente_email || null, 
             cliente_direccion || null, JSON.stringify(items), total, total, 
             'efectivo', notas || null, 'pendiente']
        );
        
        console.log('✅ Pedido creado:', result.rows[0].id);
        
        // Vaciar carrito después de crear el pedido
        await pool.query('DELETE FROM carrito_items WHERE carrito_id = $1', [carrito.carrito_id]);
        
        console.log('🗑️ Carrito vaciado');
        
        res.json({ 
            exito: true, 
            pedido: result.rows[0],
            mensaje: 'Pedido creado exitosamente' 
        });
    } catch (err) {
        console.error('❌ Error al crear pedido:', err.message);
        console.error('Stack:', err.stack);
        res.status(500).json({ exito: false, mensaje: 'Error al crear el pedido: ' + err.message });
    }
});

// ==================== FIN RUTAS DE PEDIDOS ====================

// ==================== PÁGINAS INSTITUCIONALES ====================
app.get('/quienes-somos', (req, res) => {
    res.render('quienes-somos', { isAdmin: req.session.isAdmin || false });
});

app.get('/historia', (req, res) => {
    res.render('historia', { isAdmin: req.session.isAdmin || false });
});

app.get('/linea-verde', (req, res) => {
    res.render('linea-verde', { isAdmin: req.session.isAdmin || false });
});

app.get('/iso', (req, res) => {
    res.render('iso', { isAdmin: req.session.isAdmin || false });
});

app.get('/calidad', (req, res) => {
    res.render('calidad', { isAdmin: req.session.isAdmin || false });
});

app.get('/novedades', (req, res) => {
    res.render('novedades', { isAdmin: req.session.isAdmin || false });
});
// ==================== FIN PÁGINAS INSTITUCIONALES ====================

// ==================== CATÁLOGO DESCARGABLE XLSX ====================
app.get('/catalogo/descargar', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.id, p.codigo, p.name, p.description, p.price, p.moneda, p.stock,
                   p.bateria, p.almacenamiento, c.nombre AS categoria
            FROM products p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            ORDER BY c.nombre NULLS LAST, p.name
        `);

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Metal-Ce';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet('Catálogo Metal-Ce', {
            pageSetup: { paperSize: 9, orientation: 'landscape' }
        });

        // Header con logo/marca
        sheet.mergeCells('A1:J1');
        const titleCell = sheet.getCell('A1');
        titleCell.value = 'METAL-CE — Catálogo de Productos';
        titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B1538' } };
        sheet.getRow(1).height = 36;

        // Fecha generación
        sheet.mergeCells('A2:J2');
        const dateCell = sheet.getCell('A2');
        dateCell.value = `Generado el ${new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}`;
        dateCell.font = { size: 10, italic: true, color: { argb: 'FF555555' } };
        dateCell.alignment = { horizontal: 'center' };
        sheet.getRow(2).height = 20;

        // Fila vacía
        sheet.addRow([]);

        // Columnas
        const headers = ['#', 'Código', 'Producto', 'Descripción', 'Categoría', 'Precio', 'Moneda', 'Stock', 'Batería', 'Almacenamiento'];
        const headerRow = sheet.addRow(headers);
        headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA91D47' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = { bottom: { style: 'medium', color: { argb: 'FF6B0F2A' } } };
        });
        sheet.getRow(4).height = 28;

        // Anchos
        sheet.columns = [
            { key: 'id', width: 6 },
            { key: 'codigo', width: 14 },
            { key: 'name', width: 30 },
            { key: 'description', width: 40 },
            { key: 'categoria', width: 18 },
            { key: 'price', width: 12 },
            { key: 'moneda', width: 8 },
            { key: 'stock', width: 8 },
            { key: 'bateria', width: 12 },
            { key: 'almacenamiento', width: 14 },
        ];

        // Datos
        result.rows.forEach((p, i) => {
            const row = sheet.addRow([
                i + 1,
                p.codigo || '',
                p.name,
                p.description || '',
                p.categoria || 'Sin categoría',
                p.price ? parseFloat(p.price) : '',
                p.moneda || 'ARS',
                p.stock || 0,
                p.bateria || '',
                p.almacenamiento || '',
            ]);
            row.eachCell((cell) => {
                cell.alignment = { vertical: 'middle', wrapText: false };
                cell.border = { bottom: { style: 'thin', color: { argb: 'FFE0D6D8' } } };
            });
            if (i % 2 === 0) {
                row.eachCell((cell) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF0F3' } };
                });
            }
            // Precio en formato número
            const priceCell = row.getCell(6);
            if (p.price) {
                priceCell.numFmt = '#,##0.00';
                priceCell.alignment = { horizontal: 'right', vertical: 'middle' };
            }
            row.height = 20;
        });

        // Total al pie
        sheet.addRow([]);
        const totalRow = sheet.addRow([`Total productos: ${result.rows.length}`, '', '', '', '', '', '', '', '', '']);
        totalRow.getCell(1).font = { bold: true, italic: true, color: { argb: 'FF8B1538' } };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="catalogo-metalce-${Date.now()}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Error generando XLSX:', err);
        res.status(500).send('Error generando el catálogo. Intentá de nuevo.');
    }
});
// ==================== FIN CATÁLOGO XLSX ====================

// ==================== FORMULARIO CONTACTO ====================
app.get('/contacto', (req, res) => {
    res.render('contacto', { isAdmin: req.session.isAdmin || false, enviado: null, error: null });
});

app.post('/contacto', async (req, res) => {
    const { nombre, empresa, telefono, email, tipo_consulta, mensaje } = req.body;
    if (!nombre || !email || !tipo_consulta || !mensaje) {
        return res.render('contacto', { isAdmin: req.session.isAdmin || false, enviado: false, error: 'Completá los campos obligatorios.' });
    }
    try {
        await mailTransporter.sendMail({
            from: '"Metal-Ce Contacto" <visioncompanyone@gmail.com>',
            to: 'visioncompanyone@gmail.com',
            subject: `[Metal-Ce] Nueva consulta: ${tipo_consulta} — ${nombre}`,
            html: `
                <h2 style="color:#8B1538;">Nueva consulta desde el sitio</h2>
                <table style="border-collapse:collapse;width:100%">
                    <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Nombre</td><td style="padding:8px;border:1px solid #eee">${nombre}</td></tr>
                    <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Empresa</td><td style="padding:8px;border:1px solid #eee">${empresa || '—'}</td></tr>
                    <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Teléfono</td><td style="padding:8px;border:1px solid #eee">${telefono || '—'}</td></tr>
                    <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Email</td><td style="padding:8px;border:1px solid #eee">${email}</td></tr>
                    <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Tipo consulta</td><td style="padding:8px;border:1px solid #eee">${tipo_consulta}</td></tr>
                    <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Mensaje</td><td style="padding:8px;border:1px solid #eee">${mensaje}</td></tr>
                </table>
            `
        });
        // Auto-reply al cliente
        await mailTransporter.sendMail({
            from: '"Metal-Ce S.R.L." <visioncompanyone@gmail.com>',
            to: email,
            subject: 'Recibimos tu consulta — Metal-Ce',
            html: `<p>Hola <strong>${nombre}</strong>,</p><p>Recibimos tu consulta y te contactaremos a la brevedad.</p><p style="color:#8B1538;font-weight:bold">Metal-Ce S.R.L.</p>`
        });
        res.render('contacto', { isAdmin: req.session.isAdmin || false, enviado: true, error: null });
    } catch (err) {
        console.error('Error enviando email contacto:', err.message);
        res.render('contacto', { isAdmin: req.session.isAdmin || false, enviado: false, error: 'Error al enviar. Intentá de nuevo.' });
    }
});

// ==================== FORMULARIO TRABAJA CON NOSOTROS ====================
app.get('/trabaja-con-nosotros', (req, res) => {
    res.render('trabaja-con-nosotros', { isAdmin: req.session.isAdmin || false, enviado: null, error: null });
});

app.post('/trabaja-con-nosotros', uploadCV.single('cv'), async (req, res) => {
    const { nombre, email, telefono, area_interes, mensaje } = req.body;
    if (!nombre || !email || !area_interes) {
        return res.render('trabaja-con-nosotros', { isAdmin: req.session.isAdmin || false, enviado: false, error: 'Completá los campos obligatorios.' });
    }
    try {
        const cvUrl = req.file ? req.file.path : null;
        const mailOptions = {
            from: '"Metal-Ce RRHH" <visioncompanyone@gmail.com>',
            to: 'visioncompanyone@gmail.com',
            subject: `[Metal-Ce RRHH] Nueva postulación: ${area_interes} — ${nombre}`,
            html: `
                <h2 style="color:#8B1538;">Nueva postulación laboral</h2>
                <table style="border-collapse:collapse;width:100%">
                    <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Nombre</td><td style="padding:8px;border:1px solid #eee">${nombre}</td></tr>
                    <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Email</td><td style="padding:8px;border:1px solid #eee">${email}</td></tr>
                    <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Teléfono</td><td style="padding:8px;border:1px solid #eee">${telefono || '—'}</td></tr>
                    <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Área de interés</td><td style="padding:8px;border:1px solid #eee">${area_interes}</td></tr>
                    <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Mensaje</td><td style="padding:8px;border:1px solid #eee">${mensaje || '—'}</td></tr>
                    ${cvUrl ? `<tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">CV</td><td style="padding:8px;border:1px solid #eee"><a href="${cvUrl}">Descargar CV</a></td></tr>` : ''}
                </table>
            `
        };
        await mailTransporter.sendMail(mailOptions);
        // Auto-reply al postulante
        await mailTransporter.sendMail({
            from: '"Metal-Ce S.R.L." <visioncompanyone@gmail.com>',
            to: email,
            subject: 'Recibimos tu postulación — Metal-Ce',
            html: `<p>Hola <strong>${nombre}</strong>,</p><p>Recibimos tu postulación para el área de <strong>${area_interes}</strong>. La revisaremos y nos contactaremos si hay una oportunidad disponible. ¡Muchas gracias por tu interés en Metal-Ce!</p><p style="color:#8B1538;font-weight:bold">Metal-Ce S.R.L. — Recursos Humanos</p>`
        });
        res.render('trabaja-con-nosotros', { isAdmin: req.session.isAdmin || false, enviado: true, error: null });
    } catch (err) {
        console.error('Error enviando email RRHH:', err.message);
        res.render('trabaja-con-nosotros', { isAdmin: req.session.isAdmin || false, enviado: false, error: 'Error al enviar. Intentá de nuevo.' });
    }
});

// Manejador de errores para páginas no encontradas (404)
app.use((req, res, next) => {
    res.status(404).send("Página no encontrada");
});

// Middleware de manejo de errores global (debe estar al final)
app.use((err, req, res, next) => {
    console.error('═══ ❌ ERROR GLOBAL ═══');
    console.error('Tipo:', err.name);
    console.error('Mensaje:', err.message);
    console.error('Stack:', err.stack);
    
    if (err instanceof multer.MulterError) {
        console.error('⚠️ Error de Multer:', err.code);
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).send('El archivo es demasiado grande. Máximo 10MB.');
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).send('Campo de archivo inesperado.');
        }
        return res.status(400).send(`Error al subir archivo: ${err.message}`);
    }
    
    if (err.message && err.message.includes('Cloudinary')) {
        return res.status(500).send('Error al subir imagen a Cloudinary. Verifica la configuración.');
    }
    
    res.status(500).send(`Error del servidor: ${err.message}`);
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
});
