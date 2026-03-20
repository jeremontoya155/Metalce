# 🛒 Sistema de Carrito y Mercado Pago - Metal-Ce

## 📋 Documentación Completa de Implementación

Este documento explica cómo funciona el sistema de carrito de compras con integración de Mercado Pago de forma **100% segura** y con control de stock.

---

## 🔧 Configuración Inicial

### 1. Crear las Tablas en la Base de Datos

**Opción 1 - Script automático (recomendado):**
```bash
node setup-carrito.js
```

**Opción 2 - Manualmente con psql:**
```bash
psql -U tu_usuario -d tu_base_de_datos -f sql/08_create_cart_and_orders.sql
```

O desde la línea de comandos de PostgreSQL:
```sql
\i sql/08_create_cart_and_orders.sql
```

Esto creará las siguientes tablas:
- **carritos**: Almacena carritos de compras de usuarios
- **carrito_items**: Items dentro de cada carrito
- **pedidos**: Órdenes de compra realizadas
- **stock_historial**: Auditoría de todos los cambios de stock

### 2. Configurar Mercado Pago

1. **Crear cuenta de Mercado Pago**: 
   - Ve a https://www.mercadopago.com.ar/developers
   - Crea una cuenta de desarrollador

2. **Obtener credenciales**:
   - Panel > Tus integraciones > Credenciales
   - Copia el **Access Token** (hay uno para TEST y otro para PRODUCCIÓN)

3. **Configurar variables de entorno** en tu archivo `.env`:

```env
# Mercado Pago
MP_ACCESS_TOKEN=TEST-1234567890-abcdef-1234567890abcdef-123456789
BASE_URL=http://localhost:3000

# En producción cambiar a:
# MP_ACCESS_TOKEN=APP-1234567890-abcdef-1234567890abcdef-123456789
# BASE_URL=https://tudominio.com
```

4. **Configurar Webhook URL** en Mercado Pago:
   - Panel > Tus integraciones > Notificaciones IPN
   - URL: `https://tudominio.com/api/mercadopago/webhook`
   - Eventos: Seleccionar "Pagos"

---

## 🛡️ Características de Seguridad

### Control de Stock en 3 Niveles

1. **Validación al Agregar al Carrito**
   - Verifica stock disponible antes de agregar
   - Impide agregar más unidades de las disponibles

2. **Reserva Temporal (15 minutos)**
   - Al iniciar el checkout, el stock se "reserva"
   - Nadie más puede comprar esas unidades
   - Si no se completa el pago en 15 min, se libera automáticamente

3. **Descuento Definitivo al Confirmar Pago**
   - Solo cuando Mercado Pago confirma el pago exitoso
   - Se descuenta el stock de la base de datos
   - Se registra en el historial para auditoría

### Transacciones Atómicas

- Todas las operaciones de stock usan transacciones PostgreSQL
- Si algo falla, se revierte todo (ROLLBACK)
- Evita inconsistencias en la base de datos

### Auditoría Completa

- Tabla `stock_historial` registra todos los cambios:
  - Reservas
  - Descontos
  - Cancelaciones
  - Devoluciones
- Incluye: producto, cantidad, stock antes/después, fecha, notas

---

## 🔄 Flujo de Compra Completo

```
1. Usuario agrega productos al carrito
   └─> Validación de stock

2. Usuario va a Checkout (/checkout)
   └─> Ingresa sus datos

3. Click en "Pagar con Mercado Pago"
   └─> Se crea el pedido en BD (estado: pendiente)
   └─> Se RESERVA el stock (15 min)
   └─> Se crea preferencia en Mercado Pago
   └─> Usuario es redirigido a MP

4. Usuario completa el pago en Mercado Pago

5. Mercado Pago envía webhook a tu servidor
   └─> Si pago APROBADO:
       ├─> Se DESCUENTA el stock definitivamente
       ├─> Se actualiza pedido (estado: pagado)
       └─> Se vacía el carrito
   └─> Si pago RECHAZADO/CANCELADO:
       ├─> Se LIBERA el stock reservado
       └─> Se actualiza pedido (estado: cancelado)

6. Usuario es redirigido a página de éxito/fallo
```

---

## 📚 API Endpoints

### Carrito

#### `GET /api/cart`
Obtener carrito actual del usuario
```json
{
  "exito": true,
  "carrito": {
    "id": 1,
    "items": [
      {
        "id": 1,
        "product_id": 10,
        "name": "iPhone 14 Pro",
        "cantidad": 2,
        "precio_unitario": 850000,
        "stock": 5
      }
    ],
    "subtotal": 1700000,
    "cantidadTotal": 2,
    "total": 1700000
  }
}
```

#### `POST /api/cart/add`
Agregar producto al carrito
```json
// Request
{
  "productId": 10,
  "cantidad": 1
}

// Response
{
  "exito": true,
  "mensaje": "Producto agregado al carrito",
  "carrito": { ... }
}
```

#### `PUT /api/cart/update/:itemId`
Actualizar cantidad de un item
```json
{
  "cantidad": 3
}
```

#### `DELETE /api/cart/remove/:itemId`
Eliminar item del carrito

#### `DELETE /api/cart/clear`
Vaciar todo el carrito

---

### Mercado Pago

#### `POST /api/mercadopago/create-preference`
Crear preferencia de pago
```json
{
  "clienteNombre": "Juan Pérez",
  "clienteEmail": "juan@example.com",
  "clienteTelefono": "3512345678",
  "clienteDireccion": "Av. Colón 1234",
  "notas": "Entregar por la tarde"
}
```

