// Rutas de Mercado Pago para procesar pagos
const express = require('express');
const router = express.Router();
const mercadopago = require('mercadopago');
const {
    obtenerOCrearCarrito,
    obtenerItemsCarrito,
    calcularTotales,
    validarStockCarrito,
    reservarStock,
    descontarStock,
    liberarStockReservado,
    generarNumeroPedido
} = require('../middleware/cart');

// Configurar Mercado Pago (se inicializa en server.js)
let mpClient = null;

function initMercadoPago(accessToken) {
    mpClient = new mercadopago.MercadoPagoConfig({
        accessToken: accessToken,
    });
}

// Middleware para asegurar que hay session ID
function ensureSessionId(req, res, next) {
    if (!req.session.id) {
        req.session.id = require('crypto').randomBytes(16).toString('hex');
    }
    next();
}

// Crear preferencia de pago
router.post('/api/mercadopago/create-preference', ensureSessionId, async (req, res) => {
    try {
        const pool = req.app.get('pool');
        const {
            clienteNombre,
            clienteEmail,
            clienteTelefono,
            clienteDireccion,
            notas
        } = req.body;

        // Validar datos requeridos
        if (!clienteNombre || !clienteEmail) {
            return res.status(400).json({
                exito: false,
                mensaje: 'Nombre y email son requeridos'
            });
        }

        const sessionId = req.session.id;
        const userId = req.session.userId || null;

        // Obtener carrito
        const carrito = await obtenerOCrearCarrito(pool, sessionId, userId);
        const items = await obtenerItemsCarrito(pool, carrito.id);

        if (items.length === 0) {
            return res.status(400).json({
                exito: false,
                mensaje: 'El carrito está vacío'
            });
        }

        // Validar stock de todos los productos
        const stockValidacion = await validarStockCarrito(pool, items);
        if (!stockValidacion.valido) {
            return res.status(400).json({
                exito: false,
                mensaje: 'Stock insuficiente para algunos productos',
                errores: stockValidacion.errores
            });
        }

        const totales = calcularTotales(items);

        // Crear pedido en base de datos
        const numeroPedido = generarNumeroPedido();

        const itemsJson = items.map(item => ({
            product_id: item.product_id,
            name: item.name,
            cantidad: item.cantidad,
            precio_unitario: parseFloat(item.precio_unitario),
            subtotal: parseFloat(item.precio_unitario) * item.cantidad
        }));

        const pedidoResult = await pool.query(
            `INSERT INTO pedidos 
            (numero_pedido, session_id, user_id, cliente_nombre, cliente_email, 
             cliente_telefono, cliente_direccion, items, subtotal, total, notas, estado)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *`,
            [
                numeroPedido,
                sessionId,
                userId,
                clienteNombre,
                clienteEmail,
                clienteTelefono || null,
                clienteDireccion || null,
                JSON.stringify(itemsJson),
                totales.subtotal,
                totales.total,
                notas || null,
                'pendiente'
            ]
        );

        const pedido = pedidoResult.rows[0];

        // Reservar stock temporalmente
        await reservarStock(pool, pedido.id, itemsJson);

        // Crear preferencia de Mercado Pago
        const baseUrl = process.env.BASE_URL || 'http://localhost:6080';

        const mpItems = items.map(item => ({
            title: item.name,
            description: item.description || 'Producto',
            picture_url: item.img || undefined,
            category_id: 'electronics',
            quantity: parseInt(item.cantidad),
            unit_price: parseFloat(item.precio_unitario),
            currency_id: 'ARS'
        }));

        const preferenceData = {
            items: mpItems,
            payer: {
                name: clienteNombre,
                email: clienteEmail,
                phone: clienteTelefono ? {
                    area_code: '',
                    number: String(clienteTelefono)
                } : undefined,
                address: clienteDireccion ? {
                    street_name: clienteDireccion
                } : undefined
            },
            back_urls: {
                success: `${baseUrl}/checkout/success?pedido_id=${pedido.id}`,
                failure: `${baseUrl}/checkout/failure?pedido_id=${pedido.id}`,
                pending: `${baseUrl}/checkout/pending?pedido_id=${pedido.id}`
            },
            auto_return: 'approved',
            notification_url: `${baseUrl}/api/mercadopago/webhook`,
            external_reference: String(pedido.id),
            statement_descriptor: 'METAL-CE'
        };

        console.log('📝 Creando preferencia con:', {
            items: mpItems.length,
            baseUrl,
            pedidoId: pedido.id
        });

        const preference = new mercadopago.Preference(mpClient);
        const response = await preference.create({ body: preferenceData });

        console.log('✅ Preferencia creada:', response.id);

        // Guardar preference_id en el pedido
        await pool.query(
            'UPDATE pedidos SET mp_preference_id = $1 WHERE id = $2',
            [response.id, pedido.id]
        );

        res.json({
            exito: true,
            preferenceId: response.id,
            initPoint: response.init_point,
            sandboxInitPoint: response.sandbox_init_point,
            pedidoId: pedido.id,
            numeroPedido: pedido.numero_pedido
        });
    } catch (error) {
        console.error('Error al crear preferencia de pago:', error);
        res.status(500).json({
            exito: false,
            mensaje: 'Error al crear la preferencia de pago',
            error: error.message
        });
    }
});

