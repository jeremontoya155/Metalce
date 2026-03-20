require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function createPedidosTable() {
    const client = await pool.connect();
    
    try {
        console.log('🛒 Creando tabla de pedidos...\n');
        
        await client.query('BEGIN');
        
        // Crear tabla de pedidos
        await client.query(`
            CREATE TABLE IF NOT EXISTS pedidos (
                id SERIAL PRIMARY KEY,
                numero_pedido VARCHAR(50) UNIQUE NOT NULL,
                cliente_nombre VARCHAR(255) NOT NULL,
                cliente_telefono VARCHAR(50),
                cliente_email VARCHAR(255),
                cliente_direccion TEXT,
                items JSONB NOT NULL,
                total DECIMAL(10, 2) NOT NULL,
                estado VARCHAR(50) DEFAULT 'pendiente',
                metodo_pago VARCHAR(50),
                notas TEXT,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log('✅ Tabla pedidos creada');
        
        // Crear índices
        await client.query('CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_pedidos_numero ON pedidos(numero_pedido)');
        
        console.log('✅ Índices creados');
        
        await client.query('COMMIT');
        console.log('\n🎉 Sistema de pedidos creado exitosamente!\n');
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\n❌ Error:', err.message);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

createPedidosTable()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('💥 Error fatal:', err);
        process.exit(1);
    });
