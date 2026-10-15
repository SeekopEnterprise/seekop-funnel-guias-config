import { useState, useRef, useEffect } from 'react'
import MarcaGrupoSelect from './MarcaGrupoSelect.jsx'
import { exchangeCode, apiFetch, isSessionError } from './api.js'
import './ParentApp.css'

// La GuiasFunnel SPA se sirve en el mismo dominio que esta app. El token solo
// se comparte con ese origen.
const GUIAS_FUNNEL_URL = new URL(import.meta.env.VITE_GUIAS_FUNNEL_URL || './index.html', window.location.href).href
const GUIAS_FUNNEL_ORIGIN = new URL(GUIAS_FUNNEL_URL).origin

export default function ParentApp() {
  // Sesión de Orbit: loading | ready | expired | no-code
  const [phase,    setPhase]   = useState('loading')
  const [sessionError, setSessionError] = useState('')
  const [token,    setToken]   = useState('')       // accessToken, solo en memoria
  const exchanged = useRef(false)

  const [tipo,     setTipo]    = useState('marca')
  const [cliente,  setCliente] = useState('')
  const [seleccion, setSeleccion] = useState(null)  // { nombre, esquema }
  const [ready,    setReady]   = useState(false)
  const [catalogos, setCatalogos] = useState({})   // { marca: [...], grupo: [...] }
  const [cargando, setCargando] = useState(false)
  const [errorCat, setErrorCat] = useState('')
  const iframeRef = useRef(null)

  // Orbit abre la app con ?code=<OTP>; se canjea una sola vez por el accessToken
  useEffect(() => {
    // StrictMode ejecuta el efecto dos veces y el código es de un solo uso
    if (exchanged.current) return
    exchanged.current = true

    const code = new URLSearchParams(window.location.search).get('code')
    if (!code) { setPhase('no-code'); return }

    // El código no debe quedar en el historial ni sobrevivir a un refresh
    window.history.replaceState({}, '', window.location.pathname)

    exchangeCode(code)
      .then(accessToken => {
        setToken(accessToken)
        setPhase('ready')
      })
      .catch(e => {
        setSessionError(e.message || 'Código inválido o expirado.')
        setPhase('expired')
      })
  }, [])

  function handleSessionExpired() {
    setToken('')
    setReady(false)
    setSessionError('Tu sesión expiró.')
    setPhase('expired')
  }

  // Carga el catálogo del tipo activo (marcas o grupos) una sola vez por sesión
  useEffect(() => {
    if (!token || catalogos[tipo]) return
    let cancelado = false
    setCargando(true)
    setErrorCat('')
    apiFetch(`/catalogos?tipo=${encodeURIComponent(tipo)}`, token)
      .then(data => { if (!cancelado) setCatalogos(c => ({ ...c, [tipo]: data.data || [] })) })
      .catch(e => {
        if (cancelado) return
        if (isSessionError(e)) handleSessionExpired()
        else setErrorCat(`No se pudo cargar el catálogo de ${tipo}s: ${e.message}`)
      })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [token, tipo, catalogos])

  // Mensajes del iframe: listo para recibir la sesión, o sesión rechazada por la API
  useEffect(() => {
    function onMessage(e) {
      if (e.origin !== GUIAS_FUNNEL_ORIGIN || e.source !== iframeRef.current?.contentWindow) return
      if (e.data?.type === 'GUIAS_FUNNEL_READY') {
        setReady(true)
        sendCredentials(token, cliente)
      } else if (e.data?.type === 'GUIAS_FUNNEL_SESSION_EXPIRED') {
        handleSessionExpired()
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [token, cliente])

  function sendCredentials(tkn, cli) {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'GUIAS_FUNNEL_INIT', token: tkn, cliente: cli },
      GUIAS_FUNNEL_ORIGIN
    )
  }

  function handleTipoChange(t) {
    setTipo(t)
    setCliente('')
    setSeleccion(null)
    setReady(false)
    setErrorCat('')
  }

  function handleSelect(opcion) {
    // Las Lambdas de guías anteponen 'dwh' al cliente, así que se manda el
    // esquema real (esquemadwh) sin ese prefijo.
    const cli = opcion.esquema.replace(/^dwh/, '')
    setSeleccion(opcion)
    setCliente(cli)
    if (ready) sendCredentials(token, cli)
  }

  function handleApply() {
    if (ready) {
      sendCredentials(token, cliente)
    } else if (iframeRef.current) {
      // Si el iframe aún no respondió, recargar con los valores actuales
      setReady(false)
      iframeRef.current.src = GUIAS_FUNNEL_URL
    }
  }

  const opciones = catalogos[tipo] || []

  if (phase !== 'ready') {
    return (
      <div className="parent-app">
        <div className="parent-placeholder">
          {phase === 'loading'
            ? <p>Validando sesión…</p>
            : <p>
                {phase === 'no-code' ? 'No se encontró un código de sesión válido.' : sessionError}
                <br />Vuelve a abrir el módulo desde <strong>Orbit</strong>.
              </p>}
        </div>
      </div>
    )
  }

  return (
    <div className="parent-app">

      <header className="parent-header">
        <div className="parent-brand">
          <span className="parent-icon">📊</span>
          <span className="parent-title">Guias Funnel</span>
        </div>
        <div className="parent-controls">
          <div className="parent-field">
            <label>Marca / Grupo</label>
            <MarcaGrupoSelect
              tipo={tipo}
              onTipoChange={handleTipoChange}
              opciones={opciones}
              valor={seleccion}
              onChange={handleSelect}
              cargando={cargando}
              error={errorCat}
            />
          </div>
          <button onClick={handleApply} disabled={!cliente} className="parent-btn">
            Cargar
          </button>
        </div>
      </header>

      <div className="parent-body">
        <section className="parent-content">
          {!cliente ? (
            <div className="parent-placeholder">
              {errorCat
                ? <p className="parent-error">{errorCat}</p>
                : <p>Selecciona una <strong>{tipo}</strong> para ver sus guías.</p>}
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              src={GUIAS_FUNNEL_URL}
              className="guias-iframe"
              title="Guias Funnel"
              onLoad={() => {
                // El iframe puede haber recargado; esperar el mensaje READY
                setReady(false)
              }}
            />
          )}
        </section>
      </div>

    </div>
  )
}
