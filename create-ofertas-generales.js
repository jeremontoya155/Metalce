require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ofertas_generales (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(255) NOT NULL,
                descripcion TEXT,
                tipo_descuento VARCHAR(20) NOT NULL CHECK (tipo_descuento IN ('porcentaje', 'monto_fijo')),
                valor_descuento DECIMAL(10, 2) NOT NULL CHECK (valor_descuento > 0),
                fecha_inicio TIMESTAMP NOT NULL,
                fecha_fin TIMESTAMP NOT NULL,
                activo BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fecha_valida_general CHECK (fecha_fin > fecha_inicio)
            )
        `);
        await pool.query('CREATE INDEX IF NOT EXISTS idx_ofertas_generales_activo ON ofertas_generales(activo)');
        console.log('✅ Tabla ofertas_generales creada exitosamente');
    } catch (e) {
        console.error('❌ Error:', e.message);
    } finally {
        await pool.end();
    }
})();
