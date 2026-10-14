import { useState, useRef, useEffect } from 'react'
import MarcaGrupoSelect from './MarcaGrupoSelect.jsx'
import './ParentApp.css'

// URL donde está desplegada la GuiasFunnel SPA
const GUIAS_FUNNEL_URL = import.meta.env.VITE_GUIAS_FUNNEL_URL || 'http://localhost:5173'
const API_BASE = import.meta.env.VITE_API_URL || 'https://api.sicopweb.com/guiasfunnel-dev'

export default function ParentApp() {
  const [token,    setToken]   = useState('')
  const [tipo,     setTipo]    = useState('marca')
  const [cliente,  setCliente] = useState('')
  const [seleccion, setSeleccion] = useState(null)  // { nombre, esquema }
  const [ready,    setReady]   = useState(false)
  const [catalogos, setCatalogos] = useState({})   // { marca: [...], grupo: [...] }
  const [cargando, setCargando] = useState(false)
  const [errorCat, setErrorCat] = useState('')
  const iframeRef = useRef(null)

  // Si cambia el token los catálogos se vuelven a pedir con el nuevo
  useEffect(() => { setCatalogos({}) }, [token])

  // Carga el catálogo del tipo activo (marcas o grupos) una sola vez por token
  useEffect(() => {
    if (!token || catalogos[tipo]) return
    let cancelado = false
    const t = setTimeout(async () => {
      setCargando(true)
      setErrorCat('')
      try {
        const res  = await fetch(`${API_BASE}/catalogos?tipo=${tipo}`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.message || `Error ${res.status}`)
        if (!cancelado) setCatalogos(c => ({ ...c, [tipo]: data.data || [] }))
      } catch (e) {
        if (!cancelado) setErrorCat(`No se pudo cargar el catálogo de ${tipo}s: ${e.message}`)
      } finally {
        if (!cancelado) setCargando(false)
      }
    }, 700)
    return () => { cancelado = true; clearTimeout(t) }
  }, [token, tipo, catalogos])

  // Escucha cuando el iframe avisa que está listo
  useEffect(() => {
    function onMessage(e) {
      if (e.data?.type === 'GUIAS_FUNNEL_READY') {
        setReady(true)
        sendCredentials(token, cliente)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [token, cliente])

  function sendCredentials(tkn, cli) {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'GUIAS_FUNNEL_INIT', token: tkn, cliente: cli },
      '*'
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

  return (
    <div className="parent-app">

      <header className="parent-header">
        <div className="parent-brand">
          <span className="parent-icon">📊</span>
          <span className="parent-title">Guias Funnel</span>
        </div>
        <div className="parent-controls">
          <div className="parent-field">
            <label>Token</label>
            <input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="Bearer token…"
              className="parent-input parent-input-lg"
            />
          </div>
          <div className="parent-field">
            <label>Marca / Grupo</label>
            <MarcaGrupoSelect
              tipo={tipo}
              onTipoChange={handleTipoChange}
              opciones={opciones}
              valor={seleccion}
              onChange={handleSelect}
              cargando={cargando || (!!token && !catalogos[tipo] && !errorCat)}
              error={errorCat}
              deshabilitado={!token}
            />
          </div>
          <button onClick={handleApply} disabled={!token || !cliente} className="parent-btn">
            Cargar
          </button>
        </div>
      </header>

      <div className="parent-body">
        <section className="parent-content">
          {!token ? (
            <div className="parent-placeholder">
              <p>Ingresa tu <strong>token</strong> para comenzar.</p>
            </div>
          ) : (
            <>
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
            </>
          )}
        </section>
      </div>

    </div>
  )
}
