// Rutas y controladores del carrito de compras
const express = require('express');
const router = express.Router();
const {
    obtenerOCrearCarrito,
    obtenerItemsCarrito,
    calcularTotales,
    validarStock,
    validarStockCarrito
} = require('../middleware/cart');

// Middleware para asegurar que hay session ID
function ensureSessionId(req, res, next) {
    if (!req.session.id) {
        req.session.id = require('crypto').randomBytes(16).toString('hex');
    }
    next();
}

// Obtener carrito actual
router.get('/api/cart', ensureSessionId, async (req, res) => {
    try {
        const pool = req.app.get('pool');
        const sessionId = req.session.id;
        const userId = req.session.userId || null;

        const carrito = await obtenerOCrearCarrito(pool, sessionId, userId);
        const items = await obtenerItemsCarrito(pool, carrito.id);
        const totales = calcularTotales(items);

        res.json({
            exito: true,
            carrito: {
                id: carrito.id,
                items,
                ...totales
            }
        });
    } catch (error) {
        console.error('Error al obtener carrito:', error);
        res.status(500).json({
            exito: false,
            mensaje: 'Error al obtener el carrito'
        });
    }
});

// Agregar producto al carrito
router.post('/api/cart/add', ensureSessionId, async (req, res) => {
    try {
        const pool = req.app.get('pool');
        const { productId, cantidad = 1 } = req.body;

        if (!productId || cantidad < 1) {
            return res.status(400).json({
                exito: false,
                mensaje: 'Datos inválidos'
            });
        }

        // Validar stock
        const stockValidacion = await validarStock(pool, productId, cantidad);
        if (!stockValidacion.valido) {
            return res.status(400).json({
                exito: false,
                mensaje: stockValidacion.mensaje
            });
        }

        const sessionId = req.session.id;
        const userId = req.session.userId || null;

        // Obtener o crear carrito
        const carrito = await obtenerOCrearCarrito(pool, sessionId, userId);

        // Obtener precio actual del producto
        const productoResult = await pool.query(
            'SELECT price FROM products WHERE id = $1',
            [productId]
        );

        if (productoResult.rows.length === 0) {
            return res.status(404).json({
                exito: false,
                mensaje: 'Producto no encontrado'
            });
        }

        const precioUnitario = productoResult.rows[0].price;

        // Verificar si el producto ya está en el carrito
        const itemExistente = await pool.query(
            'SELECT * FROM carrito_items WHERE carrito_id = $1 AND product_id = $2',
            [carrito.id, productId]
        );

        if (itemExistente.rows.length > 0) {
            // Actualizar cantidad
            const nuevaCantidad = itemExistente.rows[0].cantidad + cantidad;

            // Validar nuevo stock
            const stockValidacion2 = await validarStock(pool, productId, nuevaCantidad);
            if (!stockValidacion2.valido) {
                return res.status(400).json({
                    exito: false,
                    mensaje: stockValidacion2.mensaje
                });
            }

            await pool.query(
                'UPDATE carrito_items SET cantidad = $1, precio_unitario = $2 WHERE id = $3',
                [nuevaCantidad, precioUnitario, itemExistente.rows[0].id]
            );
        } else {
            // Agregar nuevo item
            await pool.query(
                `INSERT INTO carrito_items (carrito_id, product_id, cantidad, precio_unitario)
                VALUES ($1, $2, $3, $4)`,
                [carrito.id, productId, cantidad, precioUnitario]
            );
        }

        // Obtener carrito actualizado
        const items = await obtenerItemsCarrito(pool, carrito.id);
        const totales = calcularTotales(items);

        res.json({
            exito: true,
            mensaje: 'Producto agregado al carrito',
            carrito: {
                id: carrito.id,
                items,
                ...totales
            }
        });
    } catch (error) {
        console.error('Error al agregar producto al carrito:', error);
        res.status(500).json({
            exito: false,
            mensaje: 'Error al agregar el producto'
        });
    }
});

// Actualizar cantidad de un item
router.put('/api/cart/update/:itemId', ensureSessionId, async (req, res) => {
    try {
        const pool = req.app.get('pool');
        const { itemId } = req.params;
        const { cantidad } = req.body;

        if (cantidad < 1) {
            return res.status(400).json({
                exito: false,
                mensaje: 'La cantidad debe ser al menos 1'
            });
        }

        // Obtener item
        const itemResult = await pool.query(
            'SELECT * FROM carrito_items WHERE id = $1',
            [itemId]
        );

        if (itemResult.rows.length === 0) {
            return res.status(404).json({
                exito: false,
                mensaje: 'Item no encontrado'
            });
        }

        const item = itemResult.rows[0];

        // Validar stock
        const stockValidacion = await validarStock(pool, item.product_id, cantidad);
        if (!stockValidacion.valido) {
            return res.status(400).json({
                exito: false,
                mensaje: stockValidacion.mensaje
            });
        }

        // Actualizar cantidad
        await pool.query(
            'UPDATE carrito_items SET cantidad = $1 WHERE id = $2',
            [cantidad, itemId]
        );

        // Obtener carrito actualizado
        const items = await obtenerItemsCarrito(pool, item.carrito_id);
        const totales = calcularTotales(items);

        res.json({
            exito: true,
            mensaje: 'Cantidad actualizada',
            carrito: {
                id: item.carrito_id,
                items,
                ...totales
            }
        });
    } catch (error) {
        console.error('Error al actualizar item:', error);
        res.status(500).json({
            exito: false,
            mensaje: 'Error al actualizar el item'
        });
    }
});

// Eliminar item del carrito
router.delete('/api/cart/remove/:itemId', ensureSessionId, async (req, res) => {
    try {
        const pool = req.app.get('pool');
        const { itemId } = req.params;

        // Obtener item para saber el carrito_id
        const itemResult = await pool.query(
            'SELECT carrito_id FROM carrito_items WHERE id = $1',
            [itemId]
        );

        if (itemResult.rows.length === 0) {
            return res.status(404).json({
                exito: false,
                mensaje: 'Item no encontrado'
            });
        }

        const carritoId = itemResult.rows[0].carrito_id;

        // Eliminar item
        await pool.query('DELETE FROM carrito_items WHERE id = $1', [itemId]);

        // Obtener carrito actualizado
        const items = await obtenerItemsCarrito(pool, carritoId);
        const totales = calcularTotales(items);

        res.json({
            exito: true,
            mensaje: 'Producto eliminado del carrito',
            carrito: {
                id: carritoId,
                items,
                ...totales
            }
        });
    } catch (error) {
        console.error('Error al eliminar item:', error);
        res.status(500).json({
            exito: false,
            mensaje: 'Error al eliminar el item'
        });
    }
});

// Vaciar carrito
router.delete('/api/cart/clear', ensureSessionId, async (req, res) => {
    try {
        const pool = req.app.get('pool');
        const sessionId = req.session.id;

        const carrito = await obtenerOCrearCarrito(pool, sessionId);

        await pool.query('DELETE FROM carrito_items WHERE carrito_id = $1', [carrito.id]);

        res.json({
            exito: true,
            mensaje: 'Carrito vaciado',
            carrito: {
                id: carrito.id,
                items: [],
                subtotal: 0,
                cantidadTotal: 0,
                total: 0
            }
        });
    } catch (error) {
        console.error('Error al vaciar carrito:', error);
        res.status(500).json({
            exito: false,
            mensaje: 'Error al vaciar el carrito'
        });
    }
});

module.exports = router;
