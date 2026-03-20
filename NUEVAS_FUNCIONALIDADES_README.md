# Nuevas Funcionalidades - Metal-Ce

## 📋 Resumen de Cambios

Se han implementado tres funcionalidades principales:

### 1. 💱 Conversión de Precios (USD ↔ ARS)

En la página de edición de categorías, ahora puedes **convertir automáticamente** los precios de productos entre dólares y pesos.

#### Características:
- **Botón de conversión individual**: Cada producto tiene un botón `💱 → USD` o `💱 → ARS` para convertir su precio
- **Conversión inteligente**: Usa la cotización del dólar configurada en `/admin/cotizacion`
- **Actualización automática**: El precio se convierte y la moneda se actualiza automáticamente

#### Cómo usar:
1. Ve a **Categorías** → Selecciona una categoría → Click en "Editar"
2. En la lista de productos, verás el botón de conversión junto a cada producto
3. Click en `💱 → USD` para convertir de pesos a dólares (o viceversa)
4. El precio se convertirá usando la cotización actual

### 2. 📊 Meta Pixel (Facebook Pixel)

Ahora puedes agregar tu **Meta Pixel ID** para trackear eventos en tu sitio web.

#### Características:
- **Configuración dinámica**: Cambia el Pixel ID sin editar código
- **Activación/Desactivación fácil**: Solo borra el ID para desactivar el pixel
- **Tracking automático**: El pixel se carga en todas las páginas principales

#### Cómo configurar:
1. Ve a `/admin/cotizacion`
2. En la sección "📊 Meta Pixel ID (Facebook Pixel)"
3. Ingresa tu Pixel ID (ej: `123456789012345`)
4. Click en "💾 Guardar"
5. ✅ El pixel estará activo en todo el sitio

#### Verificación:
- Si está configurado, verás: **"✅ Meta Pixel activo con ID: [tu-id]"**
- Si no está configurado, verás: **"⚠️ Meta Pixel no configurado"**

### 3. 🔧 Mejoras en la Gestión de Monedas

Ya existía la funcionalidad de cambiar moneda, pero ahora se agregó:
- Conversión automática de precios (no solo cambio de etiqueta)
- Interfaz mejorada con botones más claros

---

## 🚀 Instalación

### Paso 1: Actualizar la Base de Datos

Ejecuta el script SQL para agregar el campo `pixel_id`:

```bash
# Opción 1: Usando psql
psql -U postgres -d metalce -f sql/10_add_pixel_id.sql

# Opción 2: Usando el script Node.js
node add-pixel-config.js
```

### Paso 2: Reiniciar el Servidor

```bash
# Reinicia el servidor para cargar los cambios
node server.js
```

---

## 📖 Uso Detallado

### Conversión de Precios

**Ejemplo de conversión:**
- Producto: iPhone 15 - **ARS $1.200.000**
- Cotización actual: **$1.200/USD**
- Click en `💱 → USD`
- Resultado: **USD $1.000**

**Rutas API agregadas:**
- `POST /api/product/:id/convertir-precio` - Convierte el precio de un producto

### Meta Pixel

**Código generado automáticamente:**
```html
<script>
  !function(f,b,e,v,n,t,s){...}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', 'TU_PIXEL_ID');
  fbq('track', 'PageView');
</script>
```

Este código se inyecta automáticamente en el `<head>` del [index.ejs](views/index.ejs) cuando hay un Pixel ID configurado.

---

## 🛠️ Archivos Modificados

### Backend ([server.js](server.js))
- ✅ Agregado endpoint `/api/product/:id/convertir-precio`
- ✅ Modificado `/admin/cotizacion` para manejar `pixel_id`
- ✅ Agregado `pixelId` a las variables pasadas a las vistas

### Frontend
- ✅ [views/edit-category.ejs](views/edit-category.ejs) - Botones de conversión
- ✅ [views/index.ejs](views/index.ejs) - Meta Pixel Code
- ✅ [views/cotizacion.ejs](views/cotizacion.ejs) - Campo para Pixel ID

### Base de Datos
- ✅ [sql/10_add_pixel_id.sql](sql/10_add_pixel_id.sql) - Script de configuración
- ✅ [add-pixel-config.js](add-pixel-config.js) - Script Node.js para configurar

---

## 📝 Notas Importantes

1. **Cotización del Dólar**: La conversión de precios usa la cotización configurada en `/admin/cotizacion`
2. **Pixel ID**: El formato típico es de 15 dígitos numéricos
3. **Seguridad**: Solo los administradores pueden convertir precios y configurar el Pixel ID

---

## 🐛 Troubleshooting

**El pixel no aparece en el sitio:**
- Verifica que hayas guardado el Pixel ID en `/admin/cotizacion`
- Verifica que no esté vacío
- Inspecciona el código fuente de la página (Ctrl+U) y busca `fbq`

**La conversión no funciona:**
- Verifica que tengas configurada la cotización del dólar
- Verifica que tengas permisos de administrador
- Revisa la consola del navegador para errores

---

## ✨ Próximas Mejoras Sugeridas

- [ ] Agregar conversión masiva por categoría con actualización de precio
- [ ] Historial de conversiones de precio
- [ ] Eventos adicionales del Meta Pixel (AddToCart, Purchase, etc.)
- [ ] Validación del formato del Pixel ID

---

¡Listo! Todas las funcionalidades están implementadas y documentadas. 🎉
