# Sistema de Ofertas - Metal-Ce

## 📋 Descripción

Sistema completo de gestión de ofertas que permite al administrador crear y gestionar descuentos en productos con las siguientes características:

### ✨ Funcionalidades

1. **Tipos de descuento:**
   - Porcentaje (%)
   - Monto fijo ($)

2. **Gestión de ofertas:**
   - Selección múltiple de productos
   - Definición de período de vigencia (fecha/hora inicio y fin)
   - Vista previa de precios con descuento
   - Activación/desactivación de ofertas

3. **Visualización:**
   - Badge de oferta en las tarjetas de productos
   - Precio original tachado
   - Precio con descuento destacado
   - Indicador de ahorro

## 🗄️ Base de Datos

### Tabla: ofertas

```sql
CREATE TABLE ofertas (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    tipo_descuento VARCHAR(20) NOT NULL CHECK (tipo_descuento IN ('porcentaje', 'monto_fijo')),
    valor_descuento DECIMAL(10, 2) NOT NULL CHECK (valor_descuento > 0),
    fecha_inicio TIMESTAMP NOT NULL,
    fecha_fin TIMESTAMP NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fecha_valida CHECK (fecha_fin > fecha_inicio)
);
```

### Vista: productos_con_ofertas

Vista materializada que combina productos con sus ofertas activas y calcula el precio final.

## 📁 Archivos Creados/Modificados

### Nuevos Archivos:

1. **sql/04_create_ofertas_table.sql**
   - Script de creación de tabla ofertas
   - Función para calcular precios con descuento
   - Vista productos_con_ofertas

2. **views/ofertas.ejs**
   - Interfaz completa de gestión de ofertas
   - 3 tabs: Crear Ofertas, Ofertas Activas, Historial
   - Selector múltiple de productos con vista previa
   - Validaciones en tiempo real

### Archivos Modificados:

1. **views/partials/productCard.ejs**
   - Badge de oferta (esquina superior derecha)
   - Visualización de precio original y precio con descuento
   - Indicador de ahorro

2. **views/partials/navbarUser.ejs**
   - Agregado enlace "🏷️ Ofertas" en menú de administrador

3. **server.js**
   - Rutas GET y POST para gestión de ofertas
   - Modificadas consultas de productos para incluir ofertas
   - API endpoint para obtener productos con ofertas

## 🚀 Instalación

### 1. Ejecutar script de migración:

```bash
# Método recomendado: Usando Node.js
node setup-ofertas.js
```

El script:
- ✅ Lee automáticamente las credenciales del archivo `.env`
- ✅ Verifica si la tabla ya existe para evitar pérdida de datos
- ✅ Crea la tabla de ofertas y todas sus dependencias
- ✅ Valida que la instalación se completó correctamente
- ✅ No requiere configuración adicional

### 2. Reiniciar el servidor:

```bash
npm start
```

## 📖 Uso

### Crear una Oferta:

1. Ir a **Admin → 🏷️ Ofertas**
2. En el tab "Crear Ofertas":
   - Seleccionar tipo de descuento (Porcentaje o Monto Fijo)
   - Ingresar valor del descuento
   - Definir fecha/hora de inicio y fin
   - Seleccionar uno o múltiples productos (usar checkboxes)
   - Ver vista previa de precios
   - Click en "Crear Oferta"

### Gestionar Ofertas:

- **Tab "Ofertas Activas"**: Ver y eliminar ofertas vigentes
- **Tab "Historial"**: Consultar ofertas pasadas y futuras

### Visualización en Tienda:

- Los productos con ofertas activas muestran:
  - Badge rojo con porcentaje de descuento (esquina superior derecha)
  - Precio original tachado
  - Precio con descuento en rojo
  - Texto de ahorro en verde

## 🔧 Endpoints API

### GET /admin/ofertas
Renderiza la página de gestión de ofertas

### POST /admin/ofertas/crear
Crea ofertas para productos seleccionados

**Body:**
```json
{
  "productos": ["1", "2", "3"],
  "tipo_descuento": "porcentaje",
  "valor_descuento": "20",
  "fecha_inicio": "2026-02-10T00:00",
  "fecha_fin": "2026-02-28T23:59"
}
```

### POST /admin/ofertas/eliminar/:id
Elimina una oferta específica

### GET /api/productos-ofertas
Retorna todos los productos con información de ofertas

**Response:**
```json
[
  {
    "id": 1,
    "name": "iPhone 13",
    "price": 799.99,
    "precio_final": 639.99,
    "tiene_oferta_vigente": true,
    "tipo_descuento": "porcentaje",
    "valor_descuento": 20
  }
]
```

## ⚙️ Lógica de Negocio

### Cálculo de Precio con Descuento:

**Porcentaje:**
```
precio_final = precio_original × (1 - descuento / 100)
```

**Monto Fijo:**
```
precio_final = MAX(precio_original - descuento, 0)
```

### Validaciones:

- Al menos un producto seleccionado
- Fecha fin > Fecha inicio
- Porcentaje: 0 < valor ≤ 100
- Monto fijo: valor > 0
- Al crear nueva oferta, se desactivan ofertas anteriores del mismo producto

## 🎨 Características de UI/UX

- **Interfaz intuitiva** con tabs para organizar funciones
- **Vista previa en tiempo real** del precio con descuento
- **Selección masiva** con checkbox "Seleccionar todos"
- **Contador de productos** seleccionados
- **Badges de estado** (Activa, Programada, Expirada, Inactiva)
- **Diseño responsivo** compatible con móviles
- **Validaciones client-side** antes de enviar formulario

## 🔒 Seguridad

- Todas las rutas protegidas con middleware `requireAdmin`
- Validaciones de datos en backend
- Uso de prepared statements para prevenir SQL injection
- Transacciones para operaciones múltiples

## 📝 Notas

- Las ofertas se aplican automáticamente según su período de vigencia
- Solo puede haber una oferta activa por producto a la vez
- Al crear una nueva oferta para un producto, las anteriores se desactivan
- Los precios con descuento se calculan dinámicamente
- Las ofertas expiradas se mantienen en el historial

## 🐛 Debugging

Para ver logs de ofertas, buscar en consola:
```
=== CREAR OFERTAS ===
✅ Ofertas creadas exitosamente
❌ Error al crear ofertas
```

---

**Última actualización:** Febrero 2026
**Versión:** 1.0.0
