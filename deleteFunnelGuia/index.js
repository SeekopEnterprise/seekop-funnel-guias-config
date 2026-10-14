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

async function deleteFunnelGuia(cliente, idguia) {
    const schema = getSchema(cliente);
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
            `DELETE FROM ${schema}.funnelguias WHERE idguia = $1`,
            [idguia]
        );

        const deleted = {
            id: idguia,
            type: 'FUNNELGUIA',
            action: 'DELETE',
            status: 'Successful',
            message: 'Guia eliminada exitosamente'
        };

        return new APIGatewayResponse(200, JSON.stringify(deleted), HEADERS);
    } catch (error) {
        console.log('Error:', error.message);
        return new APIGatewayResponse(500, JSON.stringify(new APIResponse(500, 'InternalError', error.message)), HEADERS);
    } finally {
        await client.end();
    }
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'DELETE') {
        return new APIGatewayResponse(405, JSON.stringify(new APIResponse(405, 'MethodNotAllowed', 'Solo metodo DELETE es soportado')), HEADERS);
    }

    const idguia = event.pathParameters && event.pathParameters.idguia;
    if (!idguia) {
        return new APIGatewayResponse(400, JSON.stringify(new APIResponse(400, 'BadRequest', 'El parametro idguia es requerido')), HEADERS);
    }

    const cliente = event.queryStringParameters && event.queryStringParameters.cliente;
    if (!cliente) {
        return new APIGatewayResponse(400, JSON.stringify(new APIResponse(400, 'BadRequest', 'El parametro cliente es requerido')), HEADERS);
    }

    return deleteFunnelGuia(cliente, idguia);
};
