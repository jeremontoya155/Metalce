require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Conectar a la base de datos usando la misma configuración que server.js
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Colores para la consola
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[36m',
    cyan: '\x1b[36m'
};

async function verificarTablaExiste(nombreTabla) {
    try {
        const result = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = $1
            );
        `, [nombreTabla]);
        return result.rows[0].exists;
    } catch (error) {
        console.error(`${colors.red}Error al verificar tabla: ${error.message}${colors.reset}`);
        return false;
    }
}

async function setupOfertas() {
    console.log(`\n${colors.bright}${colors.cyan}════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}   🏷️  ChipStore - Instalación de Ofertas${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}════════════════════════════════════════════${colors.reset}\n`);

    try {
        // Verificar conexión a la base de datos
        console.log(`${colors.blue}🔌 Conectando a la base de datos...${colors.reset}`);
        await pool.query('SELECT NOW()');
        console.log(`${colors.green}✅ Conexión establecida${colors.reset}\n`);

        // Verificar si la tabla ya existe
        console.log(`${colors.blue}🔍 Verificando si la tabla 'ofertas' ya existe...${colors.reset}`);
        const tablaExiste = await verificarTablaExiste('ofertas');
        
        if (tablaExiste) {
            console.log(`${colors.yellow}⚠️  La tabla 'ofertas' ya existe en la base de datos${colors.reset}`);
            console.log(`${colors.yellow}   No se realizarán cambios para evitar pérdida de datos${colors.reset}\n`);
            
            const readline = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });

            const respuesta = await new Promise((resolve) => {
                readline.question(`${colors.yellow}¿Deseas continuar de todos modos? Esto podría causar errores (s/N): ${colors.reset}`, (answer) => {
                    readline.close();
                    resolve(answer.toLowerCase());
                });
            });

            if (respuesta !== 's' && respuesta !== 'si') {
                console.log(`\n${colors.yellow}❌ Instalación cancelada por el usuario${colors.reset}\n`);
                await pool.end();
                process.exit(0);
            }
        } else {
            console.log(`${colors.green}✅ La tabla no existe, procediendo con la instalación${colors.reset}\n`);
        }

        // Leer y ejecutar el script SQL
        const sqlFilePath = path.join(__dirname, 'sql', '04_create_ofertas_table.sql');
        const sqlFilePath2 = path.join(__dirname, 'sql', '05_create_ofertas_generales.sql');
        
        console.log(`${colors.blue}📄 Leyendo scripts SQL...${colors.reset}`);
        
        if (!fs.existsSync(sqlFilePath)) {
            throw new Error(`No se encontró el archivo: ${sqlFilePath}`);
        }

        const sql = fs.readFileSync(sqlFilePath, 'utf8');
        console.log(`${colors.green}✅ Script 04_create_ofertas_table.sql cargado${colors.reset}`);
        
        let sql2 = '';
        if (fs.existsSync(sqlFilePath2)) {
            sql2 = fs.readFileSync(sqlFilePath2, 'utf8');
            console.log(`${colors.green}✅ Script 05_create_ofertas_generales.sql cargado${colors.reset}\n`);
        }

        // Ejecutar el script
        console.log(`${colors.blue}⚙️  Ejecutando migración...${colors.reset}`);
        console.log(`${colors.blue}   Esto creará:${colors.reset}`);
        console.log(`${colors.blue}   • Tabla 'ofertas'${colors.reset}`);
        console.log(`${colors.blue}   • Tabla 'ofertas_generales'${colors.reset}`);
        console.log(`${colors.blue}   • Índices de rendimiento${colors.reset}`);
        console.log(`${colors.blue}   • Función 'calcular_precio_oferta'${colors.reset}`);
        console.log(`${colors.blue}   • Vista 'productos_con_ofertas'${colors.reset}\n`);

        await pool.query(sql);
        if (sql2) {
            await pool.query(sql2);
        }

        console.log(`${colors.green}${colors.bright}✅ Migración ejecutada exitosamente${colors.reset}\n`);

        // Verificar que todo se creó correctamente
        console.log(`${colors.blue}🔍 Verificando instalación...${colors.reset}`);
        
        const verificaciones = [
            { tipo: 'tabla', nombre: 'ofertas' },
        ];

        for (const item of verificaciones) {
            const existe = await verificarTablaExiste(item.nombre);
            if (existe) {
                console.log(`${colors.green}   ✓ ${item.tipo} '${item.nombre}' creada correctamente${colors.reset}`);
            } else {
                console.log(`${colors.red}   ✗ ${item.tipo} '${item.nombre}' no se encontró${colors.reset}`);
            }
        }

        // Verificar función
        const funcionResult = await pool.query(`
            SELECT EXISTS (
                SELECT FROM pg_proc 
                WHERE proname = 'calcular_precio_oferta'
            );
        `);
        if (funcionResult.rows[0].exists) {
            console.log(`${colors.green}   ✓ Función 'calcular_precio_oferta' creada correctamente${colors.reset}`);
        }

        // Verificar vista
        const vistaResult = await pool.query(`
            SELECT EXISTS (
                SELECT FROM pg_views 
                WHERE viewname = 'productos_con_ofertas'
            );
        `);
        if (vistaResult.rows[0].exists) {
            console.log(`${colors.green}   ✓ Vista 'productos_con_ofertas' creada correctamente${colors.reset}`);
        }

        console.log();
        console.log(`${colors.bright}${colors.cyan}════════════════════════════════════════════${colors.reset}`);
        console.log(`${colors.bright}${colors.green}   ✅ INSTALACIÓN COMPLETADA EXITOSAMENTE${colors.reset}`);
        console.log(`${colors.bright}${colors.cyan}════════════════════════════════════════════${colors.reset}\n`);

        console.log(`${colors.cyan}📝 Próximos pasos:${colors.reset}`);
        console.log(`${colors.white}   1. Reinicia el servidor: ${colors.bright}npm start${colors.reset}`);
        console.log(`${colors.white}   2. Accede a: ${colors.bright}http://localhost:3000/admin/ofertas${colors.reset}`);
        console.log(`${colors.white}   3. Lee la documentación: ${colors.bright}OFERTAS_README.md${colors.reset}\n`);

    } catch (error) {
        console.log();
        console.log(`${colors.bright}${colors.red}════════════════════════════════════════════${colors.reset}`);
        console.log(`${colors.bright}${colors.red}   ❌ ERROR EN LA INSTALACIÓN${colors.reset}`);
        console.log(`${colors.bright}${colors.red}════════════════════════════════════════════${colors.reset}\n`);
        console.error(`${colors.red}Mensaje: ${error.message}${colors.reset}`);
        
        if (error.stack) {
            console.error(`\n${colors.yellow}Stack trace:${colors.reset}`);
            console.error(`${colors.yellow}${error.stack}${colors.reset}`);
        }
        
        console.log();
        process.exit(1);
    } finally {
        await pool.end();
        console.log(`${colors.blue}🔌 Conexión cerrada${colors.reset}\n`);
    }
}

// Ejecutar el setup
console.log(`${colors.cyan}Iniciando instalación del sistema de ofertas...${colors.reset}`);
setupOfertas();
