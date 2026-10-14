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

function validateBody(body) {
    const required = ['cliente', 'tipocontacto', 'indicador', 'guia', 'orden', 'puntos'];
    for (const field of required) {
        if (body[field] === undefined || body[field] === null) {
            throw new Error(`El campo ${field} es requerido`);
        }
    }
}

async function postFunnelGuia(body) {
    const schema = getSchema(body.cliente);
    const client = createClient();

    try {
        await client.connect();
        await client.query(
            `INSERT INTO ${schema}.funnelguias (tipocontacto, indicador, guia, orden, puntos)
             VALUES ($1, $2, $3, $4, $5)`,
            [body.tipocontacto, body.indicador, body.guia, body.orden, body.puntos]
        );

        const select = await client.query(
            `SELECT idguia, tipocontacto, indicador, guia, orden, puntos
             FROM ${schema}.funnelguias
             WHERE tipocontacto = $1 AND indicador = $2
             ORDER BY idguia DESC
             LIMIT 1`,
            [body.tipocontacto, body.indicador]
        );

        const created = {
            id: select.rows[0] ? select.rows[0].idguia : null,
            type: 'FUNNELGUIA',
            action: 'CREATE',
            status: 'Successful',
            data: select.rows[0] || null
        };

        return new APIGatewayResponse(201, JSON.stringify(created), HEADERS);
    } catch (error) {
        console.log('Error:', error.message);
        return new APIGatewayResponse(500, JSON.stringify(new APIResponse(500, 'InternalError', error.message)), HEADERS);
    } finally {
        await client.end();
    }
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return new APIGatewayResponse(405, JSON.stringify(new APIResponse(405, 'MethodNotAllowed', 'Solo metodo POST es soportado')), HEADERS);
    }

    let body;
    try {
        body = JSON.parse(event.body);
        validateBody(body);
    } catch (error) {
        return new APIGatewayResponse(400, JSON.stringify(new APIResponse(400, 'BadRequest', error.message)), HEADERS);
    }

    return postFunnelGuia(body);
};
