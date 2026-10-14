const { Client } = require('pg');
const { APIResponse, APIGatewayResponse } = require('sicop/common');

const HEADERS = JSON.parse(process.env.HEADERS);

// Columna de dim_distribuidores por tipo de catalogo. La columna nunca viene
// del request directamente: solo se aceptan las llaves de este mapa.
const COLUMNAS = { marca: 'marca', grupo: 'grupo' };

// Las columnas marca y grupo no traen el prefijo: el esquema de la base es
// 'dwh' + nombre en minusculas. Solo se aceptan nombres alfanumericos, la misma
// regla con la que las Lambdas de guias arman el esquema.
const ESQUEMA_VALIDO = /^dwh[a-z0-9]+$/;

// El catalogo cambia pocas veces al año; se guarda en memoria del contenedor
// para no consultar Redshift en cada apertura de la app.
const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = {};

function createClient() {
    return new Client({
        host: process.env.REDSHIFT_HOST,
        port: parseInt(process.env.REDSHIFT_PORT || '5439'),
        database: process.env.REDSHIFT_DATABASE,
        user: process.env.REDSHIFT_USER,
        password: process.env.REDSHIFT_PASSWORD,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000
    });
}

async function leerCatalogo(columna) {
    const client = createClient();
    try {
        await client.connect();
        const result = await client.query(
            `SELECT DISTINCT TRIM(${columna}) AS nombre
             FROM dwhrealtime.dim_distribuidores
             WHERE ${columna} IS NOT NULL AND TRIM(${columna}) <> ''
             ORDER BY 1`
        );
        const data = [];
        for (const r of result.rows) {
            const esquema = `dwh${r.nombre.toLowerCase()}`;
            if (!ESQUEMA_VALIDO.test(esquema)) {
                console.log(`${columna} ${r.nombre} se omite, esquema invalido: ${esquema}`);
                continue;
            }
            data.push({ nombre: r.nombre, esquema });
        }
        return data;
    } finally {
        await client.end();
    }
}

exports.handler = async (event) => {
    const tipo = ((event.queryStringParameters && event.queryStringParameters.tipo) || '').toLowerCase();
    const columna = COLUMNAS[tipo];
    if (!columna) {
        return new APIGatewayResponse(400, JSON.stringify(new APIResponse(400, 'BadRequest', 'El parametro tipo debe ser marca o grupo')), HEADERS);
    }

    const ahora = Date.now();
    if (cache[tipo] && ahora < cache[tipo].expira) {
        return new APIGatewayResponse(200, JSON.stringify({ tipo, data: cache[tipo].data }), HEADERS);
    }

    try {
        const data = await leerCatalogo(columna);
        cache[tipo] = { data, expira: ahora + CACHE_TTL_MS };
        return new APIGatewayResponse(200, JSON.stringify({ tipo, data }), HEADERS);
    } catch (error) {
        console.log('Error:', error.message);
        // Si Redshift falla pero hay catalogo vencido, se sirve ese
        if (cache[tipo]) {
            return new APIGatewayResponse(200, JSON.stringify({ tipo, data: cache[tipo].data }), HEADERS);
        }
        return new APIGatewayResponse(500, JSON.stringify(new APIResponse(500, 'InternalError', error.message)), HEADERS);
    }
};
