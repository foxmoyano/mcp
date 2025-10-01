import sql from 'mssql';

const config = {
    server: 'foxcorp',
    database: 'ntisyc_dev',
    user: 'dev_user_ntisy',
    password: 'RDO2Yy07655Z',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
    },
    connectionTimeout: 30000,
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

async function testConnection() {
    try {
        console.log('Intentando conectar...');
        const pool = await sql.connect(config);
        console.log('Conexión exitosa!');
        
        const request = pool.request();
        const result = await request.query('SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = \'BASE TABLE\' ORDER BY TABLE_NAME');
        
        console.log('Tablas encontradas:');
        result.recordset.forEach(row => {
            console.log(`- ${row.TABLE_NAME}`);
        });
        
        // Buscar tabla eafs específicamente
        const eafsCheck = await request.query('SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = \'eafs\' AND TABLE_TYPE = \'BASE TABLE\'');
        console.log(`\\nTabla 'eafs' existe: ${eafsCheck.recordset[0].count > 0 ? 'SI' : 'NO'}`);
        
        await pool.close();
    } catch (error) {
        console.error('Error de conexión:', error);
    }
}

testConnection();