// Webhook de Mercado Pago (notificaciones IPN)
router.post('/api/mercadopago/webhook', async (req, res) => {
    try {
        const pool = req.app.get('pool');
        const { type, data } = req.body;

        console.log('📬 Webhook recibido:', { type, data });

        // Responder rápido a Mercado Pago
        res.status(200).send('OK');

        // Procesar notificación de forma asíncrona
        if (type === 'payment') {
            const paymentId = data.id;

            // Obtener información del pago
            const payment = new mercadopago.Payment(mpClient);
            const paymentInfo = await payment.get({ id: paymentId });

            console.log('💳 Información del pago:', paymentInfo);

            const externalReference = paymentInfo.external_reference;
            const status = paymentInfo.status;
            const statusDetail = paymentInfo.status_detail;

            if (!externalReference) {
                console.log('⚠️ Pago sin referencia externa');
                return;
            }

            // Buscar pedido
            const pedidoResult = await pool.query(
                'SELECT * FROM pedidos WHERE id = $1',
                [parseInt(externalReference)]
            );

            if (pedidoResult.rows.length === 0) {
                console.log('⚠️ Pedido no encontrado:', externalReference);
                return;
            }

            const pedido = pedidoResult.rows[0];

            // Actualizar información del pago
            await pool.query(
                `UPDATE pedidos 
                SET mp_payment_id = $1, mp_status = $2, mp_status_detail = $3, updated_at = NOW()
                WHERE id = $4`,
                [paymentId, status, statusDetail, pedido.id]
            );

            // Si el pago fue aprobado
            if (status === 'approved') {
                console.log('✅ Pago aprobado, descontando stock...');

                // Descontar stock definitivamente
                await descontarStock(pool, pedido.id, pedido.items);

                // Actualizar estado del pedido
                await pool.query(
                    `UPDATE pedidos 
                    SET estado = 'pagado', pagado_at = NOW()
                    WHERE id = $1`,
                    [pedido.id]
                );

                // Vaciar carrito del usuario
                const carritoResult = await pool.query(
                    'SELECT id FROM carritos WHERE session_id = $1',
                    [pedido.session_id]
                );

                if (carritoResult.rows.length > 0) {
                    await pool.query(
                        'DELETE FROM carrito_items WHERE carrito_id = $1',
                        [carritoResult.rows[0].id]
                    );
                }

                console.log('✅ Pedido completado:', pedido.numero_pedido);
            }
            // Si el pago fue rechazado o cancelado
            else if (status === 'rejected' || status === 'cancelled') {
                console.log('❌ Pago rechazado/cancelado, liberando stock...');

                // Liberar stock reservado
                await liberarStockReservado(pool, pedido.id);

                // Actualizar estado del pedido
                await pool.query(
                    'UPDATE pedidos SET estado = $1 WHERE id = $2',
                    ['cancelado', pedido.id]
                );
            }
        }
    } catch (error) {
        console.error('❌ Error en webhook:', error);
    }
});

// Verificar estado de un pedido
router.get('/api/pedido/:id/estado', async (req, res) => {
    try {
        const pool = req.app.get('pool');
        const { id } = req.params;

        const result = await pool.query(
            'SELECT numero_pedido, estado, mp_status, total, created_at, pagado_at FROM pedidos WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                exito: false,
                mensaje: 'Pedido no encontrado'
            });
        }

        res.json({
            exito: true,
            pedido: result.rows[0]
        });
    } catch (error) {
        console.error('Error al verificar estado del pedido:', error);
        res.status(500).json({
            exito: false,
            mensaje: 'Error al verificar el estado'
        });
    }
});

// Job para liberar stock de pedidos expirados (ejecutar periódicamente)
async function liberarStockExpirado(pool) {
    try {
        const result = await pool.query(
            `SELECT id FROM pedidos 
            WHERE stock_reservado = TRUE 
            AND stock_descontado = FALSE
            AND reserva_expira_at < NOW()
            AND estado = 'pendiente'`
        );

        for (const pedido of result.rows) {
            console.log('🔓 Liberando stock expirado del pedido:', pedido.id);
            await liberarStockReservado(pool, pedido.id);
            await pool.query(
                'UPDATE pedidos SET estado = $1 WHERE id = $2',
                ['cancelado', pedido.id]
            );
        }
    } catch (error) {
        console.error('Error al liberar stock expirado:', error);
    }
}

module.exports = {
    router,
    initMercadoPago,
    liberarStockExpirado
};
