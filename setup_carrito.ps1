# Script para configurar las tablas del carrito y Mercado Pago
# Ejecutar desde la raíz del proyecto

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  SETUP: Carrito y Mercado Pago - ChipStore" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que existe .env
if (-not (Test-Path ".env")) {
    Write-Host "❌ Archivo .env no encontrado" -ForegroundColor Red
    Write-Host "Por favor, copia .env.example a .env y configura las variables" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Ejemplo:" -ForegroundColor White
    Write-Host "  copy .env.example .env" -ForegroundColor Gray
    exit 1
}

# Cargar variables de entorno
Write-Host "📋 Cargando configuración..." -ForegroundColor Yellow
$envContent = Get-Content ".env" -Raw
$envLines = $envContent -split "`n"
foreach ($line in $envLines) {
    if ($line -match "^([^#][^=]+)=(.+)$") {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

$DATABASE_URL = $env:DATABASE_URL

if (-not $DATABASE_URL) {
    Write-Host "❌ DATABASE_URL no configurado en .env" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Configuración cargada" -ForegroundColor Green
Write-Host ""

# Verificar que existe el archivo SQL
$sqlFile = "sql\08_create_cart_and_orders.sql"
if (-not (Test-Path $sqlFile)) {
    Write-Host "❌ Archivo $sqlFile no encontrado" -ForegroundColor Red
    exit 1
}

Write-Host "🗄️  Ejecutando script SQL..." -ForegroundColor Yellow
Write-Host "Archivo: $sqlFile" -ForegroundColor Gray
Write-Host ""

# Ejecutar el script SQL usando psql
try {
    # Extraer componentes de la URL de la base de datos
    if ($DATABASE_URL -match "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)") {
        $dbUser = $matches[1]
        $dbPassword = $matches[2]
        $dbHost = $matches[3]
        $dbPort = $matches[4]
        $dbName = $matches[5]
        
        # Remover parámetros SSL si existen
        $dbName = $dbName -replace '\?.*', ''
        
        Write-Host "Conectando a: $dbHost:$dbPort/$dbName" -ForegroundColor Gray
        
        # Configurar variable de entorno para la contraseña
        $env:PGPASSWORD = $dbPassword
        
        # Ejecutar psql
        $psqlCmd = "psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f `"$sqlFile`""
        
        Invoke-Expression $psqlCmd
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ Tablas creadas exitosamente" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "❌ Error al ejecutar el script SQL" -ForegroundColor Red
            Write-Host "Código de salida: $LASTEXITCODE" -ForegroundColor Red
        }
        
    } else {
        Write-Host "❌ Formato de DATABASE_URL inválido" -ForegroundColor Red
        Write-Host "Formato esperado: postgresql://user:password@host:port/database" -ForegroundColor Yellow
        exit 1
    }
    
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Próximos pasos:" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Configurar MP_ACCESS_TOKEN en .env" -ForegroundColor White
Write-Host "   Obtenerlo en: https://www.mercadopago.com.ar/developers" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Configurar BASE_URL en .env" -ForegroundColor White
Write-Host "   Desarrollo: http://localhost:3000" -ForegroundColor Gray
Write-Host "   Producción: https://tudominio.com" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Configurar webhook en Mercado Pago" -ForegroundColor White
Write-Host "   URL: [BASE_URL]/api/mercadopago/webhook" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Iniciar el servidor" -ForegroundColor White
Write-Host "   npm start" -ForegroundColor Gray
Write-Host ""
Write-Host "📚 Leer CARRITO_MERCADOPAGO_README.md para más información" -ForegroundColor Yellow
Write-Host ""
