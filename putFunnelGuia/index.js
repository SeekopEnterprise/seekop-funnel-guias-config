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

async function putFunnelGuia(idguia, body) {
    const schema = getSchema(body.cliente);
    const client = createClient();

    try {
        await client.connect();

        const check = await client.query(
            `SELECT idguia FROM ${schema}.funnelguias WHERE idguia = $1`,
            [idguia]
        );

        if (check.rows.length === 0) {
            return new APIGatewayResponse(404, JSON.stringify(new APIResponse(404, 'NotFound', `Guia con id ${idguia} no encontrada`)), HEADERS);
        }

        await client.query(
            `UPDATE ${schema}.funnelguias
             SET tipocontacto = $1, indicador = $2, guia = $3, orden = $4, puntos = $5
             WHERE idguia = $6`,
            [body.tipocontacto, body.indicador, body.guia, body.orden, body.puntos, idguia]
        );

        const updated = {
            id: idguia,
            type: 'FUNNELGUIA',
            action: 'UPDATE',
            status: 'Successful',
            message: 'Guia actualizada exitosamente'
        };

        return new APIGatewayResponse(200, JSON.stringify(updated), HEADERS);
    } catch (error) {
        console.log('Error:', error.message);
        return new APIGatewayResponse(500, JSON.stringify(new APIResponse(500, 'InternalError', error.message)), HEADERS);
    } finally {
        await client.end();
    }
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'PUT') {
        return new APIGatewayResponse(405, JSON.stringify(new APIResponse(405, 'MethodNotAllowed', 'Solo metodo PUT es soportado')), HEADERS);
    }

    const idguia = event.pathParameters && event.pathParameters.idguia;
    if (!idguia) {
        return new APIGatewayResponse(400, JSON.stringify(new APIResponse(400, 'BadRequest', 'El parametro idguia es requerido')), HEADERS);
    }

    let body;
    try {
        body = JSON.parse(event.body);
        validateBody(body);
    } catch (error) {
        return new APIGatewayResponse(400, JSON.stringify(new APIResponse(400, 'BadRequest', error.message)), HEADERS);
    }

    return putFunnelGuia(idguia, body);
};
