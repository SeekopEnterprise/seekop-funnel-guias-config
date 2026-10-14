import { useState, useRef, useEffect, useMemo } from 'react'

const ETIQUETAS = { marca: 'Marca', grupo: 'Grupo' }

// Combo de marca / grupo: el toggle decide de qué catálogo salen las opciones.
// Cada opción es { nombre, esquema }; se muestra el nombre.
export default function MarcaGrupoSelect({ tipo, onTipoChange, opciones, valor, onChange, cargando, error, deshabilitado }) {
  const [abierto,  setAbierto]  = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [activo,   setActivo]   = useState(0)
  const rootRef   = useRef(null)
  const buscarRef = useRef(null)
  const listaRef  = useRef(null)

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return opciones
    // Primero las que empiezan con el texto, luego las que lo contienen
    const empiezan = [], contienen = []
    for (const o of opciones) {
      const pos = o.nombre.toLowerCase().indexOf(q)
      if (pos === 0) empiezan.push(o)
      else if (pos > 0) contienen.push(o)
    }
    return empiezan.concat(contienen)
  }, [opciones, busqueda])

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function onDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setAbierto(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  useEffect(() => {
    if (abierto) {
      setBusqueda('')
      setActivo(0)
      buscarRef.current?.focus()
    }
  }, [abierto])

  useEffect(() => { setActivo(0) }, [busqueda])

  useEffect(() => {
    listaRef.current?.children[activo]?.scrollIntoView({ block: 'nearest' })
  }, [activo])

  function elegir(o) {
    onChange(o)
    setAbierto(false)
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActivo(i => Math.min(i + 1, filtradas.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActivo(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtradas[activo]) elegir(filtradas[activo])
    } else if (e.key === 'Escape') {
      setAbierto(false)
    }
  }

  const etiqueta = ETIQUETAS[tipo].toLowerCase()
  const placeholder = error ? 'Error al cargar'
    : cargando ? 'Cargando…'
    : `-- Seleccionar ${etiqueta} --`

  return (
    <div className="mg-row">
        <div className="mg-toggle">
          {Object.keys(ETIQUETAS).map(t => (
            <button
              key={t}
              type="button"
              className={`mg-toggle-btn${tipo === t ? ' mg-toggle-btn-active' : ''}`}
              onClick={() => { if (t !== tipo) { onTipoChange(t); setAbierto(false) } }}
            >
              {ETIQUETAS[t]}
            </button>
          ))}
        </div>

        <div className="mg-select" ref={rootRef}>
          <button
            type="button"
            className={`mg-select-trigger${abierto ? ' mg-open' : ''}`}
            onClick={() => setAbierto(a => !a)}
            disabled={deshabilitado || cargando || !!error}
            title={error || undefined}
          >
            <span className={valor ? 'mg-value' : 'mg-placeholder'}>{valor ? valor.nombre : placeholder}</span>
            <span className="mg-caret">{abierto ? '▴' : '▾'}</span>
          </button>

          {abierto && (
            <div className="mg-dropdown">
              <div className="mg-search">
                <span className="mg-search-icon">⌕</span>
                <input
                  ref={buscarRef}
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Buscar..."
                />
              </div>
              <ul className="mg-list" ref={listaRef}>
                {filtradas.length === 0 ? (
                  <li className="mg-empty">Sin resultados</li>
                ) : filtradas.map((o, i) => (
                  <li
                    key={o.esquema + '|' + o.nombre}
                    className={`mg-option${i === activo ? ' mg-option-active' : ''}${valor && o.nombre === valor.nombre ? ' mg-option-selected' : ''}`}
                    onMouseEnter={() => setActivo(i)}
                    onMouseDown={e => { e.preventDefault(); elegir(o) }}
                  >
                    {o.nombre}
                  </li>
                ))}
              </ul>
              <div className="mg-footer">{filtradas.length} de {opciones.length}</div>
            </div>
          )}
      </div>
    </div>
  )
}
