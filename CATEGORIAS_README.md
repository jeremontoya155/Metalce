# 📂 Sistema de Categorías - Metal-Ce

## ✅ Cambios Realizados

### 1. **Base de Datos**
- ✅ Nueva tabla `categorias` con campos:
  - `id` (PRIMARY KEY)
  - `nombre` (nombre de la categoría)
  - `descripcion` (descripción opcional)
  - `icono` (emoji para la categoría)
  - `color` (color hexadecimal)
  - `orden` (para ordenar las categorías)
  - `activo` (1/0 para activar/desactivar)
  
- ✅ Tabla `products` modificada:
  - ➕ Agregada columna `categoria_id` (referencia a categorias)
  - ❌ Eliminada columna `estado` (ya no se usa)
  - ✅ Campos `bateria` y `almacenamiento` ahora son opcionales

- ✅ Categorías por defecto insertadas:
  - 📱 Smartphones
  - 🔌 Accesorios
  - 🎧 Audio
  - 📲 Tablets
  - 💻 Computadoras

### 2. **Interfaz de Gestión**
- ✅ Nueva página `/categorias` (solo admin)
  - Ver todas las categorías
  - Crear nuevas categorías
  - Editar categorías existentes
  - Eliminar categorías
  - Diseño moderno con tarjetas coloridas

### 3. **Formularios de Productos**
- ✅ Página `/new` (crear producto):
  - Campo "Categoría" reemplaza a "Estado"
  - Select con todas las categorías activas
  - `bateria` y `almacenamiento` son opcionales
  - Link directo para crear nuevas categorías

- ✅ Página `/edit/:id` (editar producto):
  - Mismo cambio que crear producto
  - Muestra la categoría actual seleccionada

### 4. **Visualización de Productos**
- ✅ Página `/product/:id`:
  - Muestra categoría con icono y color
  - Oculta `bateria` y `almacenamiento` si están vacíos
  - Ya no muestra "Estado"

### 5. **Navegación**
- ✅ Navbar actualizado:
  - Nuevo link "Categorías" (solo admin)

### 6. **Rutas del Servidor** (server.js)

**NUEVAS RUTAS:**
```javascript
GET  /categorias              - Ver gestión de categorías
POST /add-category            - Crear nueva categoría
POST /edit-category/:id       - Editar categoría
POST /delete-category/:id     - Eliminar categoría
```

**RUTAS MODIFICADAS:**
```javascript
GET  /new                     - Ahora incluye lista de categorías
GET  /edit/:id                - Ahora incluye lista de categorías
POST /new                     - Guarda categoria_id (no estado)
POST /edit/:id                - Guarda categoria_id (no estado)
GET  /product/:id             - JOIN con categorias para mostrar info
```

## 🚀 Cómo Usar

### Paso 1: Ejecutar Script SQL
```bash
node add-categories.js
```

### Paso 2: Reiniciar Servidor
```bash
node server.js
```

### Paso 3: Gestionar Categorías
1. Ir a `/categorias` (solo admin)
2. Crear las categorías que necesites
3. Cada categoría puede tener:
   - ✏️ Nombre único
   - 📝 Descripción opcional
   - 😀 Icono (emoji)
   - 🎨 Color personalizado
   - 🔢 Orden de visualización

### Paso 4: Crear/Editar Productos
1. Al crear o editar un producto, selecciona la categoría
2. Los campos `bateria` y `almacenamiento` son opcionales
3. El campo "Estado" ya no existe

## 📋 Ejemplo de Uso

**Crear categoría "Cargadores":**
- Nombre: Cargadores
- Descripción: Cargadores y cables USB
- Icono: 🔌
- Color: #00B4D8
- Orden: 6

**Crear producto con categoría:**
- Nombre: Cable USB-C 2m
- Categoría: Cargadores 🔌
- Batería: (dejar vacío)
- Almacenamiento: (dejar vacío)

## 🎯 Beneficios

1. ✅ **Personalización total**: Crea las categorías que necesites
2. ✅ **Todo nuevo**: No necesitas especificar estado
3. ✅ **Campos opcionales**: Batería/almacenamiento solo si aplica
4. ✅ **Filtrado futuro**: Base lista para filtrar por categoría
5. ✅ **Visual atractivo**: Iconos y colores personalizados

## 📝 Notas Importantes

- ⚠️ Al eliminar una categoría, los productos quedan sin categoría (NULL)
- ✅ Los productos existentes se asignan automáticamente a "Smartphones"
- ✅ Puedes reasignar productos a otras categorías en cualquier momento
- ✅ Las categorías inactivas no aparecen en los formularios

## 🔧 Archivos Modificados

### Nuevos:
- `sql/03_add_categories.sql`
- `views/categorias.ejs`
- `add-categories.js`

### Modificados:
- `server.js`
- `views/new.ejs`
- `views/edit.ejs`
- `views/product.ejs`
- `views/partials/navbarUser.ejs`

¡Sistema de categorías listo para usar! 🎉
