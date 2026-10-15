// URL base de la API por ambiente, sin slash final (ver .env.example)
const API_BASE = import.meta.env.VITE_API_URL

export class ApiError extends Error {
  constructor(status, type, message) {
    super(message)
    this.status = status
    this.type = type
  }
}

// Respuestas de API Gateway cuando el authorizer de Orbit rechaza el token.
// Un 403 de las Lambdas (falta de permiso) llega con type Forbidden y no cierra la sesión.
const SESSION_ERROR_TYPES = ['Unauthorized', 'AccessDenied', 'ExpiredToken', 'MissingAuthenticationToken']

export function isSessionError(err) {
  return err instanceof ApiError &&
    (err.status === 401 || (err.status === 403 && SESSION_ERROR_TYPES.includes(err.type)))
}

async function request(path, options, fallbackMessage) {
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, options)
  } catch {
    throw new ApiError(0, 'NetworkError', 'No se pudo conectar con la API.')
  }
  // En errores del gateway el body puede no ser JSON
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data.type, data.message || fallbackMessage || `Error ${res.status}`)
  return data
}

// Canjea el código de un solo uso con el que Orbit abre la app por el accessToken
export async function exchangeCode(code) {
  const data = await request('/session/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  }, 'No se pudo validar la sesión.')
  return data.accessToken
}

export function apiFetch(path, token, { method = 'GET', body } = {}) {
  return request(path, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}