#### `POST /api/mercadopago/webhook`
Recibir notificaciones de Mercado Pago (automático)

#### `GET /api/pedido/:id/estado`
Consultar estado de un pedido

---

## 🎨 Frontend

### Botón Flotante del Carrito
Se agrega automáticamente en todas las páginas que incluyan `carrito-manager.js`:
- Muestra cantidad de items
- Botón flotante en la esquina inferior derecha
- Redirige a `/checkout` al hacer click

### Agregar al Carrito desde JavaScript
```javascript
// Desde cualquier lugar de tu código
agregarAlCarrito(productId, cantidad);
```

---

## ⚙️ Mantenimiento

### Job Automático de Liberación de Stock

Cada 5 minutos, un job automático busca pedidos con:
- Stock reservado
- Fecha de expiración pasada
- Estado: pendiente

Y los cancela, liberando el stock.

### Consultar Historial de Stock

```sql
SELECT 
  sh.*,
  p.name as producto,
  pe.numero_pedido
FROM stock_historial sh
LEFT JOIN products p ON sh.product_id = p.id
LEFT JOIN pedidos pe ON sh.pedido_id = pe.id
WHERE sh.product_id = 10
ORDER BY sh.created_at DESC;
```

---

## 🚀 Testing

### Modo TEST de Mercado Pago

1. Usar Access Token de TEST en `.env`
2. Tarjetas de prueba: https://www.mercadopago.com.ar/developers/es/docs/testing/test-cards

**Tarjeta aprobada:**
- Número: 5031 7557 3453 0604
- CVV: 123
- Vencimiento: 11/25

**Tarjeta rechazada:**
- Número: 5031 4332 1540 6351

### Probar el Webhook Localmente

Usar **ngrok** para exponer tu servidor local:
```bash
ngrok http 3000
```

Luego configurar la URL del webhook en Mercado Pago:
```
https://tu-subdominio.ngrok.io/api/mercadopago/webhook
```

---

## 🔐 Seguridad en Producción

### ✅ Checklist de Seguridad

- [ ] Usar HTTPS (certificado SSL)
- [ ] Access Token de PRODUCCIÓN (no TEST)
- [ ] Validar firma del webhook de Mercado Pago
- [ ] Limite de rate limiting en las APIs
- [ ] Logs de todas las transacciones
- [ ] Backup diario de la base de datos
- [ ] Monitoreo de stock bajo
- [ ] Alertas de errores en webhooks

### Validar Firma del Webhook (Opcional pero Recomendado)

```javascript
const crypto = require('crypto');

function validarWebhook(req) {
  const xSignature = req.headers['x-signature'];
  const xRequestId = req.headers['x-request-id'];
  const dataID = req.body.data.id;
  
  // Crear firma esperada
  const parts = xSignature.split(',');
  const ts = parts[0].split('=')[1];
  const hash = parts[1].split('=')[1];
  
  const manifest = `id:${dataID};request-id:${xRequestId};ts:${ts};`;
  const hmac = crypto
    .createHmac('sha256', process.env.MP_WEBHOOK_SECRET)
    .update(manifest)
    .digest('hex');
  
  return hmac === hash;
}
```

---

## 📊 Monitoreo

### Consultas Útiles

**Pedidos pendientes con stock reservado:**
```sql
SELECT * FROM pedidos 
WHERE estado = 'pendiente' 
  AND stock_reservado = true
  AND reserva_expira_at > NOW();
```

**Stock total reservado por producto:**
```sql
SELECT 
  p.name,
  p.stock,
  COALESCE(SUM(
    (pe.items::jsonb -> 0 ->> 'cantidad')::int
  ), 0) as stock_reservado
FROM products p
LEFT JOIN pedidos pe ON pe.items::jsonb @> jsonb_build_array(
  jsonb_build_object('product_id', p.id)
)
WHERE pe.stock_reservado = true 
  AND pe.stock_descontado = false
GROUP BY p.id, p.name, p.stock;
```

---

## 🐛 Troubleshooting

### Problema: Webhook no se recibe

1. Verificar URL en panel de Mercado Pago
2. Verificar que el servidor esté accesible públicamente
3. Revisar logs del servidor
4. Probar con ngrok en desarrollo

### Problema: Stock no se descuenta

1. Verificar que el webhook se esté recibiendo
2. Revisar logs de errores en el servidor
3. Verificar estado del pedido en la BD
4. Revisar tabla `stock_historial`

### Problema: Doble descuento de stock

- Implementado protección con flag `stock_descontado`
- Solo se descuenta una vez por pedido
- Si webhook llega múltiples veces, se ignora

---

## 📝 Próximas Mejoras

- [ ] Envío de emails de confirmación
- [ ] Panel de administración de pedidos
- [ ] Integración con sistema de envíos
- [ ] Cupones de descuento
- [ ] Devoluciones y reembolsos
- [ ] Reportes de ventas
- [ ] Notificaciones push

---

## 💡 Soporte

Si tienes problemas:
1. Revisar logs del servidor
2. Consultar documentación de Mercado Pago
3. Verificar configuración de variables de entorno
4. Probar en modo TEST primero

---

## 📄 Licencia

Este sistema fue desarrollado para Metal-Ce S.R.L. Uso interno.

---

**Última actualización:** Febrero 2026
