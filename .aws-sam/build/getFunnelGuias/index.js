const { Client } = require('pg');
const { APIResponse, APIGatewayResponse } = require('sicop/common');

const HEADERS = JSON.parse(process.env.HEADERS);

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

function getSchema(cliente) {
    if (!cliente || !/^[a-zA-Z0-9]+$/.test(cliente)) {
        throw new Error('Parametro cliente invalido. Solo se permiten caracteres alfanumericos.');
    }
    return `dwh${cliente.toLowerCase()}`;
}

async function getFunnelGuias(cliente) {
    const schema  = getSchema(cliente);
    const dwhname = schema; // dwh + cliente
    const client  = createClient();

    try {
        await client.connect();

        const guiasResult = await client.query(
            `SELECT idguia, tipocontacto, indicador, guia, orden, puntos
             FROM ${schema}.funnelguias
             ORDER BY orden ASC`
        );

        // Catálogo de indicadores — opcional, falla silenciosamente si no hay permiso
        const indicadores = {};
        try {
            const rankingResult = await client.query(
                `SELECT DISTINCT tipocontacto, indicador
                 FROM public.config_funnel_ranking
                 WHERE LOWER(dwhname) = $1
                 ORDER BY tipocontacto, indicador`,
                [dwhname]
            );
            for (const row of rankingResult.rows) {
                if (!indicadores[row.tipocontacto]) indicadores[row.tipocontacto] = [];
                indicadores[row.tipocontacto].push(row.indicador);
            }
        } catch (rankingError) {
            console.log('config_funnel_ranking no disponible:', rankingError.message);
        }

        return new APIGatewayResponse(200, JSON.stringify({
            guias: guiasResult.rows,
            indicadores
        }), HEADERS);
    } catch (error) {
        console.log('Error:', error.message);
        return new APIGatewayResponse(500, JSON.stringify(new APIResponse(500, 'InternalError', error.message)), HEADERS);
    } finally {
        await client.end();
    }
}

exports.handler = async (event) => {
    const cliente = event.queryStringParameters && event.queryStringParameters.cliente;
    if (!cliente) {
        return new APIGatewayResponse(400, JSON.stringify(new APIResponse(400, 'BadRequest', 'El parametro cliente es requerido')), HEADERS);
    }

    return getFunnelGuias(cliente);
};
