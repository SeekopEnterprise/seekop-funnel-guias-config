// Canjea el codigo de un solo uso (OTP) con el que Orbit abre la SPA por el
// accessToken del usuario. Es la unica ruta sin authorizer: aqui se obtiene el
// token. El codigo y el token nunca se registran en logs.
const ORBIT_EXCHANGE_CODE_URL = process.env.ORBIT_EXCHANGE_CODE_URL;
const ORBIT_MODULE_KEY = process.env.ORBIT_MODULE_KEY;
const HEADERS = JSON.parse(process.env.HEADERS);

function response(statusCode, body) {
    return { statusCode, headers: HEADERS, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
    let body;
    try {
        body = JSON.parse(event.body || '{}');
    } catch (error) {
        return response(400, { code: 400, message: 'Body invalido.' });
    }

    const code = body && body.code;
    if (!code || typeof code !== 'string') {
        return response(400, { code: 400, message: 'El codigo es requerido.' });
    }

    let res;
    try {
        res = await fetch(ORBIT_EXCHANGE_CODE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, moduleKey: ORBIT_MODULE_KEY }),
            signal: AbortSignal.timeout(10000)
        });
    } catch (error) {
        console.log('No se pudo contactar a Orbit:', error.name);
        return response(500, { code: 500, message: 'No se pudo contactar a Orbit.' });
    }

    const orbitBody = await res.json().catch(() => null);

    // Orbit: 400 = parametros; 401 = codigo invalido, expirado o ya consumido
    if (!res.ok) {
        const message = (orbitBody && orbitBody.message) || 'Codigo invalido o expirado.';
        return response(res.status, { code: res.status, message });
    }

    const accessToken = orbitBody && orbitBody.data && orbitBody.data.accessToken;
    if (!accessToken) {
        return response(500, { code: 500, message: 'No se pudo emitir el token.' });
    }

    // Solo el accessToken llega al navegador; el refreshToken no se expone
    return response(200, { accessToken });
};
