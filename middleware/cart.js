// Middleware y funciones auxiliares para el carrito de compras
const { Pool } = require('pg');

// Obtener o crear carrito para la sesión actual
async function obtenerOCrearCarrito(pool, sessionId, userId = null) {
    try {
        // Buscar carrito existente
        let result = await pool.query(
            'SELECT * FROM carritos WHERE session_id = $1',
            [sessionId]
        );

        if (result.rows.length > 0) {
            return result.rows[0];
        }

        // Crear nuevo carrito
        result = await pool.query(
            'INSERT INTO carritos (session_id, user_id) VALUES ($1, $2) RETURNING *',
            [sessionId, userId]
        );

        return result.rows[0];
    } catch (error) {
        console.error('Error al obtener/crear carrito:', error);
        throw error;
    }
}

// Obtener items del carrito con información de productos
async function obtenerItemsCarrito(pool, carritoId) {
    try {
        const result = await pool.query(`
            SELECT 
                ci.*,
                p.name,
                p.description,
                p.img,
                p.price as precio_actual,
                p.stock,
                p.categoria_id,
                c.nombre as categoria_nombre,
                c.cuotas_max,
                c.interes_cuotas,
                c.cuotas_planes
            FROM carrito_items ci
            JOIN products p ON ci.product_id = p.id
            LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE ci.carrito_id = $1
        `, [carritoId]);

        return result.rows;
    } catch (error) {
        console.error('Error al obtener items del carrito:', error);
        throw error;
    }
}

// Calcular totales del carrito
function calcularTotales(items) {
    let subtotal = 0;
    let cantidadTotal = 0;

    items.forEach(item => {
        subtotal += parseFloat(item.precio_unitario) * item.cantidad;
        cantidadTotal += item.cantidad;
    });

    return {
        subtotal: Math.round(subtotal * 100) / 100,
        cantidadTotal,
        total: Math.round(subtotal * 100) / 100
    };
}

// Validar stock disponible para un producto
async function validarStock(pool, productId, cantidad) {
    try {
        const result = await pool.query(
            'SELECT stock FROM products WHERE id = $1',
            [productId]
        );

        if (result.rows.length === 0) {
            return { valido: false, mensaje: 'Producto no encontrado' };
        }

        const stockDisponible = result.rows[0].stock;

        if (stockDisponible < cantidad) {
            return {
                valido: false,
                mensaje: `Stock insuficiente. Disponible: ${stockDisponible}`,
                stockDisponible
            };
        }

        return { valido: true, stockDisponible };
    } catch (error) {
        console.error('Error al validar stock:', error);
        throw error;
    }
}

// Validar todos los items del carrito antes de procesar
async function validarStockCarrito(pool, items) {
    const errores = [];

    for (const item of items) {
        const validacion = await validarStock(pool, item.product_id, item.cantidad);
        if (!validacion.valido) {
            errores.push({
                productId: item.product_id,
                nombre: item.name,
                mensaje: validacion.mensaje
            });
        }
    }

    return {
        valido: errores.length === 0,
        errores
    };
}

// Reservar stock temporalmente (15 minutos)
async function reservarStock(pool, pedidoId, items) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        for (const item of items) {
            // Verificar stock actual con bloqueo
            const stockResult = await client.query(
                'SELECT stock FROM products WHERE id = $1 FOR UPDATE',
                [item.product_id]
            );

            if (stockResult.rows.length === 0) {
                throw new Error(`Producto ${item.product_id} no encontrado`);
            }

            const stockActual = stockResult.rows[0].stock;

            if (stockActual < item.cantidad) {
                throw new Error(
                    `Stock insuficiente para ${item.name}. Disponible: ${stockActual}`
                );
            }

            // Registrar en historial (sin descontar stock todavía)
            await client.query(
                `INSERT INTO stock_historial 
                (product_id, pedido_id, cantidad, stock_anterior, stock_nuevo, tipo, notas)
                VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    item.product_id,
                    pedidoId,
                    -item.cantidad,
                    stockActual,
                    stockActual,  // Sin cambio aún
                    'reserva',
                    'Stock reservado temporalmente'
                ]
            );
        }

        // Marcar pedido como stock reservado
        const expiraEn = new Date();
        expiraEn.setMinutes(expiraEn.getMinutes() + 15);

        await client.query(
            `UPDATE pedidos 
            SET stock_reservado = TRUE, reserva_expira_at = $1 
            WHERE id = $2`,
            [expiraEn, pedidoId]
        );

        await client.query('COMMIT');
        return { exito: true, expiraEn };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al reservar stock:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Descontar stock definitivamente (cuando el pago es confirmado)
async function descontarStock(pool, pedidoId, items) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        for (const item of items) {
            // Descontar stock con bloqueo
            const stockResult = await client.query(
                'SELECT stock FROM products WHERE id = $1 FOR UPDATE',
                [item.product_id]
            );

            if (stockResult.rows.length === 0) {
                throw new Error(`Producto ${item.product_id} no encontrado`);
            }

            const stockActual = stockResult.rows[0].stock;
            const nuevoStock = stockActual - item.cantidad;

            if (nuevoStock < 0) {
                throw new Error(
                    `Stock insuficiente para ${item.name}. Disponible: ${stockActual}`
                );
            }

            // Actualizar stock
            await client.query(
                'UPDATE products SET stock = $1 WHERE id = $2',
                [nuevoStock, item.product_id]
            );

            // Registrar en historial
            await client.query(
                `INSERT INTO stock_historial 
                (product_id, pedido_id, cantidad, stock_anterior, stock_nuevo, tipo, notas)
                VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    item.product_id,
                    pedidoId,
                    -item.cantidad,
                    stockActual,
                    nuevoStock,
                    'descuento',
                    'Stock descontado por pago confirmado'
                ]
            );
        }

        // Marcar pedido como stock descontado
        await client.query(
            'UPDATE pedidos SET stock_descontado = TRUE WHERE id = $1',
            [pedidoId]
        );

        await client.query('COMMIT');
        return { exito: true };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al descontar stock:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Liberar stock reservado (cuando se cancela el pago o expira)
async function liberarStockReservado(pool, pedidoId) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Obtener pedido
        const pedidoResult = await client.query(
            'SELECT * FROM pedidos WHERE id = $1',
            [pedidoId]
        );

        if (pedidoResult.rows.length === 0) {
            throw new Error('Pedido no encontrado');
        }

        const pedido = pedidoResult.rows[0];

        // Solo si tiene stock reservado pero no descontado
        if (pedido.stock_reservado && !pedido.stock_descontado) {
            const items = pedido.items;

            for (const item of items) {
                await client.query(
                    `INSERT INTO stock_historial 
                    (product_id, pedido_id, cantidad, stock_anterior, stock_nuevo, tipo, notas)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [
                        item.product_id,
                        pedidoId,
                        0,
                        0,
                        0,
                        'cancelacion',
                        'Reserva liberada - pago no completado'
                    ]
                );
            }

            await client.query(
                'UPDATE pedidos SET stock_reservado = FALSE WHERE id = $1',
                [pedidoId]
            );
        }

        await client.query('COMMIT');
        return { exito: true };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al liberar stock reservado:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Generar número de pedido único
function generarNumeroPedido() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `PED-${timestamp}-${random}`;
}

module.exports = {
    obtenerOCrearCarrito,
    obtenerItemsCarrito,
    calcularTotales,
    validarStock,
    validarStockCarrito,
    reservarStock,
    descontarStock,
    liberarStockReservado,
    generarNumeroPedido
};
